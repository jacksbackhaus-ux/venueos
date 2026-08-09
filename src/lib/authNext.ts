/**
 * Reads a post-authentication redirect target from the URL (?next=...).
 * Only same-origin relative paths are accepted.
 */
export function safeNextPath(search: string = window.location.search): string | null {
  try {
    const raw = new URLSearchParams(search).get("next");
    if (!raw) return null;
    if (!raw.startsWith("/") || raw.startsWith("//")) return null;
    return raw;
  } catch {
    return null;
  }
}
