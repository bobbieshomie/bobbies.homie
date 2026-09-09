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

// Background message handling
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] onBackgroundMessage:', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Bobbies Homie';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'คุณมีการแจ้งเตือนใหม่ในบ้าน',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Standard Web Push event listener (Required for iOS Safari PWA)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received:', event);
  let title = 'Bobbies Homie';
  let options = {
    body: 'คุณมีการแจ้งเตือนใหม่ในบ้าน',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const json = event.data.json();
      title = json.notification?.title || json.data?.title || title;
      options.body = json.notification?.body || json.data?.body || options.body;
      if (json.data?.url || json.fcmOptions?.link) {
        options.data.url = json.data?.url || json.fcmOptions?.link;
      }
    } catch {
      try {
        const text = event.data.text();
        if (text) options.body = text;
      } catch {}
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

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
