# SFBB compliance completion

## What the modules already support (inspected)

**Temperatures** (`src/pages/TemperatureTracking.tsx`, `temp_logs` / `temp_units`)
- Already has storage checks (fridge/freezer units, AM/PM/Spot smart check type, min/max pass/fail, corrective-action step, retrospective tagging).
- Already has a **Food & Process Checks** section with Cooking, Reheating, Hot Holding, Cooling and Delivery, each with food item, keypad reading, pass/fail vs target and corrective action. These are stored in `temp_logs` with `unit_id = null` and `log_type` = process name.
- Missing: safe **time/temp combinations** for cooking (only a flat ≥75°C target), and **probe calibration** records entirely.

**HACCP Plan** (`src/pages/Haccp.tsx`, `haccp_plans` / `haccp_steps`)
- Covers the 7 HACCP principles (hazards, CCPs, critical limits, monitoring, corrective actions, verification, records) as free-text steps.
- Does **not** capture the SFBB safe-method set (cross-contamination, cleaning, chilling, cooking, management) nor a Safe Method Completion Record. This is a genuine gap, so it becomes a second tab in the existing HACCP page rather than a new module.

**Compliance Overview** (`src/pages/Compliance.tsx`) — readiness hero + quick actions, no tabs yet; the Reviews card slots in here.
**Batches** (`src/pages/Batches.tsx`) — already tabbed (Batches / Markets & events) with a batch action system; recall becomes an action plus a third tab.
**Staff Training** (`src/pages/StaffTraining.tsx`) — 3 tabs (Team / Individual / Trainings); Fitness to work becomes a fourth tab.
**Inspection Pack** (`src/lib/reports.ts` → `reportPdf.ts`) — already premises-aware with registration, kitchen setup, production days and site events; new sections append to the same fetch + PDF.

## Schema (additive only)

| Table | Purpose |
|---|---|
| `reviews` | periodic SFBB review: period_start/end, production_days_covered, status, problems_observed, problems_detail, action_taken, checklist jsonb, completed_by/at |
| `probe_calibrations` | probe_name, iced_water_reading, boiling_water_reading, pass, calibrated_by/at, notes |
| `fitness_to_work` | staff_name/user_id, reported_date, symptoms, excluded_from, cleared_to_return, status, notes, recorded_by |
| `safe_methods` | site_id, method_key, category, status ('to_do' \| 'documented' \| 'not_relevant'), how_text, updated_by/at (unique per site+key) |
| `recalls` | item_type, item_ref, reason, source, affected_batch_ids jsonb, action_taken, customers_informed, recorded_by |

Each table: site + org scoping, GRANTs, RLS via the existing `has_site_access` / `has_site_write_access` helpers, `created_at`/`updated_at` with the existing touch trigger. Nothing existing is altered. Process temp checks reuse `temp_logs` — no new table.

## Part 1 — Periodic review

- New `Reviews` card at the bottom of Compliance Overview: current period status, "Start review" / "Continue", and a list of completed reviews (date + who).
- Cadence in a new `src/lib/reviewCadence.ts`: scheduled → 4 calendar weeks from the last completed review (or from site creation); on_demand → 20 production days counted from `production_days`, or 3 months elapsed, whichever hits first. Non-production and closed days simply do not count toward the 20.
- Review sheet: the 13 SFBB questions as yes/no + optional note, plus problems observed / detail / action taken. Completable with zero problems in a few taps.
- Priority feed: **one** consolidated item "Your 4-weekly review is due" (worded "periodic review" for on_demand), grouped like existing items so it never duplicates; dismissible for the day.
- Backfill safety: for existing sites the first period starts at the migration date, so nothing is retroactively overdue.

## Part 2 — Process temps + probe calibration

- Extend the existing Cooking process dialog with the safe time/temp combos (80°C/6s, 75°C/30s, 70°C/2min, 65°C/10min, 60°C/45min) — chosen combo determines pass/fail and is stored in the existing `corrective_action`/note path plus food item text. No new process types needed; the other four already exist.
- New collapsible "Probe calibration" card on the Temperatures page: iced-water and boiling-water readings, auto pass (-1…1 / 99…101), optional probe name and notes, plus a history list.
- Gentle single dismissible reminder if no calibration in the last month (Compliance/dashboard item, never a failure).
- Irrelevant process types stay visible but are never counted as missing.

## Part 3 — Fitness to work

- Fourth tab in Staff Training: "Fitness to work". Records list, "Report illness" sheet (staff picker or free-text name, symptoms, excluded from date), and "Mark cleared to return" with `symptom end + 48h` auto-suggested.
- Low profile for single-user sites: tab still present, empty state explains the 48-hour rule.

## Part 4 — Documented safe methods

- Second tab inside the HACCP page: "Safe methods", grouped by the five SFBB categories, each method a row with status chip and a sheet holding "How do you do this?".
- Completion overview bar (documented / not relevant / to do) mirroring SFBB's completion record.
- Premises-aware default set from `src/lib/premises.ts`: home/mobile get a leaner relevant list (acrylamide offered for bakery, hot holding available but not suggested); commercial/production get the full set. Rows start as "to do" and are never treated as failures or scored.

## Part 5 — Product withdrawal & recall

- "Flag for withdrawal/recall" added to the existing batch action menu, plus a "Recalls" tab in Batch & Traceability for ingredient/product-level records.
- Recall sheet: reason, source, affected batches (pre-filled from the batch, otherwise multi-select; ingredient-linked batches suggested via existing recipe/ingredient links), action taken, customers informed toggle.

## Part 6 — Inspection Pack

`fetchReportData` gains parallel fetches for reviews, process temp logs, probe calibrations, fitness-to-work, safe methods and recalls; `reportPdf.ts` gains six sections after the existing evidence, worded per premises type (production/trading day framing for home & mobile, daily for commercial/production). Per site, never combined. New sections omit themselves when empty so existing customers' packs look unchanged.

## Technical notes

- One migration for the five tables; no changes to billing, auth, routing, or staff-console tables.
- No new routes or nav entries: Reviews → `/compliance`, probe calibration → `/temperatures`, fitness to work → `/staff-training`, safe methods → `/haccp`, recalls → `/batches`.
- Reminders route through the existing `usePriorityFeed` grouping and the existing `promptDismissed`/`dismissPrompt` helpers.
- Scoring in `reports.ts` stays untouched, so no score regressions.

## Known friction

- Recall from an *ingredient* requires the user to confirm affected batches when no recipe→batch link exists — a multi-select step is unavoidable for a truthful traceability record.
