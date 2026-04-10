# Project Memory

## Core
Mobile-first bakery food safety app. Clean Clinical palette: #fafbfc/#e8ecf1/#2563eb/#16a34a. Sora headings, Manrope body. Sidebar nav desktop, bottom tabs mobile. UK Food Hygiene Rating focus (3 pillars).
Multi-tenant SaaS: Organisation > Site > User. Email magic link for owners, staff code for staff. Supabase RLS enforced.
Billing: £4.99 base + £2/extra site + £1/HQ user. Stripe TBD.

## Memories
- [App modules](mem://features/modules) — Full list of 10+ modules and their purpose
- [Design tokens](mem://design/tokens) — Custom tokens: success, warning, breach, font vars
- [Auth architecture](mem://features/auth) — Multi-tenant auth model, RLS helpers, signup/login flows, context providers
- [Batch tracking](mem://features/batches) — batch_templates, batches, batch_stage_events tables with stage progression
- [HQ & billing](mem://features/hq) — HQ dashboard for org-level oversight, account page with pricing model
