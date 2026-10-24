// APROLOCO service worker: l'app funziona anche offline (i dati arrivano dal server quando c'è rete)
const CACHE = 'aproloco-v1.0.1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'lib/pdf-lib.min.js', 'js/core.js', 'js/pdf.js', 'js/eventi.js', 'js/app.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // le chiamate al server non passano dalla cache
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
