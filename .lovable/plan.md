# MiseOS as an installable web app (PWA) — plan only

Nothing is built until you approve. Everything here is front-end except one additive database change in Phase 2 (noted). Front-end changes are only live on publish; the Phase 2 database columns go live as soon as they are added, but they do nothing until the front end is published.

## Guiding rules
- The service worker never touches login, sign-up, reset, Staff ID, checkout, or any backend/API response. It caches only versioned static files (JS/CSS/fonts/icons) and the app shell.
- It never registers in the Lovable preview, in iframes, or in development.
- A kill switch exists from day one and needs nothing from the customer.
- Offline records keep the time they were actually taken and are always marked "Logged offline, synced later".

---

## 1. Installability
- Link the existing `manifest.json` in the page head; add `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, status-bar style, and proper apple-touch-icon.
- Manifest: name "MiseOS", short name "MiseOS", `display: standalone`, `start_url: /dashboard?source=pwa` (signed-out users are already redirected to login), `scope: /`, stable `id: /`, theme colour from the Clean Clinical primary, background `#FAFBFC`, remove the forced portrait lock (tablets in kitchens are often landscape).
- Icons: separate files for 192 and 512 "any", 192 and 512 "maskable" (logo inside the central 80% safe zone), 180 apple-touch-icon, plus a 32 favicon.

Assets needed from you:
- The logo mark as SVG (or a 1024x1024 PNG, transparent background).
- Confirmation of the brand colour for the icon background (or I use the current primary).
- Optional: an iPhone splash colour preference. If you have none, I generate icons from the current favicon and you approve them.

## 2. Install experience
- **Android Chrome:** capture the browser's install prompt and show a small "Install MiseOS" button rather than a pop-up.
- **iPhone Safari:** no prompt exists, so show a short 3-step guide: tap Share, scroll down, tap "Add to Home Screen". The guide includes a picture.
- **Where it lives:**
  - A permanent "Install the app" card in **More** (staff and owners both see this).
  - A one-time, dismissible banner on the dashboard for phone users only. It appears after the 3rd visit, never on login/checkout, never again once dismissed or installed.
  - A public help page `/help/install` (linked from FAQ and the "Help offline" page) so it can be sent to trialists like Cook Stars.
- The banner is hidden when the app is already installed.

## 3. Offline logging (first release)
**Scope:** temperature readings (unit + process checks) and cleaning task ticks only. These are the most frequent and most time-critical records. Day-sheet edits, incidents and deliveries stay online-only in v1: they have more complex locking and evidence rules. Online-only screens show "You're offline — this needs a connection."

**Times captured on every queued record:**
- `recorded_at_device` — device clock when tapped.
- `server_received_at` — set by the database on sync.
- `logged_offline = true`, plus `device_clock_offset_seconds` (difference between the device and server clocks, measured at the last successful online request).

**Wrong device clocks:**
- The app measures clock drift whenever it is online. If drift is more than 5 minutes, the record is stored with a "Device clock may be wrong" flag. The device time is never silently rewritten. The record shows both times.
- Records with a device time in the future, or older than 72 hours, are accepted but flagged for owner review rather than rejected (the record must never be lost).

**Conflicts, checked by the existing sync function when the record arrives:**
- **Duplicate / double-tap:** each record has a unique ID from the device. A repeat submission returns "already saved" and does nothing. The log button also disables itself while saving.
- **Unit deactivated or soft-deleted since:** the reading is still saved (it really happened) against that unit, flagged "Unit was removed before sync". It does not count towards the current schedule.
- **Day locked / verified:** the record is saved as a late entry attached to that day, flagged "Received after the day was signed off". The sign-off is not reopened. The owner sees it in the review list.
- **Permission lost (staff removed, site closed):** the record moves to "Needs attention" on the device with the reason. It is never discarded automatically.

**What users see:**
- On the log screen: a grey "Waiting to sync" chip on the entry.
- After sync: an "Logged offline" badge kept permanently on the record, in reports and in the Inspection Pack, with both times shown.
- The existing offline banner (already built) shows the pending count and a Retry button.
- Failed items go to a "Needs attention" list in More, with Retry and "Send to owner". Removing an item needs a typed confirmation and is recorded. The queue survives app closes and restarts, and a warning appears if the user tries to sign out with items still pending.

**Database (additive, live when applied):** nullable columns on `temp_logs` and `cleaning_logs`: `recorded_at_device`, `server_received_at` (default now), `logged_offline` (default false), `sync_flags` (text array), and `client_uuid` (unique where not null). Existing rows and published screens are unaffected.

## 4. Update strategy
- Built JS/CSS files already have unique names per publish. Only those are cached, and pages themselves are always fetched fresh from the network first, so a new publish is picked up on the next open.
- When a new version is detected, a small bar says "A new version of MiseOS is ready — Refresh". It never refreshes by itself while someone is mid-entry, but does refresh automatically on the next app open.
- Old caches are deleted when the new version activates.
- **Kill switch, needing nothing from customers:**
  1. A remote flag in the database (`pwa_enabled`) checked on every app open. Turning it off makes every copy unregister the service worker and clear its caches on the next open.
  2. Fallback if the app itself is broken: publish a replacement worker at the same `/sw.js` address that wipes its own caches and unregisters. Browsers check this file at least every 24 hours and on every navigation, bypassing the cache.
  3. A manual `?sw=off` link for support.
- **Rollout:** ship Phase 1 first with *no* service worker (manifest + install only). Add the worker in a separate publish, with the flag initially on for staff test accounts only, then for everyone.

## 5. Standalone-mode behaviour
| Flow | iPhone (home-screen app) | Android (installed) | Handling |
|---|---|---|---|
| Stripe checkout (embedded) | Works in-app | Works in-app | No change; checkout pages excluded from the worker |
| Billing portal (Stripe-hosted) | Opens in a Safari sheet, return link lands in Safari not the app | Opens in a Chrome tab, often returns to the app | Open in a new window; on return show a "Billing updated — reopen MiseOS" page; the app re-checks subscription on focus |
| Magic links / email confirmation | Open in Safari, not the app (iOS limitation); session is separate from the home-screen app | Usually opens in the installed app | Confirmation page says "You're confirmed — open MiseOS from your home screen and sign in". Password sign-in stays the primary owner route on iPhone |
| Password reset | Opens in Safari | Usually in app | Reset completes in the browser; then "Open the app and sign in with your new password" |
| External links (guides, FSA, suppliers) | Would trap users with no back button | Same | All external links open in a new window |
| Staff ID kiosk login | Works; home-screen storage is separate from Safari, so staff log in once inside the app | Works | No change; tested explicitly |
| OAuth (Claude connector consent) | Opens in browser | Browser | Excluded from the worker; no change |

## 6. Notifications — honest feasibility
- **Android:** web push works well when installed or in Chrome. Reliable enough for "missed fridge check" reminders.
- **iPhone:** works only on iOS 16.4+ and **only after the app is added to the home screen**, and the user must tap to allow. It does not work in Safari tabs. Delivery is generally reliable, but there are no guarantees on timing and no critical alerts.
- **What it needs:** push keys, a subscriptions table, a sending function, and a scheduled job. The codebase already has a push helper and handlers.
- **What we can promise:** "Optional reminders on Android, and on iPhone once installed to the home screen." Do not promise alarms, or that reminders are guaranteed. Email reminders stay the reliable fallback.

## 7. Mobile polish
- Add `viewport-fit=cover`. Apply safe-area padding to the top header, bottom tabs, toasts, the offline banner and full-screen dialogs.
- Keyboard: use dynamic viewport height (`dvh`), scroll the focused input into view, keep bottom action buttons above the keyboard on the temperature and cleaning forms, and use numeric/decimal keypads for temperatures (including minus).
- Speed: lazy-load the heavy pages (Settings, Reports, PDF/Excel generation) so the temperature and cleaning screens open fast on older phones.
- **Device test plan (real devices):**
  - iPhone SE (small, Touch ID), a notched iPhone on current iOS, an iPad.
  - A mid-range Android (Samsung) and a low-end Android on Chrome.
  - Each device tested in the browser and installed, in portrait and landscape, with large text on.
  - Script: install, sign in (owner password, magic link, Staff ID), log a temperature, tick cleaning, go into flight mode, log 3 readings, kill the app, reopen, go back online, confirm sync and badges, then checkout, billing portal, reset password, open an external link, publish a new version and confirm the refresh bar, then trigger the kill switch.

## 8. Phasing
| Phase | Contents | Effort | Main risks | Must pass before publish |
|---|---|---|---|---|
| 1. Install basics | Manifest link, icons, meta tags, safe areas, keyboard fixes, install guide in More + `/help/install`, Android install button. **No service worker.** | 1.5–2 days | Icon cropping; layout shifts under the notch | Device script (install + all login routes + checkout) on iPhone and Android |
| 2a. Safe service worker | Guarded registration, static-only cache, network-first pages, update bar, remote kill switch, replacement worker ready | 1.5–2 days | Stale code after publish | Two consecutive test publishes reach installed copies; kill switch proven; preview unaffected; auth/API requests confirmed uncached |
| 2b. Offline logging | Additive columns, offline temperature + cleaning, conflict rules, badges, Needs-attention list, report/PDF labels | 3–4 days | Duplicates, lost records, wrong times | Flight-mode tests, double-tap test, wrong-clock test, deactivated-unit and locked-day tests, records survive app restart, cross-site isolation |
| 3. Notifications (optional) | Assessed only; build later if wanted | 3–4 days | iOS opt-in friction | Separate plan |

Total for Phases 1–2b: roughly 6–8 days.

## Live vs on publish
- **Live immediately when built:** Phase 2b database columns (nullable/defaulted, no effect on current screens) and the sync function update (it accepts the new fields and stays compatible with old payloads). The kill-switch flag row.
- **On publish only:** everything else — manifest link, icons, install guide, service worker, offline screens, update bar, safe-area fixes.

## Technical notes
- Replace the hand-written `public/sw.js` with a worker generated by `vite-plugin-pwa` (generateSW, `injectRegister: null`, devOptions off, `/sw.js` filename, autoUpdate, NetworkFirst for navigation, CacheFirst only for hashed same-origin assets, denylist `/~oauth`, `/auth*`, `/reset-password`, `/staff-login`, `/payment*`, `/checkout*`). No runtime caching for backend URLs — this removes the current file's API caching rule.
- One registration wrapper that refuses registration (and unregisters) in dev, iframes, preview hosts, with `?sw=off`, or when the remote flag is off.
- Reuse `src/lib/offlineQueue.ts`, `OfflineBanner`, and the `offline-sync` function. Extend the payload with the device time and clock offset. Rely on idempotency through `client_uuid` (on conflict do nothing).
