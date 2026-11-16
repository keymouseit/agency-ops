/* Agency Ops basic PWA service worker — shell/offline only, no API caching. */
const CACHE_NAME = 'agency-ops-pwa-v1'
const PRECACHE_URLS = ['/offline.html', '/icon-192x192.png', '/icon-512x512.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache APIs, auth, or Next internals via this SW.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/uploads/')
  ) {
    return
  }

  // Navigations: network-first, fall back to offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match('/offline.html')
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' })
      })
    )
    return
  }

  // Static icons / offline.html: cache-first.
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone()
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      }))
    )
  }
})
