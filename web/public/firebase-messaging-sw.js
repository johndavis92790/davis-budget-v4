/* Firebase Cloud Messaging service worker (background notifications). */
importScripts(
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js',
)
importScripts(
  'https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js',
)

firebase.initializeApp({
  apiKey: 'AIzaSyBzGwxiQmHJLFx040cL3Dn7xAYfvOlT2W8',
  authDomain: 'davis-budget-v4.firebaseapp.com',
  projectId: 'davis-budget-v4',
  messagingSenderId: '286377130161',
  appId: '1:286377130161:web:79110860e3dd803838ca90',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {}
  self.registration.showNotification(d.title || 'Davis Budget', {
    body: d.body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: d,
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})

// No-op fetch handler so the app meets PWA installability criteria.
self.addEventListener('fetch', () => {})
