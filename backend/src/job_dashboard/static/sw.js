// Career Agent Progressive Web App (PWA) Service Worker
const CACHE_NAME = 'job-dashboard-shell-v2';

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg',
  '/robots.txt',
];

// Install event: Pre-cache application shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_SHELL_ASSETS).catch((err) => {
          console.warn('[PWA SW] Pre-caching partial failure:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: Clean up previous version caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event: Network-first for navigation; Stale-While-Revalidate for static assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Exclude cross-origin requests and non-static API/telemetry endpoints
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/metrics') ||
    url.pathname.startsWith('/stats')
  ) {
    return;
  }

  // 1. Navigation requests (SPA routes like /market, /pipeline, /analytics, etc.)
  // Network-first: try network, fallback to cached index.html shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedShell = (await cache.match('/index.html')) || (await cache.match('/'));
          if (cachedShell) {
            return cachedShell;
          }
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>Offline</h1><p>Application shell is currently unavailable offline.</p></body></html>',
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, SVGs, Fonts, Images)
  // Stale-While-Revalidate: return cache immediately if present, revalidate in background
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const networkFetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await networkFetchPromise;
      if (networkResponse) {
        return networkResponse;
      }

      return new Response('Resource unavailable', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'text/plain' },
      });
    })
  );
});

