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
  const n = payload.notification || {}
  self.registration.showNotification(n.title || 'Davis Budget', {
    body: n.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data || {},
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/'))
})
