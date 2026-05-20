/* MiseOS service worker — app shell + stale-while-revalidate for GETs.
 * Guards: only registered in production/native, never in Lovable preview iframes.
 */
const VERSION = "miseos-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const API_CACHE = `${VERSION}-api`;

const SHELL_URLS = ["/", "/auth", "/manifest.json", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isSupabase(url) {
  return url.hostname.endsWith(".supabase.co");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache OAuth, auth endpoints, or websockets.
  if (url.pathname.startsWith("/~oauth") || url.pathname.includes("/auth/v1/")) return;
  if (url.protocol === "ws:" || url.protocol === "wss:") return;

  // Stale-while-revalidate for Supabase REST GETs (read-only data).
  if (isSupabase(url) && url.pathname.startsWith("/rest/v1/")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Navigation requests → network first, fall back to shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("/").then((r) => r || caches.match("/auth"))
      )
    );
    return;
  }

  // Static assets → cache-first.
  if (url.origin === self.location.origin && /\.(js|css|woff2?|png|jpg|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
  }
});

// Optional push handler (native + web push).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "MiseOS", body: event.data?.text?.() || "" };
  }
  const title = data.title || "MiseOS";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/favicon.png",
      badge: "/favicon.png",
      data: data.data || {},
      tag: data.tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(() => existing.navigate(target));
      return self.clients.openWindow(target);
    })
  );
});
