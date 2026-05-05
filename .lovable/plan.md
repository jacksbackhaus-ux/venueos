# Super Admin Permission Management — Architecture & Phased Plan

## 1. Recommended Approach (Summary)

Adopt a **two-layer least-privilege model** layered on top of the existing `super_admins` table (which currently has 0 rows, so additive changes are safe):

- **Layer A — Global Super Admin** (`public.super_admins`): platform-wide access to `/admin`. Rare. Always granted with a reason and, by default, **time-bound** (7 days). Permanent grants require explicit confirmation. Now extended with `created_by`, `reason`, `expires_at`, `revoked_at`, `revoked_by`.
- **Layer B — Internal Staff Roles** (`public.internal_staff_roles`): named roles like `support`, `onboarding`, `ops` for our employees who need limited admin tooling but **not** full super admin. (Phase 2 wiring; table created in Phase 1 so the model is consistent.)

For customers who need extra power during signup, **never** grant global super admin. Instead use:

- **`onboarding_admin` org-scoped role** (added to existing `org_users.org_role` via a new value), limited to a single organisation. This is the recommended path.
- Optional `organisations.onboarding_mode_until` flag for time-boxed setup capabilities — designed but not implemented unless requested.
- For our own debugging on a customer account, prefer the **existing read-only impersonation** flow rather than granting permissions.

A single `admin_actions_log` table records every security-sensitive change (grant/revoke/extend, role changes, onboarding flag toggles).

### Why this shape
- Keeps the existing `super_admins` row shape and `is_super_admin()` signature intact (preview app + RLS keep working).
- Additive columns are nullable with safe defaults — no breakage of existing inserts/policies.
- Hard guardrails (last-admin protection, self-grant prevention, mandatory reasons) are enforced **in the database**, not just the UI.

## 2. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Privilege escalation (user adds self) | RLS `WITH CHECK (is_super_admin() AND user_id <> auth.uid())`; trigger forces `created_by = auth.uid()` and rejects self-grants. |
| Lockout (last admin removed) | `BEFORE UPDATE/DELETE` trigger on `super_admins` blocks any change that would leave 0 active admins (active = not revoked AND (`expires_at` IS NULL OR future)). |
| Silent expiry causing surprise lockout | `is_super_admin()` updated to honour `revoked_at` and `expires_at`; UI shows expiring-soon banner; bootstrap admin is created **without** an expiry. |
| Forgotten temporary grants | Default 7-day expiry; admin list shows status (active/expiring/expired/revoked); audit log immutable. |
| Audit tampering | `admin_actions_log` is INSERT/SELECT only for super admins; no UPDATE/DELETE policies. |
| Bootstrap abuse | No public endpoint. Bootstrap is a single SQL snippet run once by the project owner using a known `auth.uid()`. |
| Breaking the live `/admin` panel | All schema changes are additive; existing `is_super_admin()` is replaced with a backwards-compatible version (same name, same signature, returns the same `true` for any current row because new columns default to "active"). |

## 3. Phased Plan

```
Phase 1  Schema (additive)         super_admins +cols, admin_actions_log,
                                    internal_staff_roles, onboarding_admin enum value
Phase 2  Functions, triggers, RLS  is_super_admin v2, assert_super_admin,
                                    last-admin guard, self-grant guard, audit triggers
Phase 3  Bootstrap + Admin UI      One-time SQL snippet, /admin → "Super Admins" tab
                                    (search users, grant, revoke, extend, audit viewer)
Phase 4  Optional org-scoped       onboarding_admin role wiring + RLS helpers for
                                    org-scoped elevation during signup/support
```

Each phase is shippable on its own and never removes columns or policies.

## 4. Database Changes (Phase 1 + 2)

### 4.1 Extend `super_admins` (additive only)

```sql
ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS created_by  uuid,            -- auth.uid() of granter
  ADD COLUMN IF NOT EXISTS reason      text,            -- mandatory for new rows (enforced by trigger)
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,     -- NULL = permanent
  ADD COLUMN IF NOT EXISTS revoked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by  uuid;

CREATE INDEX IF NOT EXISTS idx_super_admins_active
  ON public.super_admins (user_id)
  WHERE revoked_at IS NULL;
```

Existing columns (`id, user_id, email, granted_at, granted_by, notes`) are untouched.

### 4.2 New audit table

```sql
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by            uuid NOT NULL,
  action_type             text NOT NULL,          -- grant_super_admin, revoke_super_admin,
                                                  -- extend_super_admin, grant_internal_role,
                                                  -- revoke_internal_role, grant_onboarding_admin, etc.
  target_user_id          uuid,
  target_organisation_id  uuid,
  reason                  text NOT NULL,
  metadata                jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

-- Read: super admins only. Insert: super admins only and performed_by = auth.uid().
-- No UPDATE / DELETE policies → effectively immutable.
```

### 4.3 Internal staff roles (created now, surfaced in UI later)

```sql
CREATE TYPE public.internal_role AS ENUM ('support','onboarding','ops');

CREATE TABLE IF NOT EXISTS public.internal_staff_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  role        public.internal_role NOT NULL,
  created_by  uuid NOT NULL,
  reason      text NOT NULL,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  revoked_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.internal_staff_roles ENABLE ROW LEVEL SECURITY;
```

### 4.4 Helper functions

```sql
-- Backwards-compatible replacement: same signature, same return type.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = auth.uid()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_super_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorised: super admin required' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_internal_role(_role public.internal_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_staff_roles
    WHERE user_id = auth.uid() AND role = _role
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
```

### 4.5 Guardrail triggers on `super_admins`

```sql
-- 1. Mandatory reason + creator stamping + self-grant block on INSERT
CREATE OR REPLACE FUNCTION public.trg_super_admin_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Self-grant of super admin is not allowed';
  END IF;
  IF NEW.reason IS NULL OR length(trim(NEW.reason)) < 5 THEN
    RAISE EXCEPTION 'A reason (>=5 chars) is required to grant super admin';
  END IF;
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  NEW.granted_by := COALESCE(NEW.granted_by, auth.uid());
  RETURN NEW;
END $$;

-- 2. Block change that would leave zero active super admins
CREATE OR REPLACE FUNCTION public.trg_super_admin_protect_last()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _active_after int;
BEGIN
  SELECT count(*) INTO _active_after
  FROM public.super_admins
  WHERE revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND id <> COALESCE(OLD.id, NEW.id);

  IF TG_OP = 'UPDATE' AND NEW.revoked_at IS NULL
     AND (NEW.expires_at IS NULL OR NEW.expires_at > now()) THEN
    _active_after := _active_after + 1;        -- this row stays active
  END IF;

  IF _active_after < 1 THEN
    RAISE EXCEPTION 'Cannot remove the last active super admin';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
```

Triggers attached `BEFORE INSERT`, `BEFORE UPDATE`, `BEFORE DELETE` respectively.

### 4.6 RLS (additive — replace existing super_admins INSERT policy)

```sql
DROP POLICY IF EXISTS "Super admins can insert super_admins" ON public.super_admins;
CREATE POLICY "Super admins can insert super_admins"
  ON public.super_admins FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() AND user_id <> auth.uid());

-- SELECT/DELETE policies unchanged. Add UPDATE for revoke/extend:
CREATE POLICY "Super admins can update super_admins"
  ON public.super_admins FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- admin_actions_log
CREATE POLICY "Super admins read audit"   ON public.admin_actions_log
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins write audit"  ON public.admin_actions_log
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() AND performed_by = auth.uid());

-- internal_staff_roles: same shape — super admins only, self-grant blocked.
```

### 4.7 Bootstrap (Phase 3, one-time, manual)

No public endpoint. Run this once via the migration tool, after the project owner has signed up:

```sql
-- Replace <YOUR_AUTH_UID> and <YOUR_EMAIL> before running.
INSERT INTO public.super_admins (user_id, email, created_by, granted_by, reason, expires_at)
VALUES ('<YOUR_AUTH_UID>', '<YOUR_EMAIL>', '<YOUR_AUTH_UID>', '<YOUR_AUTH_UID>',
        'Initial bootstrap super admin', NULL)
ON CONFLICT (user_id) DO NOTHING;
```

To allow this single self-insert, the insert guard exempts cases where there are **zero existing super admins**:

```sql
-- inside trg_super_admin_insert_guard, before the self-grant check:
IF (SELECT count(*) FROM public.super_admins) = 0 THEN
  NEW.created_by := COALESCE(NEW.created_by, NEW.user_id);
  RETURN NEW;
END IF;
```

After bootstrap, the self-grant block applies to all future inserts. The guidance to the operator: sign up normally, copy your `auth.users.id` from the Cloud user list, paste into the snippet, run once.

## 5. Admin UI / UX (Phase 3)

Add a new tab to the existing `/admin` page (no new route required, so existing functionality is untouched):

```
/admin
 ├── Platform stats        (existing)
 ├── Organisations list    (existing)
 ├── [Org detail tabs …]   (existing)
 └── Super Admins  ← NEW top-level tab
       ├── User search       (email / name / id, debounced)
       ├── Active admins     (table: user, granted_at, expires_at, created_by, reason, status)
       ├── Pending/expired   (collapsed)
       └── Audit log         (filter by action_type, user, date range)
```

Component: `src/components/admin/SuperAdminsTab.tsx`. Reused dialogs:

- **Grant dialog**: pick user from search → reason (required, min 5 chars) → duration radio (`7 days` default / `30 days` / `Permanent (requires typing GRANT-PERMANENT)`).
- **Revoke dialog**: reason required. Pre-flight calls `is_super_admin_revoke_safe(target_id)` (a tiny RPC wrapping the last-admin check) so the UI shows a clear error before submitting.
- **Extend dialog**: reason + new expiry. Cannot reduce expiry below `now()`.

Edge cases handled in UI:
- Searching for the current user → grant button hidden ("you cannot grant yourself").
- Granting an already-active admin → button switches to "Extend".
- Revoking last admin → toast: *"Cannot revoke — would leave the platform with no active super admins."*
- Expiring within 24h → row highlighted amber.
- Audit viewer is paginated, read-only.

After every successful grant/revoke/extend, the client also inserts an `admin_actions_log` row (DB triggers also enforce). UI shows a toast and refreshes both lists.

## 6. Customer Onboarding Elevated Access (Part D)

**Recommendation:** add a new value `'onboarding_admin'` to `org_users.org_role` (or its enum if one exists), scoped to a single organisation. This is the safest of the three options because:

- It reuses the existing org membership + RLS plumbing.
- It cannot escape its `organisation_id`.
- It is revocable and expirable using the same pattern as super admins.

Add nullable `expires_at` and `reason` to `org_users` (additive). Treat `onboarding_admin` like `org_owner` for setup-related write paths only (modules, sites, users), not for billing or destructive actions. Granting it is a super-admin action that writes to `admin_actions_log`. Reject `onboarding_admin` from any path checking `is_super_admin()`.

Phase 4 also exposes a "Grant onboarding access" button on each org detail view. We can ship Phases 1–3 without this if you'd rather defer.

## 7. Testing Checklist

Run after Phase 2 and again after Phase 3:

1. **Self-escalation:** logged-in non-admin → `INSERT INTO super_admins (user_id) VALUES (auth.uid())` → must fail (RLS + trigger).
2. **Self-grant by admin:** logged-in admin grants self → must fail with "Self-grant" error.
3. **Missing reason:** insert without reason → must fail.
4. **Last-admin protection:** with 1 active admin, revoke or set `expires_at = now() - 1` → must fail. With 2, must succeed.
5. **Expiry enforcement:** grant with `expires_at = now() + interval '5 seconds'`, wait 6s → `is_super_admin()` returns false; admin loses `/admin` access on next page load.
6. **Bootstrap path:** drop into empty table, run snippet → succeeds; run snippet again → blocked by uniqueness or self-grant guard.
7. **Audit immutability:** as super admin, attempt `UPDATE admin_actions_log` / `DELETE` → must fail (no policy).
8. **Existing /admin still works:** load `/admin` as the bootstrap admin; verify Platform Stats, Org list, Org detail tabs (Plan, Sites, Users, Sub history, Support log), Impersonation flow all behave as before.
9. **Read-only impersonation unchanged:** start impersonation, attempt write → blocked by existing guard.
10. **Onboarding admin (Phase 4 only):** user with `onboarding_admin` role → can edit own org, cannot read other orgs, cannot read `super_admins` or `admin_actions_log`.

---

On approval I will implement **Phases 1–3** in a single pass (additive migration + UI tab), and stop before Phase 4 so you can confirm the onboarding-admin design before any `org_users` changes.