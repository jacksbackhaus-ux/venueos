// Operational time windows + section classification helpers.
// Used by Safe-to-Trade scoring and Today cards so we never penalise
// teams for work that isn't due yet.

export type OpsWindow = "opening" | "midday" | "closing";

export function currentOpsWindow(now: Date = new Date()): OpsWindow {
  const h = now.getHours();
  if (h < 11) return "opening";
  if (h < 16) return "midday";
  return "closing";
}

/** Yesterday's date (YYYY-MM-DD) for any given local date string. */
export function yesterdayISO(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Is the given dateISO today (local)? */
export function isToday(dateISO: string): boolean {
  return dateISO === new Date().toISOString().slice(0, 10);
}

/** Classify a day-sheet section as opening / closing / midday based on
 *  its title and its default_time. */
export function classifySection(section: { title?: string | null; default_time?: string | null }): OpsWindow {
  const title = (section.title ?? "").toLowerCase();
  if (/open|morning|am\b|pre[- ]?service|start/.test(title)) return "opening";
  if (/clos|night|pm\b|end of day|shutdown|lockup/.test(title)) return "closing";
  const t = (section.default_time ?? "").slice(0, 5);
  if (t) {
    const [hh] = t.split(":").map(Number);
    if (!Number.isNaN(hh)) {
      if (hh < 11) return "opening";
      if (hh >= 16) return "closing";
    }
  }
  return "midday";
}

/** Parse "HH:MM" → minutes from midnight. Returns null if invalid. */
export function parseHHMM(s?: string | null): number | null {
  if (!s) return null;
  const [hh, mm] = s.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

/** Has a due_time already passed today? If no due_time, treat as due all day. */
export function isCleaningDueNow(due_time: string | null | undefined, now: Date = new Date()): boolean {
  const due = parseHHMM(due_time);
  if (due == null) return true;
  return now.getHours() * 60 + now.getMinutes() >= due;
}
