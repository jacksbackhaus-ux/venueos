## Goal
Allow Managers/Owners to edit past-day records on Temperature Logs, Day Sheet, and Cleaning Logs. Staff/Supervisors remain locked out of past days. Every retrospective write is tagged, audited, and surfaced in exports.

## Scope
- **Tables affected:** `temp_logs`, `day_sheets` (and per-question/section rows), `cleaning_completions`
- **Pages affected:** `TemperatureTracking.tsx`, `DaySheet.tsx`, `Cleaning.tsx`
- **Exports:** `reportPdf.ts`, `ReportExcel.ts`, `reports.ts`

---

## Part 1 — Database (migration)

Add to each of `temp_logs`, `day_sheets` (or `day_sheet_completions`), `cleaning_completions`:
- `is_retrospective BOOLEAN NOT NULL DEFAULT false`
- `retrospective_note TEXT` (e.g. "Retrospectively updated by Jane Smith on 2026-05-15")
- `retrospective_by UUID REFERENCES users(id)`
- `retrospective_at TIMESTAMPTZ`

Update RLS:
- Existing UPDATE policies on these tables tighten so non-managers can only update rows where the record's date = today.
- Managers (org_owner / site owner via `is_site_supervisor_or_owner` + check `is_org_owner`) can update past-dated rows.
- Add a trigger that, on UPDATE/INSERT where the row's date < today, requires `is_retrospective = true` and auto-stamps `retrospective_by/at` to `auth.uid()` (via `get_app_user_id()`).
- Audit trail row written by trigger (insert into existing `audit_trail` table).

## Part 2 — Frontend gating

Helper: `useCanEditDate(date)` returns:
- `canEdit` (boolean)
- `isRetrospective` (boolean, true when editing a past day as manager)
- `lockedReason` (string for non-managers)

In each of the three pages:
- When viewing a past date:
  - Staff/Supervisor: form inputs disabled, show muted "Past day — read only" notice.
  - Manager: inputs editable, show **amber banner** at top: "⚠️ Retrospective edit mode — changes will be tagged and visible in the audit trail." Use `bg-warning/10 border-warning text-warning-foreground`.
- On save mutation when `isRetrospective`, set `is_retrospective: true` and `retrospective_note: \`Retrospectively updated by ${displayName} on ${todayISO}\`` in the payload (server trigger also enforces).

## Part 3 — Visibility

- In list views (e.g. temp log entries, completed cleaning tasks), show a small amber `Badge` "Retrospective" next to entries where `is_retrospective = true`. Tooltip shows the note.
- Day sheet header shows banner if any entry on that day is retrospective.

## Part 4 — Exports (PDF + Excel)

- `reports.ts`: include the new `is_retrospective`, `retrospective_note` columns when fetching temp logs, day sheets, cleaning completions.
- PDF (`reportPdf.ts`): in each evidence table, append a "Notes" column or annotation: rows where `is_retrospective` get an italic "(Retrospective — updated by X on Y)" line. Add a summary count in the Executive Summary: "Retrospective entries: N".
- Excel (`ReportExcel.ts`): add columns `Retrospective` (Yes/No) and `Retrospective Note` to Temperature, Day Sheets, and Cleaning sheets. Add row in Overview sheet for total retrospective count.

## Part 5 — Audit trail

DB trigger inserts `audit_trail` rows with `action = 'retrospective_update'`, entity type/id, and `metadata_json` containing the original date, who edited, and a diff snapshot (before/after values).

---

## Technical details

- Migration order: add columns first, then trigger function `tag_retrospective_edit()`, then attach BEFORE INSERT/UPDATE triggers per table.
- Use existing `get_app_user_id()` helper inside trigger to resolve actor.
- Use existing `is_org_owner(org_id)` / membership owner check in RLS policy expressions.
- Frontend role check: `useRole().isManager` (already covers org_owner + site owner).
- "Today" in trigger uses `current_date` in the site's timezone — for now use UTC `current_date` to match existing behaviour; revisit if site TZ becomes a concern.

## Out of scope (explicit)
- Other modules (allergens, HACCP, deliveries, incidents, waste, training, PPM) — not requested in this turn.
- Hard-edit of locked/verified day sheets — keep existing lock semantics; retrospective edits still respect `locked_at`.
