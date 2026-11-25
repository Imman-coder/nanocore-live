// Offline app shell for the installable web app. Never caches MIDI traffic.
const CACHE = 'nanocore-live-v52';
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/src/ui/app.js',
  '/src/ui/start.js',
  '/src/ui/settings.js',
  '/src/ui/live-layout.js',
  '/src/ui/editor.js',
  '/src/ui/live.js',
  '/src/ui/globals.js',
  '/src/ui/devices.js',
  '/src/ui/knob.js',
  '/src/ui/ui-events.js',
  '/src/ui/pedal-popup.js',
  '/src/ui/assignments.js',
  '/src/core/messages.js',
  '/src/core/scaling.js',
  '/src/core/spec.js',
  '/src/core/snapshot.js',
  '/src/core/router.js',
  '/src/core/scheduler.js',
  '/src/core/store.js',
  '/src/core/catalog.js',
  '/src/core/versions.js',
  '/src/core/tempo.js',
  '/src/core/parameterWrite.js',
  '/src/core/firmwareSpec.js',
  '/src/core/live.js',
  '/src/core/base.js',
  '/src/data/paramHelpers.js',
  '/src/data/blocks/fx1.js',
  '/src/data/blocks/fx2.js',
  '/src/data/blocks/amp.js',
  '/src/data/blocks/cab.js',
  '/src/data/blocks/mod.js',
  '/src/data/blocks/del.js',
  '/src/data/blocks/rev.js',
  '/src/data/blocks/eq.js',
  '/src/transports/webmidi.js',
  '/src/transports/webbluetooth.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('/index.html');
      throw error;
    }
  })());
});
