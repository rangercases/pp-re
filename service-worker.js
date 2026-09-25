// Service Worker for PP Sample Review (Offline & PWA Support)
const CACHE_NAME = 'pp-review-v3.0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js',
  'https://cdn.jsdelivr.net/npm/libheif-js@1.23.2/libheif-wasm/libheif-bundle.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js',
  'https://img.icons8.com/color/180/sofa.png'
];

// Install: Cache all core assets & CDNs
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use individual caching so a single transient CDN glitch won't abort entire install
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Failed to precache:', url, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
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

// Fetch: Cache-First for CDN/assets, Network-First for local app files (auto-updates freshest code)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

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
        }).catch(() => {
          console.warn('[SW] Offline and CDN asset not in cache:', req.url);
        });
      })
    );
    return;
  }

  // 2. Local app files (index.html, manifest.json) -> Network-First with cache fallback
  event.respondWith(
    fetch(req).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
      }
      return networkResponse;
    }).catch(() => {
      // If offline or network fails, return cached version
      return caches.match(req);
    })
  );
});
