const CACHE_NAME = 'movement-break-shell-v7'
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/icon.svg']
const UPDATE_READY_MESSAGE = 'MOVEMENT_BREAK_UPDATE_READY'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldKeys = keys.filter((key) => key !== CACHE_NAME)

      await Promise.all(oldKeys.map((key) => caches.delete(key)))
      await self.clients.claim()

      if (oldKeys.length === 0) {
        return
      }

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      for (const client of clients) {
        client.postMessage({ type: UPDATE_READY_MESSAGE })
      }
    }),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') {
    return
  }

  event.respondWith(fetch(event.request).catch(() => caches.match('/')))
})
