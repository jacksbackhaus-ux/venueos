
# Migrate to plan_tier-only subscription model + batch number redesign

Big change set, split into 7 ordered parts. Migrations come first so types regenerate before code is updated.

## Current state (from code review)

- `subscriptions` table already has a `tier` column (`essentials | professional | business_tier | intelligence`) and legacy booleans `base_active`, `compliance_active`, `business_active`, `bundle_active`, `ai_active`.
- `sync_org_modules` (Postgres function) is driven entirely by the legacy booleans.
- `payments-webhook` (edge function) sets BOTH `tier` and the legacy booleans on every Stripe event.
- `create-checkout` accepts both legacy plans (`base|compliance|business|bundle|ai`) and tier plans (`essentials|professional|business_tier|intelligence`).
- `useOrgAccess` (frontend) reads the legacy booleans.
- `Batches.tsx` uses an auto-generated `batch_code` (PROD-YYYY style); has `recipe_id` foreign key but no `recipe_number` field on the batch itself.

The task says `plan_tier` — we'll **reuse the existing `tier` column** (same purpose, already wired through). The user's value `'business'` maps to our existing enum value `'business_tier'`. We'll keep the DB enum as-is to avoid breaking existing rows and just present it as "Business" in UI.

---

## PART 1 — DB schema: plan_tier as source of truth (migration)

One migration that:

1. Adds `billing_interval TEXT` ('monthly'|'annual') if missing — already have `billing_interval` (month/year). Normalise: add CHECK to allow both legacy values, prefer 'month'/'year' (already in use, don't break webhook).
2. Adds NOT NULL default `tier = 'essentials'` only for rows where tier is null AND a legacy flag is set, using this map:
   - `ai_active` true → `intelligence`
   - `bundle_active` true → `business_tier`
   - `business_active` true → `business_tier`
   - `compliance_active` true → `professional`
   - `base_active` true → `essentials`
   - else leave null (still in trial / no paid plan)
3. Rewrites `sync_org_modules(_org_id uuid)` to derive purely from `tier`:
   - essentials: temperatures, day_sheet, cleaning, shifts, timesheets, messenger, waste_log, customer_feedback
   - professional: essentials + allergens, suppliers, pest_maintenance, incidents, batch_tracking, staff_training, haccp, ppm_schedule
   - business_tier: professional + cost_margin, tip_tracker, reports
   - intelligence: business_tier + ai_insights
   - tier IS NULL (trial) → essentials modules (so trial users see something)
   - status in ('canceled','past_due' beyond grace) → all off
4. Updates `trg_sync_modules_on_sub_change` to fire on `tier` change (not legacy booleans).
5. Re-runs `sync_org_modules(org_id)` for every organisation.
6. Adds RPC `resync_org_modules(_org_id uuid)` callable by org_owners + super_admins only.

## PART 2 — Stripe edge function cleanup

`supabase/functions/payments-webhook/index.ts`:
- Remove writes to `base_active`, `compliance_active`, `business_active`, `bundle_active`, `ai_active` (keep columns intact, just don't write).
- Resolve `tier` from the lookup_key via `TIER_MAP` (existing) — for legacy lookup_keys (`venueos_*`) map them onto the closest tier:
  - `venueos_bundle_*` → `business_tier`
  - `venueos_business_*` → `business_tier`
  - `venueos_compliance_*` → `professional`
  - `venueos_base_*` → `essentials`
  - `venueos_ai_*` → upgrade to `intelligence` if the existing row is `business_tier`, otherwise leave tier alone (legacy AI-only add-on)
- Persist only: `tier`, `billing_interval` (interval), `status`, `current_period_*`, `trial_end`, `cancel_at_period_end`, `site_quantity`, `stripe_*`, `environment`.

`supabase/functions/create-checkout/index.ts`: no changes needed (lookup_key lookups still work; webhook handles the rest).

## PART 3 — Frontend access hook

Rewrite `src/hooks/useOrgAccess.tsx` so its returned booleans come from `tier`:

```ts
const hasEssentials   = tier !== null;
const hasCompliance   = ['professional','business_tier','intelligence'].includes(tier);
const hasBusiness     = ['business_tier','intelligence'].includes(tier);
const hasIntelligence = tier === 'intelligence';
```

Keep the existing public shape (`hasBase`, `hasCompliance`, `hasBusiness`, `hasAI`, plus new `hasIntelligence`/`hasEssentials` aliases) so callers don't break. Stop reading the legacy boolean columns.

`useModuleAccess` (per-site `module_activation`) stays the final UI gate — unchanged.

## PART 4 — Subscription Diagnostics page

New page `src/pages/SubscriptionDiagnostics.tsx`, route `/account/diagnostics`, linked from Account page (manager + org_owner only via existing `RoleGuard`):

- A) Subscription row: org id, tier (rendered as "Business" when DB has `business_tier`), billing_interval, status, trial_end, stripe_customer_id, stripe_subscription_id, updated_at.
- B) Expected modules grouped by category (computed from tier client-side using same map as the SQL function).
- C) Actual `module_activation` for current site.
- D) "Re-sync modules" button → calls new RPC `resync_org_modules(org_id)`; refetches both.
- E) Health-check badge: green when expected==actual, red with a per-module mismatch list otherwise.

## PART 5 — Pricing & Account UI cleanup

- `src/pages/Pricing.tsx`: show only the four tiers. Remove any legacy add-on toggles (compliance/business/ai_active checkboxes) if present.
- `src/pages/Account.tsx`: render tier label (Essentials/Professional/Business/Intelligence) from `tier`, not from booleans. Add link to Diagnostics.
- Anywhere that reads `ai_active` for UI gating, switch to `hasIntelligence` from `useOrgAccess`.

## PART 6 — Batch Tracking: batch number from Product + Recipe #

Migration:
- Add `recipe_number INTEGER` to `batches` (nullable for existing rows).
- Add partial unique index `(site_id, lower(product_name), recipe_number, produced_date) WHERE recipe_number IS NOT NULL`.

`src/pages/Batches.tsx`:
- Add a **Recipe number** input (required for new batches) in create/edit dialogs.
- Live preview of generated batch number: `{titleCased(product_name)} - {String(recipe_number).padStart(3,'0')}`.
- Save `recipe_number` on the row.
- List cards: primary = product name + quantity (unchanged), secondary = generated batch number (replaces `batch_code` as the visible "batch number"). Legacy `batch_code` shown as a small "Internal ID" line.
- Helper `formatBatchNumber(name, n)` in a new `src/lib/batchNumber.ts`.

Existing rows without `recipe_number` keep using legacy `batch_code` for display (no data loss).

## PART 7 — Verification

After code lands:
1. Read DB to confirm `sync_org_modules` rewrite ran and `module_activation` is consistent for at least one org per tier.
2. Open Diagnostics page in preview → expect green health check.
3. Open Batch Tracking → create a test batch with recipe number 6 → confirm "Product - 006" renders.

---

## Files touched

**Migrations (1):** plan_tier backfill, `sync_org_modules` rewrite, `resync_org_modules` RPC, `batches.recipe_number` + unique index, re-sync trigger.

**Edge functions:** `supabase/functions/payments-webhook/index.ts` (stop writing legacy flags).

**Frontend:**
- `src/hooks/useOrgAccess.tsx` (rewrite)
- `src/pages/SubscriptionDiagnostics.tsx` (new)
- `src/pages/Account.tsx` (link + label cleanup)
- `src/pages/Pricing.tsx` (remove legacy add-on UI if any)
- `src/pages/Batches.tsx` (recipe number field, generated batch number)
- `src/lib/batchNumber.ts` (new helper)
- `src/App.tsx` (route)

**Out of scope:** changing the DB enum value `business_tier` → `business` (would require touching every reference; the UI label stays "Business" so users never see the suffix).
