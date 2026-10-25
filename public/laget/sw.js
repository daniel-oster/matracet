// Läget service worker — push notifications only. Same shape as Matracet's public/sw.js and for
// the same reasons: deliberately NO fetch handler (it must never cache or intercept the app's own
// requests), and its scope is /matracet/laget/ so it is a separate registration — and therefore
// a separate push subscription — from Matracet's own worker.
//
// Payload (sent by the notification job in livet-data): { title, body, url, tag }

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

const HOME = '/matracet/laget/'

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Läget', {
      body: data.body || '',
      data: { url: data.url || HOME },
      tag: data.tag || 'laget',
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || HOME, self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if ('navigate' in client) {
          await client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})
