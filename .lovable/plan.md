# App health audit — findings only (nothing changed)

Checks run: TypeScript typecheck (clean), 26 tests (all pass), database linter (243 warnings), live RLS/grant/policy inspection, foreign-key index inspection, scheduled-job inspection, backend function auth review, browser console review, data-integrity queries.

Nothing is currently broken in a way that stops customers using the app. Below is what I'd class as weak, unwired, or a future breakage risk.

## Likely to cause real problems

1. **Scheduled site-transfer job can be triggered by anyone.**
   The nightly `site-transfer-cleanup` job is called with only the public API key, and the function itself does no caller check before archiving sites. Anyone who knows the URL could run it. It only archives already-expired transfers, so impact is limited, but it should require a shared secret.

2. **Organisations with no subscription row get unlimited access.**
   The access guard treats "no subscription record" as "allow everything". Normally a record is created at signup, so this is a silent fallback — if that ever fails, the org gets the whole product free with no lock screen and no signal to you.

3. **~100 foreign keys have no index** (mostly `organisation_id`, `site_id`, `*_by_user_id`, and parent links like `day_sheet_id`, `import_id`, `shift_id`).
   Fine at today's volume (5 orgs, 187 temperature logs). As customers grow, list screens, the Inspection Pack and HQ dashboard will slow down noticeably, and deletes on parent rows will get expensive.

4. **Email queue has no scheduled dispatcher.**
   Trial reminders and compliance reminders are on schedules, but nothing periodically drains the email queue — it relies on a database trigger firing at insert time. If a send fails and gets retried later, there's no timer to pick it back up, so retried emails can sit in the queue indefinitely.

## Security hygiene (low exploitability, worth cleaning)

5. **Public read grant on nearly every table.** Anonymous visitors hold table-level SELECT on almost all tables. They're saved only by row policies — no policy allows anonymous rows (I verified there are zero `true` policies), so nothing leaks today. But it means one careless future policy exposes data instead of failing safe.

6. **Anonymous users can call ~50 privileged database functions**, including the internal staff ones (`staff_get_customer_360`, `staff_list_all_organisations`, `start_internal_impersonation`). They all self-check internal-staff status and reject, so they're not exploitable now — but the permission shouldn't exist.

7. **Four queue helper functions have no fixed search path** (`enqueue_email`, `delete_email`, `read_email_batch`, `move_to_dlq`) — the classic privilege-escalation shape the linter flags.

## Code quality / drift risk

8. **`src/lib/reports.ts` bypasses type safety 30 times** (`as any` on table names, plus 23 `select("*")`). This is exactly the code that produced the earlier Inspection Pack field-mapping bug: rename a column and this file breaks silently at runtime instead of at build time. Highest-risk file in the app.

9. **Hidden modules still have live routes.** Shifts, Timesheets, Waste Log, Profit & Pricing, Tips, Messenger are hidden from navigation but reachable by URL. They do show a "module not active" card rather than real data, so this is cosmetic, not a leak.

10. **Stray file in the project root: `PestMaintenance.tsx`** — a 15-line scratch fragment, not imported anywhere. Dead weight, should be deleted.

11. **Two React warnings on the landing page** — the `Section` and `Footer` components are handed refs they don't forward. Harmless today, but it means scroll/anchor behaviour on those elements silently does nothing.

12. **Unbounded report queries.** Several Inspection Pack queries have sensible limits, but others read whole tables for a site. For a busy site after a year of logs, PDF generation will get slow or run out of memory in the browser.

## Verified healthy

- No orphaned sites, no users without an organisation, no duplicate subscription rows, no active subscriptions missing a Stripe link.
- Row-level security is on for every table, every table has policies, and no policy is wide open.
- All billing and admin backend functions verify the caller and check owner/internal-staff role before acting.
- No secrets, service keys, or Stripe keys anywhere in the frontend code.
- Storage buckets are private except the logo bucket, which is intentionally public.
- Realtime subscriptions are cleaned up correctly.

## If you want me to fix these later

Suggested order: 1 and 2 first (correctness and revenue), then 3 (indexes, cheap and pre-emptive), then 8 (type-safety of the Inspection Pack), then 5/6/7 as a security-hygiene pass, then 4, then the cosmetic items 9-12. Say the word and I'll plan any subset.
