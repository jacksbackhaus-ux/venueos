## Goal

In `/settings`, owners need a clear place to (a) see all sites in their organisation, and (b) buy/add another site. Pricing for an additional site = the same per-site price as their current plan, **no discount**, on the same monthly/yearly cycle. Production is live — all changes are additive.

## What's already there (no changes needed)

- `subscriptions.site_quantity` already exists and drives per-site Stripe quantity.
- `create-checkout` edge function already accepts `siteQuantity` and uses Stripe quantity-based per-site billing.
- `payments-webhook` already syncs `site_quantity` back into the subscriptions table.
- `customer-portal` edge function already exists for managing the underlying Stripe subscription.
- Pricing model in `src/lib/plans.ts` (Base/Compliance/Business/Bundle, monthly/yearly).

The only existing behaviour we change: when adding sites from Settings, we will **not** apply the existing 15% multi-site coupon — full per-site price as you requested.

## Phase 1 — Edge function (additive, non-breaking)

Update `supabase/functions/create-checkout/index.ts` to accept a new optional flag in the request body:

```ts
{ ..., addSiteMode?: boolean }
```

Behaviour:
- When `addSiteMode === true`: skip the `venueos_multisite_15` coupon block entirely (full price), and stamp `metadata.add_site_mode = "true"` for traceability in Stripe.
- When omitted/false: existing behaviour preserved exactly (so `/account` keeps its 15% discount logic — nothing breaks).

No DB schema changes. No new edge functions.

## Phase 2 — Settings page: new "Sites" tab

Edit `src/pages/Settings.tsx` to add an 8th tab between **Site** and **Account**:

```
[ Temps ][ Cleaning ][ Day Sheet ][ Modules ][ Users ][ Messenger ][ Site ][ Sites ][ Account ]
```

New `<TabsTrigger value="sites">` with `<Building2 />` icon labelled **"Sites"**.

### New component: `src/components/settings/SitesBillingSection.tsx`

Owner-only (gated by `is_org_owner` / `currentMembership.site_role === 'owner'`). Non-owners see a read-only list with a note that only the owner can add sites.

Loads:
1. All sites in `organisation_id` (id, name, address, site_code, created_at).
2. Current subscription row (plan flags, billing_interval, site_quantity, status).

Renders three blocks:

**a) Current sites list**
```
┌─────────────────────────────────────────────────────┐
│ Greenfield Bakery — High St            Code: AB12CD │
│ Greenfield Bakery — Mill Lane          Code: XK93PQ │
└─────────────────────────────────────────────────────┘
2 of 2 sites used on your subscription
```
Shows `sites.length` vs `subscription.site_quantity`. If `sites.length > site_quantity` (shouldn't happen, but defensive), show an amber warning.

**b) Add another site card**
- Heading: "Add another site"
- Shows the live cost calculation for the user's current plan + cycle:
  - "Each additional site: **£X.XX / month**" (or /year), full per-site price, no discount.
  - Brief breakdown of which add-ons are active (Base / +Compliance / +Business / Bundle) and the resulting per-site rate, summed from `PLANS` definitions × the customer's active flags.
- Primary CTA: **"Add a site"** → opens embedded Stripe checkout (existing `EmbeddedCheckoutFlow` component pattern from `/account`) with `{ plan: <derived>, cycle: <current>, siteQuantity: site_quantity + 1, addSiteMode: true, returnUrl: /settings?tab=sites&checkout=success }`.
- The `plan` argument passed to checkout is the plan they currently hold (or `bundle` if they have all three add-ons), so the Stripe subscription updates the existing line, not a new one.

**c) After purchase**
- On `?checkout=success` query param, show a green banner: "New site added — finishing setup…" and poll `subscriptions.site_quantity` for ~10s for the webhook to land.
- Once the count goes up, prompt: "Create your new site" → opens a small dialog to enter name + address, which inserts a new row into `public.sites` (RLS already permits org owners). Site appears in the list with auto-generated `site_code`.

**d) Manage billing**
- Secondary button: "Manage billing in customer portal" → existing `customer-portal` edge function (also lets them remove a site — Stripe handles the proration).

### Routing nicety

Tiny additive change in Settings: read `?tab=` query param on mount and set `activeTab` accordingly so the success redirect lands on the Sites tab.

## Phase 3 — Bookkeeping rules (no DB changes)

- We rely on Stripe quantity as the source of truth; `payments-webhook` already syncs `site_quantity` into the subscription row.
- `org_has_active_access` already gates module access — no change needed.
- The new site row is only created by the user inside the success dialog. We do NOT auto-create a placeholder site, because (a) we cannot guarantee the webhook has fired, and (b) it lets the user name it.
- A defensive guard in the "Create your new site" dialog: only allow inserting a new site if `sites.length < subscription.site_quantity`. Prevents accidental over-creation.

## Files touched

| File | Change |
|---|---|
| `supabase/functions/create-checkout/index.ts` | Accept `addSiteMode` flag; skip coupon when set. |
| `src/pages/Settings.tsx` | Add "Sites" tab trigger + content; honour `?tab=` query param. |
| `src/components/settings/SitesBillingSection.tsx` | **New** — list + add-site purchase flow + manage-billing button. |

No migrations. No changes to `/admin`, `/account`, auth, or RLS.

## Testing checklist

1. Owner on Base monthly with 1 site — Sites tab shows 1 site, "Each additional site: £7.99/month", Add → Stripe embedded checkout opens, pay with `4242 4242 4242 4242`, return to `/settings?tab=sites`, banner appears, `site_quantity` becomes 2 within ~10s, dialog prompts for new site details, new site shows in list.
2. Same but yearly cycle — price shown is `monthly × 10`, checkout passes `cycle: "year"`.
3. Owner with Bundle — calculator uses bundle per-site price, not the sum of add-ons.
4. Non-owner staff/supervisor — sees the site list read-only, no "Add a site" CTA, sees note "Only the organisation owner can add sites".
5. `/account` page checkout still applies the 15% multi-site discount when `siteQuantity > 1` and `addSiteMode` is not sent — regression check.
6. Try to insert a 3rd site row when `site_quantity === 2` from the dialog — blocked client-side with a clear message.
7. "Manage billing" → opens Stripe customer portal in a new tab.
