/* eslint-disable no-restricted-globals */
// Firebase Cloud Messaging Service Worker for background notifications

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Helper to parse query parameters or default config if passed
const urlParams = new URLSearchParams(location.search);
const apiKey = urlParams.get('apiKey') || 'AIzaSyCKoUyWxrYPOo63e5yeEsHYoPbCj2A2iaQ';
const projectId = urlParams.get('projectId') || 'bobbies-homie';
const messagingSenderId = urlParams.get('messagingSenderId') || '123787204526';
const appId = urlParams.get('appId') || '1:123787204526:web:6aaaf29c4c52acc6c29a3f';

firebase.initializeApp({
  apiKey,
  authDomain: 'bobbies-homie.firebaseapp.com',
  projectId,
  storageBucket: 'bobbies-homie.firebasestorage.app',
  messagingSenderId,
  appId,
});

const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Bobbies Homie';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'คุณมีการแจ้งเตือนใหม่ในบ้าน',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
