// Matracet service worker — push notifications only.
//
// Deliberately has NO fetch handler: it must never cache or intercept the app's own
// requests (a stale cached bundle on the home-screen app is already a known pain point,
// see CLAUDE.md's iOS lesson). Its only jobs are showing a pushed notification and
// opening the app on the right screen when one is tapped.
//
// Payload (sent by scripts/send-push.mjs): { title, body, url }

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Matracet'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      data: { url: data.url || '/matracet/?vy=nytt' },
      tag: data.tag || 'matracet',
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/matracet/?vy=nytt', self.location.origin).href
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
