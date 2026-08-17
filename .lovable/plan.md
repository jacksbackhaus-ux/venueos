# Security fixes — plan only, nothing to be built yet

Five findings, in the order I'd fix them. Each section says what's wrong, what I'd change, and what could break.

---

## 1. Device keys readable by any staff member (critical)

**Today:** the `devices` table holds a `device_key` — the credential that marks a device as trusted. Its only read policy is `has_site_access(site_id)`, so every active member of a site, including `read_only` staff, can read every device key for that site. Writes are already owner-only.

**Worth knowing:** nothing in the app or the backend functions reads or writes this table — the only mention of `devices` anywhere in the code is the auto-generated types file. It is a dormant table with a live exposure.

**Fix:** replace the read policy with `is_site_supervisor_or_owner(site_id)` (a helper that already exists). One migration, no code changes.

**Risk of breaking something:** effectively none, since no screen reads the table. If a device-trust feature is built later it will need to run as an owner/supervisor or through a dedicated function.

---

## 2. Offline sync ignores the read-only role

**Today:** `offline-sync` verifies the caller's JWT, resolves their app user, then checks only that they have an **active** membership for the target site. It then writes with the service key, which bypasses row-level security entirely. Every other write path in the app goes through `has_site_write_access`, which additionally requires the member's `site_role` to not be `read_only`.

**Consequence:** a person deliberately given view-only access can still create — and backdate, since the payload carries its own `logged_at` — temperature logs, cleaning logs, incidents, day sheets and delivery logs. For a compliance product that is an audit-trail integrity problem more than a data-leak one.

**Fix:** in the membership lookup, also select `site_role` and reject when it is `read_only`, returning the existing `403 no_site_access` shape. Org owners without a site membership row should still pass, matching `has_site_write_access`.

**Risk:** any genuinely read-only user currently relying on offline logging would stop being able to log. That is the intended behaviour, and it matches what they already can't do when online.

---

## 3. Scheduled jobs callable by any signed-in customer

**Today:** three functions are deployed with `verify_jwt = true`, meaning any valid customer token gets in:

- `site-transfer-cleanup` — already safe. It explicitly requires a service-role token and returns 401 otherwise. The scanner is flagging the config, not real access. No change needed beyond noting it.
- `send-trial-reminders` — no internal check at all.
- `send-compliance-reminders` — no internal check at all.

**Consequence:** a logged-in customer could repeatedly invoke the two reminder functions and push reminder emails to every organisation's owners ahead of schedule. Blast radius is capped by the existing idempotency guards (`trial_reminder_sent_at`, and one compliance reminder per org per day), so it's early/duplicate sends rather than unlimited mail, but strangers should not be able to trigger platform-wide jobs.

**Fix:** extract the service-role caller check already written in `site-transfer-cleanup` into a small shared helper under `supabase/functions/_shared/`, and call it at the top of both reminder functions. Keep `verify_jwt = true` — the in-code check is the real gate.

**Risk:** if the cron schedules for these two jobs currently pass the public key rather than the vault-held service key, they would start returning 401. So the plan includes checking both `cron.job` rows and re-pointing them at the vault key the same way the site-transfer job was fixed, then confirming a live run still succeeds.

---

## 4. Transactional email is effectively an open relay

**Today:** `send-transactional-email` needs only a valid user JWT. There is no check tying the caller to the recipient address or to the organisation named in the template payload. Any account holder can send any template, to any address, with their own choice of `organisation_name`, `inviter_name` and links — from your verified sending domain `notify.mise-os.app`.

**Consequence:** convincing phishing that passes SPF/DKIM as MiseOS, plus sender-reputation damage if abused. This is the highest reputational risk of the five.

**Why it's open:** four client-side call sites depend on it:

| Where | Template | Recipient |
|---|---|---|
| Onboarding | `welcome-trial-start` | the signed-in user's own email |
| Inspection Pack | `inspection-pack-ready` | the signed-in user's own email |
| Settings → add staff | `staff-invited` | the new staff member's email |
| Settings → deactivate staff | `staff-deactivated` | that staff member's email |

**Fix — two layers:**

1. **Lock the function down** to service-role callers only, using the same shared helper as item 3. Server-side callers (`payments-webhook`, both reminder jobs, `send-feedback-notification`) are unaffected.
2. **Give the client a narrow replacement.** A new function, `send-app-notification`, that accepts a JWT, and for each of the four allowed templates derives the recipient server-side rather than trusting it:
   - `welcome-trial-start` and `inspection-pack-ready` → always the caller's own email from their JWT.
   - `staff-invited` and `staff-deactivated` → require the caller to manage staff in the org, look the target user up by id, and use the email on record.
   - `organisation_name` and other identity fields are read from the database, not from the request body. Any template name outside the allow-list is rejected.

   Then repoint the four client call sites at it. `Settings.tsx` currently passes `organisation_name: null` (recipients see "your team"), so deriving the real name server-side is a small improvement rather than a regression.

**Risk:** this is the largest change of the five and touches three customer-facing pages. All four sends are already fire-and-forget with a `.catch()` that only warns, so a mistake degrades to "email didn't arrive" rather than a broken screen. I'd verify each of the four by previewing the rendered template before calling it done.

---

## 5. Four database functions with a mutable `search_path`

**Today, confirmed:** `enqueue_email`, `delete_email`, `read_email_batch`, `move_to_dlq` are security-definer functions with no pinned `search_path`. Without one, a name inside the function body can resolve to an object planted in an earlier schema on the path — the standard privilege-escalation shape the Supabase linter flags.

**Fix:** one migration adding `SET search_path = public, pgmq` (or whichever schemas each body actually touches) to all four. Bodies stay identical.

**Risk:** low, but real if a schema is omitted — the function would fail to resolve a name at runtime. I'd read each body first and pin exactly the schemas it references, then run one email through the queue end-to-end to confirm.

---

## Suggested order and shape of work

1. Item 1 — one migration, no app impact.
2. Item 5 — one migration, plus one queue test.
3. Item 2 — one small change in one function.
4. Item 3 — shared helper, two functions, cron credential check.
5. Item 4 — new function plus four client call sites, verified individually.

Items 1 and 5 are migrations you'd approve before anything else runs. Nothing here touches HACCP data, auth, tenant routing, Stripe mapping, or the internal staff console.

## Verification for every item

Typecheck, the 26-test regression suite, a live 401/403 probe against each locked-down endpoint, and re-running the security scan to confirm the findings clear rather than just marking them fixed.
