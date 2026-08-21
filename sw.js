const CACHE_NAME = 'svigermors-padel-v1.0.7';
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    './index.html',
    './style.css',
    './config.js',
    './app.js',
    './registration.js',
    './tournament.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png',
    './icon-monochrome.png',
    './icon-monochrome-192.png'
];

// Installation: Cache core assets and skip waiting
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activation: Clean up old caches immediately & claim clients
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch strategy: Network First (ensures fresh data), fallback to Cache if offline
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);
    if (url.hostname.includes('supabase') || url.hostname.includes('jsdelivr')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
