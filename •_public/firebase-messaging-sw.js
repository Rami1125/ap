// Scripts for Firebase products are imported using the importScripts() method.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDy3k1AoEKeuCKjmFxefn9fapeqv2Le1_w",
    authDomain: "hsaban94-cc777.firebaseapp.com",
    projectId: "hsaban94-cc777",
    storageBucket: "hsaban94-cc777.appspot.com",
    messagingSenderId: "299206369469",
    appId: "1:299206369469:web:50ca90c58f1981ec9457d4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// This listener handles messages when the app is in the background or closed.
messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || 'https://i.postimg.cc/2SbDgD1B/1.png',
        data: {
            url: payload.fcmOptions.link // Pass the link from the notification data
        }
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification click
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const urlToOpen = event.notification.data.url || '/';
    event.waitUntil(
        clients.openWindow(urlToOpen)
    );
});

