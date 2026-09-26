# Database gaps audit — findings only (nothing changed)

Checked live: columns on 26 food-safety tables, delete rules, change-tracking triggers, links between tables, constraints, and what the audit log actually records. Ordered by how much each gap would hurt at an EHO inspection or a recall.

## Priority 1 — would weaken an inspection or recall

1. **No link from a batch to the ingredients or deliveries that went into it.**
   Batches link to a recipe and a product, but nothing records which supplier delivery or ingredient lot was used. Deliveries store items as free text. If a supplier recalls a flour lot, you can't answer "which batches used it?" — the core traceability question ("one step back, one step forward").
   Missing: a batch-ingredient-lot record, and a lot/batch code + use-by on each delivered item.

2. **Several compliance records can be permanently deleted by users.**
   Hard-delete is allowed on probe calibrations, training records, illness (fitness to work) records, recalls, HACCP plan steps, uploaded food safety documents, cleaning tasks and fridge/freezer units. Deleting a fridge or cleaning task leaves its old readings pointing at nothing. Deleted records leave no trace for an inspector.
   Missing: archive-instead-of-delete (a "deleted at / by" field) on these tables.

3. **Edits to most records are not tracked.**
   Only temperature, cleaning and day sheet entries have change tracking (late entries flagged and audited). Incidents, deliveries, probe calibrations, pest logs, maintenance, training, recalls, suppliers and HACCP steps can be edited with no record of who changed what, and most have no "updated at / by" field. An inspector can't tell an original entry from a later correction.
   Missing: updated-at/by fields plus change history on these tables.

4. **Corrective actions aren't a record in their own right.**
   They are free-text notes on a temperature reading or incident. There's no follow-up owner, due date, "done/verified by" or link back to the failed check. Being able to show "problem found, fixed, checked" is a key EHO question.
   Missing: a corrective actions record linked to the failure it resolves.

## Priority 2 — record types with no home at all

5. **Supplier approval history.** Suppliers have a yes/no "approved" flag only — no approval date, who approved, review due date, or certificate (e.g. SALSA/BRC) expiry.
6. **Allergen change history.** Allergens sit as a list on each ingredient; there's no record of when an ingredient's allergens changed or when a product's allergen information was last checked, which matters for Natasha's Law labels.
7. **Pest control contractor visits.** Pest logs cover sightings only — no scheduled visit record, contractor, bait-point checks or report file.
8. **Water / legionella checks and equipment servicing certificates.** No table. Maintenance logs are fault reports, not scheduled checks with certificates. Possibly optional depending on premises type — worth confirming you want these.

## Priority 3 — integrity and linking

9. **Batch codes aren't guaranteed unique** — no uniqueness rule on batch code per site, so two batches could share a code and confuse a recall.
10. **Probe calibrations aren't linked to a specific probe** — probe name is free text, so you can't reliably show "this probe was last checked on X" or link a reading to the probe used.
11. **Training isn't linked to a certificate expiry reminder chain** — expiry is stored, but records are removed if the person's user record is removed (cascade delete), and there's no "verified by" field on a certificate.
12. **Incidents have "verified by" as a name only** — no link to the person, so it can't be proven who signed off.
13. **Unlinked "who" fields**: pest, maintenance and delivery records store the person's name correctly, but training records store only the person id — anonymising someone erases whose training it was on those records.
14. **Missing indexes** (from the earlier health audit, still true): around 100 links have no index; the ones that matter most for inspection reports are site + date on temperature, cleaning, delivery and batch records.

## Retention summary

- Good: temperature, cleaning and day sheet entries cannot be deleted by users, and late entries are flagged and logged.
- Weak: everything in point 2 can be deleted outright; deleting a site deletes its batches, training, probe calibrations and recalls with it (cascade). For a compliance product, sites should only ever be archived — which the app already does in practice, but the database doesn't enforce it.
- The central audit log currently only records temperature, cleaning, day sheet and organisation events (434 entries) — nothing for incidents, batches, deliveries, training or recalls.

## Suggested order if you want to fix later

1 and 2 first (traceability and deletion), then 3 and 4 (change history, corrective actions), then 9–12 (small constraint fixes), then the new record types in 5–8 once you confirm which you want. All are additive changes — no existing data would need to be altered.
