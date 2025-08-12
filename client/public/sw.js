const CACHE_NAME = 'medlink-claims-hub-v1';
const OFFLINE_URL = '/';

// Assets to cache for offline functionality
const urlsToCache = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Service worker installed');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip requests for extensions
  if (event.request.url.includes('extension')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, show offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('[SW] Error parsing push data:', error);
    data = {
      title: 'MedLink Claims Hub',
      body: 'You have a new notification',
    };
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    image: data.image,
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: false,
    silent: false,
    tag: data.data?.claimId ? `claim-${data.data.claimId}` : 'general',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'MedLink Claims Hub', options)
  );
});

// Notification click event - handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  // Handle different actions
  if (event.action === 'view_claim' && data.claimId) {
    url = `/claims/${data.claimId}`;
  } else if (data.url) {
    url = data.url;
  } else if (data.claimId) {
    url = `/claims/${data.claimId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window/tab open with the app
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            // Focus the existing window and navigate to the URL
            client.navigate(url);
            return client.focus();
          }
        }

        // If no window is open, open a new one
        return clients.openWindow(url);
      })
  );
});

// Background sync event - handle background synchronization
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'background-sync-claims') {
    event.waitUntil(syncClaims());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);

  if (event.tag === 'claims-update-sync') {
    event.waitUntil(syncClaims());
  }
});

// Function to sync claims data
async function syncClaims() {
  try {
    console.log('[SW] Starting claims sync...');

    // Get the last sync timestamp from IndexedDB
    const lastSync = await getLastSyncTimestamp();
    const sinceParam = lastSync ? `?since=${lastSync}` : '';

    // Fetch updates from the server
    const response = await fetch(`/api/claims/updates${sinceParam}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.hasUpdates && data.updates.length > 0) {
      // Store the updates in IndexedDB
      await storeClaimsUpdates(data.updates);
      
      // Update the last sync timestamp
      await setLastSyncTimestamp(data.timestamp);

      // Notify any open clients about the updates
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'CLAIMS_UPDATED',
          updates: data.updates,
        });
      });

      console.log(`[SW] Synced ${data.updates.length} claim updates`);
    } else {
      console.log('[SW] No new claim updates');
    }
  } catch (error) {
    console.error('[SW] Claims sync failed:', error);
    throw error;
  }
}

// IndexedDB helper functions
async function getLastSyncTimestamp() {
  return new Promise((resolve) => {
    const request = indexedDB.open('medlink-sync', 1);
    
    request.onerror = () => resolve(null);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sync')) {
        db.createObjectStore('sync', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['sync'], 'readonly');
      const store = transaction.objectStore('sync');
      const getRequest = store.get('lastSyncTimestamp');
      
      getRequest.onsuccess = () => {
        resolve(getRequest.result?.value || null);
      };
      
      getRequest.onerror = () => resolve(null);
    };
  });
}

async function setLastSyncTimestamp(timestamp) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('medlink-sync', 1);
    
    request.onerror = () => reject(new Error('Failed to open sync database'));
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('sync')) {
        db.createObjectStore('sync', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['sync'], 'readwrite');
      const store = transaction.objectStore('sync');
      
      store.put({ key: 'lastSyncTimestamp', value: timestamp });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to store sync timestamp'));
    };
  });
}

async function storeClaimsUpdates(updates) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('medlink-claims', 1);
    
    request.onerror = () => reject(new Error('Failed to open claims database'));
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('claims')) {
        const store = db.createObjectStore('claims', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['claims'], 'readwrite');
      const store = transaction.objectStore('claims');
      
      // Store each updated claim
      updates.forEach(claim => {
        store.put(claim);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to store claims updates'));
    };
  });
}