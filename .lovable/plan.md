# Foundational Inspection Pack data fixes — implementation plan

## Scope and constraints

Plan three additive changes before the new Inspection Pack PDF:

1. trustworthy allergen “contains / may contain / unknown” evidence;
2. a separately timestamped and attributed four-stage incident chain;
3. historically accurate temperature and cleaning expectations.

No destructive migration, no rewrite of existing evidence, no auth/login/session changes, and no change to current account behavior. Existing rows remain readable. New fields and tables use existing organisation/site boundaries and role checks.

## Confirmed current state

- The allergen screen derives recipe **Contains** values from `ingredients.allergens` through `recipe_ingredients`. A dash currently conflates “not recorded” with “does not contain.” There is no persisted “Handled in this kitchen” declaration and no persisted supplier or recipe-level precautionary allergen assessment.
- The current database has 14 ingredients; eight have at least one declared allergen. It has nine recipes, none approved or marked reviewed. Existing data therefore cannot safely be treated as explicitly allergen-free.
- Incidents currently store reported identity/time and verified name/time. The UI moves directly from `open` to `action-taken` to `verified`; “Mark fixed” and “Confirm fixed” do not collect separate resolution, corrective-action or verification evidence. There are currently no incident records, simplifying rollout but not removing the need for legacy compatibility.
- Temperature units and cleaning tasks store present-day `active`, configuration, `created_at` and optional `deleted_at`. Activation/deactivation and edits do not retain effective periods. Temperature checks infer AM, PM and then spot checks; cleaning uses daily/weekly/monthly buckets. Multiple dashboards, operational screens, reports and the customer connector query only currently active records.
- One temperature unit and one cleaning task are inactive without deletion. There are no deleted examples in the live data. Their earlier active periods cannot be reconstructed reliably from current columns.

---

# 1. Allergen cross-contact and “may contain”

## Recommendation

Use a **four-layer model**, because “contains,” a supplier warning, the fact that an allergen is handled on site, and a product-specific residual cross-contact risk are different facts:

1. **Ingredient contains declaration** — what is deliberately present in the ingredient. Extend the existing concept with assessment state and provenance.
2. **Ingredient supplier precautionary declaration** — named allergens from the supplier’s “may contain” statement, recorded separately from ingredients that contain them.
3. **Site handled-allergen register** — allergens present somewhere at this site. This identifies assessments that need attention; it must never automatically add “may contain” to every product.
4. **Recipe/product cross-contact assessment** — the business’s documented, product-specific decision after considering ingredients, supplier warnings, shared areas/equipment/processes and controls. Only this assessment produces the final product-facing “may contain [named allergens]” result.

Site-wide handling is a risk prompt, not proof of residual risk in a particular product. Automatically applying every site allergen to every recipe would over-warn customers and would not represent a product-specific risk assessment.

## Additive data model

### Ingredient declarations

Add nullable assessment metadata to `ingredients`:

- `allergen_assessment_status`: `not_assessed | assessed`;
- `allergen_assessed_at`;
- `allergen_assessed_by_user_id` plus denormalised assessor name;
- `allergen_source_type`: supplier label/specification, manufacturer information, business assessment, or other;
- `allergen_source_reference` and optional source/review date;
- `supplier_pal_allergens`: named precautionary allergens, separate from the existing `allergens` array.

Existing ingredient rows start as **not assessed**, even when their current allergen array is empty. Existing non-empty `allergens` remain visible as recorded “contains” information, but the ingredient still needs review before the system claims the assessment is complete.

### Site handled-allergen register

Add a site-scoped declaration table with one row per allergen:

- organisation/site/allergen;
- state: `handled | not_handled | not_assessed`;
- reason/source note;
- assessor identity/name and assessment time;
- review due date and updated time.

Do not derive `not_handled` from absence. An untouched row is `not_assessed`.

### Recipe cross-contact assessment

Use a parent assessment plus per-allergen decisions rather than arrays on `recipes`:

- assessment: recipe, site/org, status (`draft | complete | needs_review`), assessor identity/name, assessed/review dates, process summary and general controls;
- per-allergen decision: `not_assessed | no_identified_risk | risk_controlled | residual_risk_pal_required`;
- risk sources: supplier PAL, shared storage, shared equipment/surface, airborne/dust, shared fryer/oil, rework, production sequence, or free-text other;
- controls and rationale;
- optional supplier-warning override with required written justification and reviewer attribution.

The effective output is computed, not manually duplicated:

- **Contains:** union of assessed ingredient “contains” declarations;
- **May contain:** named allergens with a completed recipe decision of `residual_risk_pal_required`, plus supplier PAL unless a documented assessment explicitly supersedes it;
- **Unknown / not assessed:** any incomplete ingredient, unresolved supplier warning, or incomplete recipe decision relevant to that product;
- **Not declared present:** only after the required assessment is complete. It must not be presented as “safe,” “allergen-free,” or a guarantee of absence.

Store assessment revisions or immutable decision history so a later supplier/process change does not erase the basis for an earlier label or Inspection Pack.

## Owner workflow

1. **Set up the kitchen declaration:** on Allergens, an owner/manager reviews all 14 allergens as Handled, Not handled, or Not assessed. The current conceptual “Handled in this kitchen” list becomes this explicit, attributed register rather than a derived display.
2. **Review each ingredient:** copy “contains” and supplier “may contain” information from the current pack/specification, record the source and confirm the assessment. Empty selections cannot be saved as “none” without an explicit assessed confirmation.
3. **Assess each recipe:** show automatically gathered contains allergens, supplier warnings and site-handled prompts. For each relevant allergen, ask where cross-contact could occur, which controls apply, and whether residual risk remains.
4. **Resolve warnings deliberately:** the owner may carry the supplier PAL through or document why a product-specific risk assessment supersedes it. No silent override.
5. **Approve and review:** approval records who/when. Ingredient, supplier, recipe/process or site-handled changes mark affected recipe assessments `needs_review`; until re-approved, outputs display Review/Unknown.

Matrix states must be explicit and accessible:

- filled mark + **Contains**;
- hollow mark + **May contain**;
- neutral mark + **Assessed — not declared present**;
- dashed question mark + **Not assessed**.

The current green “No allergens” badges must not remain for unassessed legacy rows.

## Safety rules

- Never infer “may contain” solely from site-wide handling.
- Never infer absence from an empty array or blank form.
- Never use generic “may contain allergens”; name the allergen(s).
- Never combine a product’s “free-from X” claim with “may contain X.” If free-from claims are introduced, require a separate reviewed workflow.
- Changes to suppliers, ingredient declarations, recipe composition or cross-contact controls invalidate affected assessments.
- The application supports the business’s assessment; it must not claim MiseOS has certified the product safe.

## UK guidance review flag

Official FSA guidance says precautionary allergen labelling should follow a documented risk assessment where a real cross-contact risk remains after controls; it should not replace good controls or be used indiscriminately. Supplier warnings should normally be passed on unless a documented assessment justifies otherwise. Food Standards Scotland similarly emphasises segregation, cleaning and process controls.

Before release, have a qualified UK food-safety professional review:

- the exact decision questions and customer-facing labels;
- supplier-warning override wording/evidence;
- what constitutes a sufficient completed assessment;
- PPDS, non-prepacked and Scotland-specific presentation;
- any future “free-from” or NGCI claim.

Relevant official sources to use during copy review:

- FSA precautionary allergen labelling: https://www.gov.uk/food-labelling-and-packaging/precautionary-allergen-labelling-pal
- FSA technical allergen guidance, revised March 2025: https://www.food.gov.uk/business-guidance/food-allergen-labelling-and-information-requirements-technical-guidance-part-1-guidance-for-businesses-providing-prepacked-food
- Food Standards Scotland, managing allergens: https://www.foodstandards.gov.scot/business-guidance/running-a-food-business/managing-allergens

This is a product/data recommendation, not legal advice.

## Testing

- Every legacy ingredient/recipe renders Unknown, never “none.”
- Contains and supplier PAL remain separate through nested ingredients.
- A site-handled allergen creates an assessment prompt but not an automatic PAL claim.
- A supplier PAL carries through unless a completed, attributed override exists.
- Changes invalidate affected approvals.
- Matrix, label preview and eventual PDF use the same derivation function.
- Role/site/RLS tests prove one organisation cannot view or change another’s assessments.

## Effort

**7–10 developer days**, plus external food-safety review time. This includes additive schema/RLS, migration defaults, site/ingredient/recipe workflows, derivation, invalidation, audit history and tests. Allow another **2–4 days** if document uploads/versioned supplier specifications are required immediately.

---

# 2. Incidents: full four-stage chain

## Recommendation

Use a **hybrid model**:

- additive snapshot fields on `incidents` for simple filtering/export;
- an append-only `incident_stage_events` table as the authoritative audit timeline.

Columns alone can be overwritten and cannot show corrections or repeated work. An event table preserves what was recorded at each transition. The incident row remains fast to query and backward-compatible.

## Additive incident fields

Retain all existing fields and `status`. Add:

- `resolved_summary`, `resolved_at`, `resolved_by_user_id`, `resolved_by_name`;
- `corrective_action_summary`, `corrective_action_at`, `corrective_action_by_user_id`, `corrective_action_by_name`;
- `verification_note`, `verified_by_user_id` (existing name/time remain);
- optional `stage_schema_version`, distinguishing legacy and four-stage records.

Clarify field semantics:

- existing `immediate_action` = containment taken when reported;
- **Resolved** = immediate incident/hazard brought under control, with outcome;
- **Corrective action** = root-cause/prevention action completed, using existing `root_cause` and `prevention` plus new completion evidence;
- **Verified** = an authorised person confirms the resolution and corrective action are effective.

## Append-only stage events

Each event stores:

- incident, organisation and site;
- stage: `reported | resolved | corrective_action | verified`;
- actor user ID and denormalised name;
- event timestamp;
- required stage note and a snapshot of relevant fields;
- created timestamp and retrospective/correction markers if retrospective entry is allowed.

Do not cascade-delete these events. Incident deletion should remain unavailable through ordinary customer UI; preserving evidence takes priority. Apply existing site/org RLS helpers and grants. Database validation should reject skipped/out-of-order future transitions and incomplete required fields, not rely solely on buttons.

## Natural UI workflow

- Incident cards become a four-step timeline with the next valid action prominent.
- **Report:** type, title, what happened and immediate containment remain required. Root cause may be unknown initially.
- **Record resolution:** collect what was resolved, outcome, resolver and automatic timestamp. This replaces one-click “Mark fixed.”
- **Complete corrective action:** collect confirmed root cause, the corrective/preventive action completed and evidence/note. This is distinct from containment.
- **Verify and close:** show the complete prior chain read-only; collect verification note, verifier and timestamp. Restrict verification to the current authorised supervisory/owner roles. Whether a verifier must differ from the reporter should be a configurable policy decision, not silently imposed in this first change.
- Every transition is atomic: update the incident snapshot and append its event together through a database function, preventing half-saved stages and client bypass.
- Existing list filters map to the four stages and the detail panel exposes the immutable timeline.

## Existing incidents

No current live incident rows exist, but compatibility is still required for historical/imported data:

- never fabricate missing actors, notes or timestamps;
- existing `open` displays Reported, with later stages Pending;
- existing `action-taken` displays the legacy action as **Legacy fix recorded**, while Resolved/Corrective action show “Not separately recorded — legacy record” unless genuine fields exist;
- existing `verified` displays Reported and Verified using existing evidence; middle stages show the same explicit legacy-gap wording;
- existing records are not forced back open and are not automatically backfilled with invented dates;
- the Inspection Pack marks those middle stages Missing/Legacy, not failed and not complete.

## Testing

- All valid transitions create exactly one immutable event and matching snapshot.
- Skipped, duplicate, incomplete and unauthorised transitions fail without partial writes.
- Removed/deactivated staff retain historical display names.
- Legacy status mapping remains readable.
- Long notes, same-user verification, different-user verification and concurrent updates are covered.
- Reports and the future PDF read stage evidence without changing existing incident totals unexpectedly.

## Effort

**4–6 developer days** for migration/RLS, atomic transition function, four-stage UI, legacy mapping, report model and tests. Add **1–2 days** if attachments/photos must be stage-specific in this release.

---

# 3. Historically accurate missed checks

## Recommendation

Use **proper effective-dated schedule versions**, not only `effective_from` on the existing rows.

A single start date helps with creation, but it cannot represent:

- deactivation followed by reactivation;
- a cleaning task changing daily → weekly;
- due-time changes;
- a temperature unit changing thresholds or expected check types;
- edits without rewriting what was expected in an earlier report.

The simplest accurate model is one current parent record plus lightweight immutable schedule intervals.

## Additive data model

### Temperature unit schedule versions

Add a site/org-scoped table containing:

- `temp_unit_id`;
- `effective_from` and nullable `effective_to` using the site’s local calendar dates;
- `expected_check_types` (initially AM and PM) or explicit expected checks per operating day;
- snapshots of unit name/type/min/max used during that period;
- active/scheduled flag;
- created-by identity/name and created time.

Although thresholds do not determine whether a reading was missed, snapshotting them ensures an old reading is assessed against the target that applied then, not today’s edited target.

### Cleaning task schedule versions

Add a parallel table containing:

- `cleaning_task_id`;
- effective dates;
- snapshot of task/area/frequency/due time/assignment;
- active/scheduled flag;
- created-by identity/name and created time.

Enforce non-overlapping effective periods per parent record. Keep existing parent columns as the current operational projection so current screens and integrations continue to work.

## Safe write strategy

- Creation adds the parent and its first schedule version atomically.
- Editing schedule-relevant fields closes the current version and opens a new one; cosmetic ordering changes do not create a version.
- Deactivation/removal closes the current interval; reactivation opens a new interval.
- Perform this with database triggers or narrow database functions so Settings, future admin tools and connector paths cannot bypass history.
- Existing direct reads of `active` continue unchanged in phase one. Only new historical calculations use versions initially.

## Legacy backfill and truthful reporting

Historical activation changes cannot be reconstructed from existing data, so do not pretend they can:

- deploy a clearly recorded **history cutover date**;
- seed currently active units/tasks with a version beginning at the next complete site-local operating day (or a user-selected effective date during setup);
- inactive/deleted legacy rows receive no invented active interval;
- before cutover, show actual readings/completions but label expected/missed counts **Not determinable from historical schedule**;
- never use `created_at` alone to claim continuous activity through all later dates;
- optionally offer owners a separate reviewed backfill tool later, with explicit effective dates and audit attribution. It is not required for the safe first release.

This preserves every existing record and ensures accuracy improves prospectively from a known point.

## Missed-check calculation

For each local date/bucket:

1. select the schedule version effective then;
2. apply existing site-created date, closed-day and on-demand production-day exemptions;
3. create only the expected AM/PM or cleaning frequency occurrences in that effective interval;
4. match logs to those occurrences;
5. classify unmatched occurrences as Missing only after their due window has passed;
6. treat dates without trustworthy schedule history as Unknown, never Missing.

Weekly/monthly task versions need a defined transition rule. Recommended: a changed version applies to the next full weekly/monthly bucket unless the owner explicitly chooses an earlier effective date, preventing a mid-period edit from creating a surprise missed task.

## Protecting live behavior

This can be introduced without changing live scheduling initially:

- keep `temp_units` and `cleaning_tasks` as the source for today’s cards, dashboard, Safe to Trade and connector actions;
- write version rows alongside existing updates;
- run shadow calculations comparing current and versioned results for present-day ranges;
- switch only historical reports/PDF calculations after parity tests;
- later migrate other summaries to one shared calculator in a separate controlled step.

The main risk is not the additive tables; it is inconsistent consumers. Current Settings, Cleaning, Temperature Tracking, dashboards, reports and connector code all query active parent rows. An inventory test must cover every consumer before any read path is switched. Existing cleaning calculations are already duplicated and should share one tested effective-date calculator for the new report rather than receive separate patches.

## Testing

- create, edit, deactivate, reactivate and soft-delete timelines;
- AM/PM expectations and spot checks;
- daily/weekly/monthly changes at period boundaries;
- closed days, scheduled premises and on-demand production days;
- site timezone/DST boundaries and retrospective logs;
- legacy pre-cutover periods return Unknown, never false Missing;
- old thresholds/task names remain correct in old periods;
- current operational screens return the same tasks/units before and after rollout;
- RLS prevents cross-site/org history access.

## Effort

**6–9 developer days** for both version tables, triggers/functions, safe backfill, shared calculation, shadow/parity checks and tests. A later owner-reviewed historical backfill tool would add **3–5 days**.

---

# Sequencing

The three migrations have no direct dependency, but the recommended delivery order is:

1. **Historical schedule versions first.** Accuracy starts only at cutover; earlier deployment gives the new PDF a longer trustworthy window. Roll it out in shadow-write mode before changing any current screen.
2. **Incident stages second.** New incidents should begin collecting complete stage evidence before the PDF consumes them. Current live incident count is zero, reducing migration risk.
3. **Allergen workflow third, after professional review of the decision model and wording.** Technical design can proceed in parallel, but do not enable final declarations or label/PDF output until that review is complete.
4. **New Inspection Pack PDF last.** It consumes these stable models and must display legacy/unknown states honestly.

Allergen work may run in parallel with the first two if professional review is available. Do not delay schedule-history cutover while waiting for that external review.

## Overall estimate and release gates

Combined implementation: approximately **17–25 developer days**, plus food-safety review and final QA. Work should be released as three independently reversible additive migrations/features, not one large switch.

Before each release:

- migration is additive and rollback disables new reads without deleting data;
- RLS/site/org and role tests pass;
- existing rows and exports remain readable;
- full typecheck, test suite and production build pass;
- no auth/login/session files or account-access logic change;
- no historical state is inferred where the source data cannot prove it.
