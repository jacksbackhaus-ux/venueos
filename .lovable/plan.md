# MCP Connector for MiseOS customers — analysis and proposal

## CURRENT STATUS

**Already built (working, deployed):**
- An MCP server lives on the app's backend at `/functions/v1/mcp`, published as "MiseOS".
- It is protected by real OAuth 2.1 sign-in: an assistant redirects the customer to MiseOS, they log in with their own MiseOS account and approve on the consent screen at `/.lovable/oauth/consent`. No API keys, no shared secrets.
- Every tool call runs **as that signed-in user**: the tool forwards their own access token to the database, so existing row-level security, org boundaries and site access apply automatically. There is no admin/service key anywhere in the MCP code.
- 7 tools exist today: list sites, list fridges/freezers, list temperature readings, log a temperature, list incidents, report an incident, list production batches.

**What is missing:**
1. **No customer-facing place to set this up.** Nothing in Settings mentions it; customers have no connection URL, no instructions, no list of what's connected, no way to revoke.
2. **No audit trail.** Records created by an assistant are attributed to the user's email, but there is no log of which assistant made which call, when, and whether it succeeded.
3. **Thin coverage.** No cleaning, day sheets, production day open/close, probe calibration, training, fitness-to-work, batch updates, deliveries, inspection pack, or "what's overdue" summaries.
4. **No role/plan gating at the MCP layer.** A staff-level user connecting an assistant gets exactly their normal permissions (correct), but there is no explicit block on write tools for read-only (EHO) accounts beyond what the database already enforces, and no per-org on/off switch.

## PROPOSED USER EXPERIENCE

**Location:** a new **Connected Apps** tab in Settings, sitting beside Users and Account. Settings is already the home for org-level configuration and is role-gated, so it is the natural fit. On mobile it appears in the same tab strip.

What the tab shows:
- A short plain-English explainer: "Connect Claude, ChatGPT or Copilot to MiseOS so you can log checks and ask questions in chat."
- The connection address, with a copy button, plus step-by-step instructions per assistant (Claude → Settings → Connectors → Add custom connector; ChatGPT → Settings → Connectors; Copilot/Cursor → add MCP server).
- A master **on/off switch for the organisation** (owner/manager only). Off means every MCP call is refused for that org.
- A **recent activity list**: which assistant, which action, which site, which user, when, and outcome — read from the new audit log.
- A note that each person connects their own account and sees only what they can already see in MiseOS.

**Authentication flow (unchanged, already correct):** assistant → MiseOS login → consent screen naming the assistant → assistant receives a token scoped to that one user. Customers revoke from the assistant's own settings, or the org switch disables everything at once.

## AVAILABLE ACTIONS (proposed final tool set)

Read = assistant can look it up. Create/Edit = assistant can write, always attributed. Nothing deletes.

**Food safety records**
- Read/create fridge, freezer, display-chiller and ambient readings (exists)
- Read/create cooking, reheating, hot-holding, cooling and delivery temperature checks (exists via reading type)
- Read/create probe calibration checks (new)
- Correct a reading logged today, e.g. add a corrective action (new, edit only, same-day, logged as an amendment)
- Read cleaning tasks; mark a cleaning task complete (new)
- Read the day sheet; complete a day sheet item (new)
- Open and close the production day (new)

**Compliance**
- Read/report incidents (exists); update an incident's root cause, prevention or status (new)
- Read and complete periodic reviews (new)
- Read staff training records; add a training record or certificate detail (new, no file uploads over chat)
- Record a fitness-to-work declaration (new)

**Traceability**
- Read production batches (exists); create a batch; update quantity/use-by/status; mark used or disposed (new)
- Read suppliers; record a supplier delivery with its temperature check (new)

**Inspection support**
- Generate an inspection pack for a date range and return a download link (new)
- Retrieve compliance summary: score, gaps, overdue items this week (new)
- Summarise incidents or failed checks over a period (new)

**Administration** (owner/manager only)
- Read the staff list; add a staff member; deactivate a staff member (new)
- Read and update site details (new)
- **Not offered:** changing roles or permissions, billing, deleting anything, closing or moving sites, exporting other orgs' data. These stay in the app UI where they need deliberate confirmation.

## SECURITY & PERMISSIONS MODEL

- **Identity:** every call carries the customer's own verified token. No org id is ever taken from the assistant's input; the org is derived from the site, and the site must already be visible to that user.
- **Roles:** the same role rules the app uses apply. Staff can log checks and read their own site. Supervisors add cleaning/day-sheet completions. Managers and owners get incidents, reviews, staff admin and site details. Read-only (EHO) accounts get read tools only — write tools refuse before touching the database.
- **Cross-org access:** structurally impossible — the database refuses rows outside the user's org, and there is no admin key in the MCP path.
- **Destructive actions:** no delete tools at all. Status changes (disposed, deactivated, closed) are reversible records, marked as needing explicit confirmation so assistants must ask first.
- **Audit:** a new append-only log records user, org, site, assistant name, action, input summary, outcome and timestamp for every call, readable by owners/managers of that org only. Records created via MCP are also flagged in-app so an inspector sees how they were entered.
- **Kill switches:** per-org on/off in Settings, plus the ability to disable an individual assistant.
- **Rate limiting** per user per minute, so a looping assistant cannot flood records.

## EXAMPLE WORKFLOWS

- "Log today's walk-in fridge at 3.5°C" → assistant finds the unit, records the reading against the current production day, replies pass/fail and prompts for a corrective action if it failed.
- "What food safety tasks are overdue this week?" → returns missed temperature rounds, outstanding cleaning, incomplete day sheets and overdue reviews for that site.
- "Create a production batch for Lemon Drizzle Cookies, 120 units, use by Friday" → creates the batch with a generated batch code and reads it back for confirmation.
- "Generate an inspection pack for the last 3 months" → builds the pack and returns a link the customer opens.
- "Summarise food safety incidents from the last 6 months" → grouped by type with status and outstanding actions.

## BUILD SEQUENCE (once approved)

1. Audit log table + shared helper wrapping every tool (log, role check, org switch check, rate limit).
2. Settings → Connected Apps tab: explainer, connection address, per-assistant instructions, org switch, activity list.
3. Expand the tool set in phases: safety records and cleaning/day sheet first, then compliance and traceability, then inspection support, then administration.
4. Redeploy the MCP server and refresh its published tool list after each phase.

## TECHNICAL NOTES

Tools live in `src/lib/mcp/tools/`, registered in `src/lib/mcp/index.ts`; the backend function is generated and redeployed on change. Auth is Supabase OAuth 2.1 with the consent route already wired at `/.lovable/oauth/consent`. A new `mcp_audit_log` table (org-scoped, insert-by-owner-of-row, select for managers) plus an `mcp_settings` row per organisation covers requirements 5 and the kill switch. Role gating reuses `useRole`'s server-side equivalents inside `requireClient`.
