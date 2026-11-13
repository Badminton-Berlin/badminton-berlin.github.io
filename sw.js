// Service worker: caches the app shell so it opens instantly, and receives push notifications (Firebase Cloud Messaging).
const CACHE = "ppc-shell-v17";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/maskable-192.png", "./icons/maskable-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return; // Firebase, fonts, CDN go straight to the network
  e.respondWith(
    fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
// Push notifications (only active once a Firebase config is present)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBy0VcdA2AMNS1qwGR4iJZ75h1Gjsl-HMY",
  authDomain: "preussenpark-challenge.firebaseapp.com",
  projectId: "preussenpark-challenge",
  storageBucket: "preussenpark-challenge.firebasestorage.app",
  messagingSenderId: "639104916892",
  appId: "1:639104916892:web:d2bf9958d79b82ff4c3c59"
};
if (FIREBASE_CONFIG) {
  importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js");
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    const n = payload.notification || {}; const d = payload.data || {};
    if (n.title && !d.handled) return; // notification payloads are shown by the browser itself
    self.registration.showNotification(d.title || "Badminton Berlin", { body: d.body || "", icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", tag: d.tag || "ppc", data: { url: d.url || "./#sessions" } });
  });
  self.addEventListener("notificationclick", e => {
    e.notification.close();
    const url = (e.notification.data && e.notification.data.url) || "./#sessions";
    e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => { for (const c of list) { if ("focus" in c) { c.navigate(url); return c.focus(); } } return clients.openWindow(url); }));
  });
}
