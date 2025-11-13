const CACHE_VERSION = 'v1';
const STATIC_CACHE = `cryptotrack-static-${CACHE_VERSION}`;
const API_CACHE = `cryptotrack-api-${CACHE_VERSION}`;
const COINGECKO_CACHE = `cryptotrack-coingecko-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-96.png',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing service worker...', event);
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting to activate immediately');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Precaching failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating service worker...', event);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('cryptotrack-') && 
                cacheName !== STATIC_CACHE && 
                cacheName !== API_CACHE && 
                cacheName !== COINGECKO_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  }
  else if (url.hostname === 'api.coingecko.com') {
    event.respondWith(cacheFirstStrategy(request, COINGECKO_CACHE));
  }
  else if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  }
  else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  }
  else {
    event.respondWith(networkFirstStrategy(request, STATIC_CACHE));
  }
});

async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network request failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // For navigation requests (e.g., /settings, /dashboard), fall back to cached index.html
    // This allows the SPA to handle client-side routing when offline
    if (request.mode === 'navigate') {
      console.log('[Service Worker] Navigation request failed, serving cached SPA shell for:', request.url);
      const shellResponse = await caches.match('/');
      
      if (shellResponse) {
        console.log('[Service Worker] Successfully serving SPA shell from cache');
        return shellResponse;
      }
      
      console.error('[Service Worker] SPA shell not found in cache');
    }
    
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({ error: 'Offline - No cached data available' }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'application/json' })
        }
      );
    }
    
    throw error;
  }
}

async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[Service Worker] Cache hit:', request.url);
    
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(cacheName).then((cache) => {
            cache.put(request, networkResponse);
          });
        }
      })
      .catch(() => {
        console.log('[Service Worker] Background update failed for:', request.url);
      });
    
    return cachedResponse;
  }
  
  console.log('[Service Worker] Cache miss, fetching from network:', request.url);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Network fetch failed:', request.url, error);
    throw error;
  }
}
