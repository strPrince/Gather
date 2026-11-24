// Synapsribe - Enhanced Offline-First Service Worker
// This service worker enables the app to work completely offline

const CACHE_NAME = 'synapsribe-v3';
const OFFLINE_URL = '/offline.html';
const RUNTIME_CACHE = 'synapsribe-runtime';

// Critical assets to cache on install
const CRITICAL_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// ============================================================================
// INSTALL EVENT - Cache critical assets
// ============================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    (async () => {
      try {
        // Open cache and add critical assets
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CRITICAL_ASSETS);
        console.log('[SW] Critical assets cached');
        
        // Claim clients immediately
        return self.skipWaiting();
      } catch (error) {
        console.error('[SW] Install error:', error);
      }
    })()
  );
});

// ============================================================================
// ACTIVATE EVENT - Clean up old caches
// ============================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    (async () => {
      try {
        // Delete old caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
        return self.clients.claim();
      } catch (error) {
        console.error('[SW] Activate error:', error);
      }
    })()
  );
});

// ============================================================================
// FETCH EVENT - Intelligent routing and caching
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Skip Next.js internal requests (they handle their own caching)
  if (url.pathname.startsWith('/_next/')) {
    return event.respondWith(fetchWithCache(request, RUNTIME_CACHE));
  }

  // Skip WebSocket and other non-GET protocols
  if (request.method !== 'GET') {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          // Queue failed POST/PUT/DELETE for offline
          if (!response.ok) {
            registerBackgroundSync();
          }
          return response;
        })
        .catch((error) => {
          console.log('[SW] Failed request queued for sync:', request.url);
          registerBackgroundSync();
          return new Response(
            JSON.stringify({ error: 'Offline - will retry' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
  }

  // API Calls - Network first, then cache
  if (request.url.includes('/api/')) {
    // Use stale-while-revalidate for document list (instant dashboard!)
    if (request.url.includes('/api/docs') && !request.url.includes('/api/docs/')) {
      return event.respondWith(staleWhileRevalidate(request));
    }
    return event.respondWith(networkFirstStrategy(request));
  }

  // Navigation requests - Network first, then cache, then offline page
  if (request.mode === 'navigate') {
    return event.respondWith(navigationStrategy(request));
  }

  // Static assets - Cache first, then network
  if (isStaticAsset(request.url)) {
    return event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
  }

  // Default - Network first, then cache
  return event.respondWith(networkFirstStrategy(request));
});

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

/**
 * Network First Strategy
 * Try network, fall back to cache, queue if offline
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Queue for sync if API request
    if (request.url.includes('/api/')) {
      registerBackgroundSync();
    }

    // Return offline page for navigation
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }

    // Return error response
    return new Response('Offline - resource not available', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Stale While Revalidate Strategy
 * Serve cache immediately, update in background
 * Perfect for document lists - instant load!
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  
  // Fetch fresh data in background
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  
  // Return cached immediately, or wait for network
  return cached || fetchPromise || new Response('[]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Cache First Strategy
 * Use cache, fall back to network
 */
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Resource not available:', request.url);
    return new Response('Resource not available offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Fetch with Cache Strategy
 * Used for build assets
 */
async function fetchWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    return caches.match(request);
  }
}

/**
 * Navigation Strategy
 * For HTML pages - try network first
 */
async function navigationStrategy(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Navigation failed:', request.url);
    
    // Try cached version
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Try home page
    const home = await caches.match('/');
    if (home) {
      return home;
    }

    // Return offline page
    return caches.match(OFFLINE_URL);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot|webp|gif)$/i.test(url);
}

function registerBackgroundSync() {
  if (self.registration && self.registration.sync) {
    self.registration.sync.register('sync-offline-queue').catch((err) => {
      console.log('[SW] Failed to register sync:', err);
    });
  }
}

// ============================================================================
// BACKGROUND SYNC EVENT
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(
      (async () => {
        try {
          // Notify clients to process offline queue
          const clients = await self.clients.matchAll();
          clients.forEach((client) => {
            client.postMessage({
              type: 'SYNC_QUEUE',
              timestamp: Date.now(),
            });
          });
        } catch (error) {
          console.error('[SW] Sync error:', error);
        }
      })()
    );
  }
});

// ============================================================================
// MESSAGE EVENT
// ============================================================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data.type);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'REGISTER_SYNC') {
    registerBackgroundSync();
  }
});

console.log('[SW] Service Worker loaded and ready');
