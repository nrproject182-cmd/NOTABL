/* ==========================================================
   BIOLI OFFLINE SW — aplikasi kebuka tanpa internet
   1) Cache-first: HTML + semua aset CDN (script & font)
   2) Navigasi pakai cache (offline open), fresh cuma lewat ?_r= (alur update manual)
   3) version.json selalu tembus network (biar cek update akurat)
   ========================================================== */
var CACHE = '7.4';
var NAV_KEY = './index.html'; // <-- GANTI kalau nama file utama lu bukan index.html

var CORE = [
  './',
  NAV_KEY,
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-152.png'
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
    for (var i = 0; i < CORE.length; i++) { try { await cache.add(CORE[i]); } catch (err) {} }
    for (var j = 0; j < CDN.length; j++) { try { await cache.add(CDN[j]); } catch (err) {} }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return k !== CACHE ? caches.delete(k) : null; }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* cek update WAJIB tembus internet, jangan di-cache */
  if (url.pathname.indexOf('version.json') >= 0) return;

  /* HALAMAN DIBUKA: pakai cache dulu (offline-safe).
     Fresh dari server cuma kalau ada ?_r= (tombol Muat Ulang / update manual) */
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
        if (net && net.ok) cache.put(NAV_KEY, net.clone());
        return net;
      } catch (err) {
        var fb = await cache.match(NAV_KEY) || await cache.match('./');
        return fb || new Response('Offline & belum ada cache.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  /* ASET (script CDN, font woff2, css, icon): cache-first + auto-simpan */
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