// Service Worker for SUPER REPORT (Offline & PWA Support)
const CACHE_NAME = 'pp-review-v3.3.0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js',
  'https://cdn.jsdelivr.net/npm/libheif-js@1.23.2/libheif-wasm/libheif-bundle.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
  'https://img.icons8.com/color/180/sofa.png'
];

// Install: Precache core assets & CDNs (individual caching for resilience)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Failed to precache:', url, err);
        }
      }
    })
  );
  // Do NOT call skipWaiting() here so users can be prompted cleanly to update
});

// Message: Allow app to explicitly trigger skipWaiting when user accepts update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: Cleanup previous outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-First for CDN/assets, Network-First for local app files
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 0. Auth/API traffic is never cached: it must always reach D1 live.
  if (url.pathname.startsWith('/api/')) return;

  // 1. CDN and External Vendor assets -> Cache-First
  const isCdn = url.hostname.includes('cdnjs.cloudflare.com') ||
                url.hostname.includes('jsdelivr.net') ||
                url.hostname.includes('icons8.com');

  if (isCdn) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        }).catch((err) => {
          console.warn('[SW] Offline and CDN asset not in cache:', req.url, err);
          return Response.error();
        });
      })
    );
    return;
  }

  // 2. Other cross-origin assets (fonts, etc.) -> let the browser handle them
  if (url.origin !== self.location.origin) return;

  // 3. Local app files (index.html, manifest.json) -> Network-First with cache fallback
  // Navigations bypass the HTTP cache so a new deploy is picked up immediately.
  const fetchOptions = req.mode === 'navigate' ? { cache: 'no-store' } : undefined;
  event.respondWith(
    fetch(req, fetchOptions).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
      }
      return networkResponse;
    }).catch(() => {
      // If offline or network fails, return cached version (index.html for navigations)
      return caches.match(req).then((cached) => {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
