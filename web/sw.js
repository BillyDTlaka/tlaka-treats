const CACHE = 'tt-v3';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: cache app shell immediately and activate without waiting
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

// Activate: delete all old caches so users always get fresh code
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//   API calls (Railway backend) → network only, never cache
//   App shell & static assets   → network first, fall back to cache
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // Skip API calls to Railway — always go to network
  if (url.hostname.includes('railway.app')) return;

  // Skip cross-origin requests
  if (url.hostname !== self.location.hostname) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses for shell assets
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        // Network failed → serve from cache (offline fallback)
        caches.match(e.request).then(cached => cached || caches.match('/index.html'))
      )
  );
});
