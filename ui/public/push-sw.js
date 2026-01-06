// @ts-nocheck
/* global clients */

// cf web-push client example
// https://github.com/alex-friedl/webpush-example/blob/master/client/service-worker.js

self.addEventListener('install', function () {
  console.log('data-fair/events - installed service worker')
  self.skipWaiting()
})

function uiLog (message) {
  fetch('/events/api/ui-logs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message })
  })
}

self.addEventListener('push', function (event) {
  console.log('data-fair/events - received a push message', event)
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      // badge: data.badge,
      timestamp: new Date(data.date).getTime(),
      vibrate: [300, 100, 400],
      tag: `${data.topic ? data.topic.key : ''}-${data.date}`,
      data
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  const url = event.notification.data.url || '/'
  console.log('data-fair/events - notification click', event.notification.tag, url)

  // Android doesn’t close the notification when you click on it
  // See: http://crbug.com/463146
  event.notification.close()

  // open page based on notification url (or focus if it is opened)
  event.waitUntil(
    clients
      .matchAll({ type: 'window' })
      .then(function (clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i]
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})

self.addEventListener('pushsubscriptionchange', function (event) {
  // see https://stackoverflow.com/a/65773670
  // not really clear if this event needs to be managed
  uiLog('unhandled pushsubscriptionchange event in service worker')
})
