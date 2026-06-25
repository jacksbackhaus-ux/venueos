
# MiseOS HACCP Launch — Implementation Plan

Massive but additive change. Nothing deleted; everything non-HACCP hidden behind a single feature flag. HACCP/compliance logic, auth, internal staff console, and DB schemas remain untouched.

## 1. Central feature flag

Create `src/lib/launchFlags.ts`:
- `LAUNCH_MODE = "haccp"` (single source of truth)
- `showAIFeatures = false`
- `showCommercialModules = false` (shifts, timesheets, batches, waste, cost-margin, tips, sales)
- `showMultiSiteHQ = false`
- `VISIBLE_MODULES` set used by sidebar + module guards
- `isModuleVisible(slug)` helper

Hidden modules: shifts, timesheets, batches, waste-log, cost-margin, tip-tracker, sales, hq, plus AI widgets.
Visible: dashboard, day-sheet, temperatures, cleaning, compliance, haccp, allergens, suppliers, incidents, pest-maintenance, ppm, staff-training, customer-feedback, reports (inspection pack), messenger, settings.

Internal staff console + impersonation bypass the flag entirely (already a separate layout).

## 2. Stripe products & pricing

Archive old products by leaving them in place; create new product `miseos_haccp` with 4 prices via `payments--batch_create_product`:
- `miseos_haccp_site_monthly` £4.99/mo
- `miseos_haccp_site_annual` £49.90/yr
- `miseos_haccp_user_monthly` £1/mo (quantity = additional users)
- `miseos_haccp_user_annual` £10/yr

Update `supabase/functions/create-checkout/index.ts` to accept the new plan id `haccp` and create a checkout session with two line items (site + user qty). Keep legacy plan keys mapped so existing customers keep renewing on their old subs.

## 3. Customer migration (non-destructive)

Migration: add `tier = 'haccp'` (extend `TierId`) and set `subscriptions.tier = 'haccp'` for all currently-active orgs that have any access. Preserve trial_end, current_period_end, stripe ids, billing history. No charges, no deletions.

## 4. Plans/tier code

- `src/lib/plans.ts`: add `haccp` tier with allowedModules = VISIBLE_MODULES.
- `src/hooks/useOrgAccess.tsx`: map `haccp` tier to a `PlanState` granting compliance modules.
- `src/hooks/useModuleAccess.tsx`: gate by `isModuleVisible` when LAUNCH_MODE = haccp.

## 5. Roles

Add `useEffectiveRole` mapping: `owner` → Owner/Admin, anything else (`supervisor`, `read_only`) → treated as Owner if customer-set; `staff` stays Staff. Hidden roles preserved in DB enums and code. UI invite form shows only Owner/Staff but accepts legacy values.

## 6. Navigation / Dashboard

- `AppSidebar.tsx`: filter items by `isModuleVisible`.
- `More.tsx`: same filter.
- `App.tsx`: keep all routes (so re-enabling flag works); just hide from nav.
- `Dashboard.tsx`: hide `ProfitSnapshot`, AI widgets when flag off; keep SafeToTrade, PriorityFeed, Today, ThisWeek.

## 7. Account & Billing

`SitesBillingSection.tsx` (and Account.tsx): show MiseOS HACCP card with site count × £4.99 + extra users × £1, monthly/annual toggle, cancel-at-period-end, carbon pledge line. Hide old tier upgrade UI behind flag.

## 8. Landing + Pricing pages

Rewrite `src/pages/Landing.tsx` and `src/pages/Pricing.tsx` to HACCP positioning, single plan, FAQ, carbon pledge. Remove AI/Margin/Sales copy.

## 9. AI hiding

Wrap `MorningBriefingCard`, `SalesInsightsCard`, `MarginWatchdogCard`, `CashflowInsightsCard`, `WasteInsightStrip`, `AIRotaSuggestButton`, `SmartRotaPanel`, smart-fill, AI narrative buttons in `{showAIFeatures && ...}`. Server functions untouched.

## 10. Verification

- HACCP module files not edited.
- Auth files not edited.
- Staff console (`src/pages/staff/*`, `StaffLayout`) not edited.
- Re-enabling flag (`LAUNCH_MODE = "full"`) restores prior UI.

## Technical notes (for engineers)

- Single flag file imported wherever modules are listed.
- DB migration: `ALTER TYPE` for tier enum if it's a Postgres enum, else just a text value; mark old subs with `tier='haccp'` only for currently-trialing/active rows (don't touch canceled history).
- Stripe webhook (`payments-webhook`) already writes `tier` from price metadata; add `miseos_haccp_*` lookup keys → `tier='haccp'`.
- Quantity on `miseos_haccp_user_*` line item = `max(0, total_users - 1)`.

## Out of scope (explicit)

- No edits to: HACCP plan, day sheet, temperatures, cleaning, allergens, suppliers, incidents, pest, PPM, training, feedback, inspection pack, messenger, auth, branded login, staff console, impersonation, multi-site data model.

## Risk

This touches ~25 files in one go. I'll batch edits and avoid HACCP/auth/staff paths. Stripe products created in sandbox; user must approve DB migration before it runs.

Approve to proceed and I'll execute end-to-end.
