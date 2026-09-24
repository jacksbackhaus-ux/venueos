# GDPR: Phase A (legal pages) and Phase B (export and anonymise)

This plan covers both of your documents. Phase A gets built exactly as you wrote it. For Phase B, this plan is the "step 0" report you asked for. **Approving this plan counts as your OK for Phase B.** If you want to check the step 0 findings first, reject it with a note and I'll build Phase A only.

## Phase A: legal pages, storage notice, links

Only content and links. Nothing in the database, sign-in, page guards, billing, service worker, offline sync or AI connector changes.

1. **Legal config.** One settings file with: company name, trading name (MiseOS), company number, registered address, contact email (miseos@outlook.com), ICO number (empty, so that line stays hidden) and a last-updated date. Anything I can't confirm from the code goes in as `[PLACEHOLDER]`.
2. **/privacy page.** Public, works signed in or out. Uses the same header and footer as the guides. Covers every section in your brief. The facts come from the real code:
   - **AI services, as found in the code:**
     - Sent to **Anthropic (Claude):** rota suggestions, morning briefing, margin alert and compliance write-up.
     - Sent to **Google Gemini, through the Lovable AI service:** sales matching, sales insights and cashflow insights.
     - Equipment drift check: I'll confirm which service it uses before writing that line.
   - **Health data:** fitness-to-work records (symptoms and exclusion dates) are described as held for the business, and the business is responsible for the lawful basis.
   - **What deletion does:** it's worded to match exactly what Phase B builds. Food safety records keep the name recorded at the time.
3. **/terms page.** UK business-to-business terms under the law of England and Wales, followed by a clearly headed Data Processing Addendum covering the Article 28(3) points.
4. **Cookies and storage section on /privacy.** A table of what's stored on the device, based on the audit:
   - sign-in session
   - chosen site
   - sidebar state
   - messenger notice seen
   - premises setting
   - where to go after login
   - support-access session
   - offline queue (stored on the device)
   - page cache used when offline
   - push notification subscription
   - Stripe fraud-prevention cookies
   - Google Fonts (sends the visitor's IP address to Google)

   Each item in the table is labelled **essential** or **preference**. The sidebar state, messenger notice and premises setting count as preferences, which PECR exempts since 5 February 2026.

   Google Fonts sets no cookies. It's described as sending visitors' IP addresses to Google, and it doesn't count against the "no banner needed" line.

   No analytics tags were found in the app code. Lovable hosting can't be checked from the code.

   The "no banner needed" line stays if every item is essential or a preference. I'll tell you about anything that doesn't fit either.
5. **Links:**
   - Privacy and Terms links in the landing page footer and in the guides/FAQ footer.
   - One consent line under the sign-up button, with no checkbox and no change to how sign-up works.
   - A small "Privacy" link on the email login, Staff ID login and business login pages.
   - The existing "privacy notice" wording on the offline help page gets linked to /privacy.
   - /privacy and /terms added to the sitemap.
6. **Report back:** files changed, every placeholder, the storage table, and any contradictions.

**Conflict to flag now:** the Data Processing Addendum says data is deleted or returned when a contract ends. The Account page and landing page FAQ say "records retained for 7 years". I'll leave a placeholder in the addendum rather than decide this for you.

## Phase B, step 0: findings from the live database

**Your rule 1 against the real delete rules. Differences are in bold.**
- **Cascade delete** (deleting a user wipes these): memberships, org_users, rota_assignments, staff_availability, holiday_requests, training_records, training_individual_assignments, shift_requests (by requester), messenger participants, read receipts, presence, acknowledgements and tasks (assigned_to). This matches your document.
- **Block the delete (NO ACTION):** the food safety record tables you listed, plus shift_staff, shift_tasks, shift_task_completions, feedback_entries, ppm_completions, sales_imports, ingredient_price_history, batch_products, batch_actions, batch_stage_events and rota_assignments (by creator).
- **Different from your document: shift_compensation_logs.user_id is RESTRICT.** It also blocks deletion.
- **Cleared on delete (SET NULL), wider than your document says:** besides retrospective_by and audit_trail, this also applies to:
  - messenger_messages.sender_id
  - production_days (started_by, completed_by)
  - site_events.logged_by
  - rota_audit_trail.actor_user_id
  - sites.owner_user_id
  - feedback, messenger_pins, messenger_tasks.assigned_by, messenger_channels, shift_requests (target/manager), shift_compensation_logs (paid_by/created_by), site_transfers.created_by and users.deactivated_by

  All the more reason never to delete a user.
- **Your rule 2:** the same list stands. I'll also treat production_days, site_events, shift_compensation_logs and rota_audit_trail as records nobody may edit.

**Users table:** email, staff_code and auth_user_id can all be empty. There's no rule forcing a staff code, and no triggers on the table. So email and Staff ID can be cleared completely, and login is impossible without them.

**fitness_to_work rows with no user_id: 0** (the table is empty at the moment).

**Where a person's personal data lives:**
- **Profile:** users (display_name, email, staff_code, hourly_rate, last_login_at), org_users, memberships, notification_prefs, push_devices.
- **Rota and work:** rota_assignments, staff_availability, holiday_requests, shift_requests, shift_staff, shift_tasks, shift_task_completions, shift_compensation_logs, rota_audit_trail.
- **Training and health:** training_records, training_individual_assignments, fitness_to_work (user_id, staff_name, symptoms, notes).
- **Records they logged (ID and name recorded at the time):**
  - temp_logs, cleaning_logs, day_sheets, day_sheet_entries, delivery_logs
  - incidents, pest_logs, maintenance_logs, probe_calibrations, recalls, reviews
  - safe_methods, sfbb_documents, sfbb_system, closed_days, production_days, site_events, waste_logs
  - batches, batch_actions, batch_stage_events
  - feedback_entries, ppm_completions
- **Messages:** messenger_messages (sender_id, sender_name_snapshot, content), plus pins, tasks and acknowledgements.
- **Free-text and JSON:** ai_insights.content, audit_trail.metadata_json, mcp_activity_log (actor_email), email_send_log (recipient_email), email_unsubscribe_tokens, suppressed_emails, admin_actions_log, impersonation_logs.
- **Name-only task templates** (they hold a name, not a user ID): cleaning_tasks.assigned_to_name, ppm_tasks.assigned_to.

**Exactly what anonymise changes, and nothing else:**
- **On that person's user record:**
  - display_name becomes "Former staff member"
  - email and staff_code are cleared
  - anonymised_at and anonymised_by are filled in (two new optional fields)
- **Self-service only, if still active:** status is set to suspended, with deactivated_at and deactivated_by filled in the same way a normal deactivation does it.
- **One new audit entry** ("gdpr_anonymise"), with no names or emails in it.
- **One sign-in account deleted** (email users only). This is skipped if the account is linked to another business.

  Deleting it also removes that account's notification settings and push devices, because those are tied to the sign-in account. That matches your document.

## Phase B build (steps 1 to 3, after approval)

- **Export button:** the existing "Export My Personal Data" button in Settings calls a new export function. The function checks your sign-in on the server, returns one JSON file straight to your browser and doesn't save it anywhere. It writes one audit entry. In Staff ID sessions the button is hidden and shows "Ask your manager to export your data".
- **Manager tools in Settings → Users:** "Export data" on each staff member. "Anonymise" appears in the Deactivated view only.
  - The anonymise function checks on the server that the person being anonymised is not a business owner. It refuses if they are, even when they're deactivated, so a manager can't orphan the business. The button is also hidden for owners, but the server check is what actually protects it.
- **Anonymise:**
  - A new function does all the database changes in one go.
  - It counts linked records before and after, and undoes everything if any count changes.
  - Only after that succeeds does it run the usual seat billing sync and delete the sign-in account.
  - The confirmation dialog asks you to type DELETE, and asks for your password when you're anonymising yourself.
  - The dialog lists the screens that look names up live: training records, rota history, timesheets, holidays, availability and messenger member lists. It says those screens will show "Former staff member" from then on, while food safety logs keep the name recorded at the time.
  - It also suggests exporting the person's data first if the business still needs it with their name, for payroll for example.
  - Business owners are blocked and told to cancel their subscription and contact support.
  - Both actions are blocked during support access and in Staff ID sessions.
- **Screens checked with an empty email or Staff ID:** rota, timesheets, messenger, reports, inspection pack, Staff ID login and the AI connector's staff list. The helper text under the privacy buttons gets updated to match.

## Follow-up: "Report illness" form picks a staff member

- In the Report illness form, the "Who is unwell?" text box becomes a list of this site's active staff. Choosing someone saves both their user ID and their name.
- A "Someone not on the list" option keeps today's type-a-name behaviour.
- Nothing else changes: not the table, the other fields, the Mark cleared button or any existing records.
- **The AI connector's fitness-to-work action:** it accepts an optional user ID and saves it if the assistant passes one. Otherwise it saves nothing, so it's only filled in sometimes. I'm leaving it unchanged, as you asked.

## Final "nothing else touched" check

After both phases I'll give you:
- the list of changed files, showing that none are sign-in, page guard, billing, service worker, offline sync or AI connector files
- the one additive database change (two new optional fields and a new function only)
- a test checklist for a test account
- read-only database checks you can run to confirm record counts haven't changed and nothing has been flagged as a late edit

I won't run export or anonymise on any real customer.
