// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/// <reference lib="webworker" />

// CALQULUS PMS Service Worker
//
// This is the single service worker for the app, built via vite-plugin-pwa's
// `injectManifest` strategy, which:
//   1. Injects the Workbox precache manifest at `self.__WB_MANIFEST` below.
//   2. Bundles this file (plus the push-notification handlers that used to
//      live in `public/sw.js`) into the final `dist/sw.js`.
//
// IMPORTANT: `public/sw.js` no longer exists. Previously, Vite copied
// `public/sw.js` (push notifications) into `dist/sw.js`, and then
// vite-plugin-pwa's `generateSW` step wrote its own Workbox service worker
// to the SAME path, silently overwriting the push-notification handlers on
// every production build. Keep all service worker logic in this one file.

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
cleanupOutdatedCaches();

// Precache the build manifest injected by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback (client-side routing).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api/],
  })
);

// Don't cache external image domains — let them go straight to the network;
// CacheFirst on cross-origin URLs can throw "no-response" errors when the SW
// intercepts before the network has a chance to respond.
registerRoute(
  /^https:\/\/images\.unsplash\.com\/.*/i,
  new NetworkFirst({
    cacheName: "image-cache",
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  }),
  "GET"
);

self.addEventListener("activate", () => {
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Push notifications (previously public/sw.js)
// ---------------------------------------------------------------------------

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  const data = event.data.json();

  const options: NotificationOptions = {
    body: data.body || "You have a new notification",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    // `vibrate` isn't in the standard NotificationOptions lib.dom types yet.
    ...({ vibrate: [100, 50, 100] } as Record<string, unknown>),
    data: {
      url: data.url || "/",
      ...data.data,
    },
    actions: data.actions || [],
    tag: data.tag || "calqulus-pms-notification",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "CALQULUS PMS", options)
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && "focus" in client) {
            client.focus();
            if (urlToOpen !== "/" && "navigate" in client) {
              (client as WindowClient).navigate(urlToOpen);
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener("notificationclose", (event: NotificationEvent) => {
  console.debug("Notification closed:", event.notification.tag);
});
