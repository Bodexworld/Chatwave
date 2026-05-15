importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

try {
  firebase.initializeApp({
    "projectId": "bodex-ai-assistant",
    "appId": "1:432380724531:web:b8774cfee9d083ece4ea46",
    "apiKey": "AIzaSyAYgA4xTTbD8mqCsUyfGUqHGR7MN-PXRvA",
    "authDomain": "bodex-ai-assistant.firebaseapp.com",
    "firestoreDatabaseId": "ai-studio-c56e9b36-9137-4806-b735-4466dbb7403d",
    "storageBucket": "bodex-ai-assistant.firebasestorage.app",
    "messagingSenderId": "432380724531"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-import.js] Received background message ', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'New message';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || '',
      icon: '/logo192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.error("Failed to initialize Firebase Messaging in SW", err);
}
