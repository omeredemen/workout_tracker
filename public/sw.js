// Service worker: makes the app open and work offline.
//
// - Install: precache every app page (they're static shells; data lives on
//   the device) plus the JS/CSS/fonts each one references.
// - Page loads: network first, falling back to the cached page when offline.
//   Search params are ignored, so /workout?date=… works for any date.
// - Router (RSC) requests are never cached. Offline they get a fresh 503,
//   which makes Next.js fall back to a full page load of the same URL
//   (it uses the response's URL, and a constructed response has none, so the
//   query is kept), and that load is served from the cache. Since all data is
//   on the device, a full load costs little and can't mix up router state.
// - /_next/static: cache first (file names are content-hashed).
// - Other origins (Supabase) are never touched.
//
// The version comes from the registration URL (/sw.js?v=…), so each deploy
// installs a fresh worker and drops the old caches.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `workout-tracker-${VERSION}`;
const PAGES = [
  "/",
  "/calendar",
  "/programs",
  "/settings",
  "/progress",
  "/workout",
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const assets = new Set([
        "/manifest.webmanifest",
        "/icons/icon-192.png",
        "/icon.svg",
      ]);
      for (const page of PAGES) {
        const response = await fetch(page, { cache: "reload" });
        if (!response.ok) continue;
        await cache.put(page, response.clone());
        const html = await response.text();
        for (const match of html.matchAll(
          /(?:src|href)="(\/_next\/static\/[^"]+)"/g,
        ))
          assets.add(match[1]);
      }
      await Promise.all(
        [...assets].map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) await cache.put(url, response);
          } catch {
            // Best effort: anything missed is cached on first use.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("workout-tracker-") && key !== CACHE)
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.headers.get("RSC") === "1") {
    event.respondWith(
      fetch(request).catch(() => new Response(null, { status: 503 })),
    );
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, url.pathname, "/"));
  } else if (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/** Network first, cached under `key`; offline (or slow), the cached copy. */
async function networkFirst(request, key, fallbackKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(key)) ??
      (await cache.match(fallbackKey)) ??
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
