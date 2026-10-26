/* ==========================================================
   BIOLI OFFLINE SW — v8.4 (MINIMAL INSTALLABLE)
   - CORE cuma nyebut file yang PASTI ada (192 + 512 PNG)
   - Cache-first HTML + CDN => offline kebuka
   - version.json selalu tembus network (cek update akurat)
   ========================================================== */
var CACHE = '8.4';
var NAV_KEY = './index.html'; // <-- GANTI kalau file utama lo bukan index.html
var CORE = [
  './',
  NAV_KEY,
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
var CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter/400.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter/500.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter/600.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter/700.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/inter/800.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono/500.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono/700.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk/500.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk/600.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk/700.css'
];

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var cache = await caches.open(CACHE);
    var miss = [];
    for (var i = 0; i < CORE.length; i++) {
      try { await cache.add(CORE[i]); }
      catch (err) { miss.push(CORE[i]); console.warn('[SW] core 404/skip:', CORE[i]); }
    }
    for (var j = 0; j < CDN.length; j++) {
      try { await cache.add(CDN[j]); }
      catch (err) { console.warn('[SW] cdn skip:', CDN[j]); }
    }
    if (miss.length) console.warn('[SW] FILE HILANG (install bisa gagal):', miss.join(', '));
    await self.skipWaiting();
    console.log('[SW] installed, cache =', CACHE);
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return k !== CACHE ? caches.delete(k) : null; }));
    await self.clients.claim();
    console.log('[SW] activated, cache lama dibuang');
  })());
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (url.pathname.indexOf('version.json') >= 0) return; // cek update wajib network

  if (req.mode === 'navigate') {
    e.respondWith((async function () {
      var cache = await caches.open(CACHE);
      var force = url.searchParams.has('_r');
      if (!force) {
        var hit = await cache.match(NAV_KEY) || await cache.match('./');
        if (hit) return hit;
      }
      try {
        var net = await fetch(req);
        if (net && net.ok) { cache.put(NAV_KEY, net.clone()); cache.put('./', net.clone()); }
        return net;
      } catch (err) {
        var fb = await cache.match(NAV_KEY) || await cache.match('./');
        return fb || new Response('Offline & belum ada cache.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  e.respondWith((async function () {
    var cache = await caches.open(CACHE);
    var hit = await cache.match(req);
    if (hit) return hit;
    try {
      var net = await fetch(req);
      if (net && (net.ok || net.type === 'opaque')) cache.put(req, net.clone());
      return net;
    } catch (err) {
      return Response.error();
    }
  })());
});