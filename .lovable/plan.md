## Operational refocus plan

This is a big shift: from a compliance database into a daily control system. To avoid a multi-day mega-change that lands half-broken, I'll ship it in **4 phases**, each fully usable on its own. You can pause/redirect after any phase.

I recommend we **start with Phase 1 (Safe to Trade + Priority Feed)** — that alone delivers ~70% of the perceived shift, because it changes the very first thing a user sees on login.

---

### Phase 1 — The new Dashboard (Safe to Trade + Priority Feed)
*Highest leverage. Replaces the current Dashboard hero.*

1. **`useSafeToTrade(siteId, date)` hook** — single source of truth, derived only from existing tables:
   - temp logs: completion vs scheduled units today
   - cleaning: tasks completed vs scheduled today
   - day sheet: opening checks done
   - incidents: count of open incidents weighted by severity
   - batches: expired / use-by breached items
   - skip days flagged closed on site calendar
   - Output: `{ score: 0–100, band: 'green'|'amber'|'red', reasons: [{label, impact}] }`
   - Scoring rule (transparent, shown on hover): each domain contributes weighted % of completion; open critical incidents and active temp breaches subtract fixed points.

2. **`<SafeToTradeHero/>`** — replaces the greeting + quick-stats strip. Big score, band colour, 3 ranked reasons, single CTA into the top-impact module.

3. **`usePriorityFeed(siteId)` hook** — unifies:
   - active temp breaches without corrective action → 🔴
   - missed cleaning tasks from yesterday → 🟠
   - day-sheet checks not done → 🟠
   - staff training expiring ≤7d → 🟠
   - margin alerts (existing) → 🟠
   - today's assigned tasks / shifts → 🔵
   - Each item: `{severity, title, subtitle, href, action_label}`. Sorted critical → operational, capped at ~8.

4. **`<PriorityFeed/>`** — vertical card list with severity dot, one-line title, action button. This becomes the primary section below the score.

5. **Demote / remove** current Dashboard widgets that overlap (Today's Checks tile, Alerts list, separate Tasks widget). Keep MorningBriefing collapsed underneath (see Phase 3).

---

### Phase 2 — Operations ↔ money flow
*Makes batch creation actually useful.*

1. **Extend Batch form**: prompts for recipe (or quick "ingredient cost" override) and sale price.
2. **On insert**, compute and store: `total_cost`, `cost_per_unit`, `margin_pct` (if sale price set), `margin_below_target` flag.
3. **Batch card redesign** — product name (large) > cost-per-unit + margin badge > use-by + qty (small metadata). Margin badge colour-coded.
4. **Margin Watchdog trigger** — when `margin_below_target`, insert a row the existing margin-alert pipeline already consumes, so it surfaces in the Priority Feed and inside Cost & Margin.
5. **Cost & Margin page**: embed Margin Watchdog inline at the top (collapsible), drop any standalone "AI insights" tab.

---

### Phase 3 — AI becomes invisible
*No standalone AI surface. Everything embedded, collapsed.*

1. Remove the `<AISection/>` from Dashboard as a separate block; the Morning Briefing moves to a collapsed strip directly under the Priority Feed ("Yesterday's summary — tap to expand").
2. Equipment drift warnings render inline at the top of Temperature page (collapsible card, defaults closed if no warnings).
3. Waste insights render inline at the top of Waste Log (same pattern).
4. Margin Watchdog inline in Cost & Margin (from Phase 2).
5. Delete `/ai` standalone route if it exists; remove sidebar entry.

---

### Phase 4 — UI calm pass (scannable lists + one-action screens)
*The polish that makes it feel premium.*

Apply a shared pattern to **Batches, Cleaning, Temperature logs, Incidents, Waste Log, Staff Training**:

1. **List item template**: `{icon} {Product/Subject — bold} · {key number/status badge} · {muted metadata}`. No tables on mobile; switch to cards.
2. **One primary CTA per page** (e.g., Cleaning → "Mark task done"; everything else is secondary/icon-only).
3. **Language pass**: replace "HACCP critical control point" → "Safety check", "Corrective action required" → "Fix needed", etc. Glossary lives in `src/lib/language.ts`.
4. **Density rule**: max 3 lines of text per card, all else as badges/colour. Tailwind class audit to enforce consistent spacing tokens.

---

### What I'll not touch in this round
- Database schema beyond Phase 2 (cost columns on `batches`). No new tables for the score — it's computed on read.
- Roles / RLS / auth.
- Landing page (just redesigned).
- Reports / EHO export format.

### Technical notes
- Score and feed are **derived from existing data** via React Query; no migrations needed for Phase 1.
- Phase 2 needs one migration: `ALTER TABLE batches ADD COLUMN total_cost numeric, cost_per_unit numeric, margin_pct numeric, sale_price numeric;` plus optional trigger to recompute.
- AI components stay where they live in `src/components/dashboard/*` and module pages — just relocated and wrapped in a shared `<CollapsibleInsight/>`.

---

**Which phase do you want me to start with?** My recommendation is Phase 1 — ship the new Dashboard first, then iterate.
