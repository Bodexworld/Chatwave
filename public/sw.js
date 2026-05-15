// Import Firebase Messaging SW early
try {
  importScripts('firebase-messaging-import.js');
} catch (e) {
  console.log('Firebase messaging not available in SW:', e);
}

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass through everything, empty fetch handler is enough for PWA installability
});
