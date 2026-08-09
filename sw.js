/* ============================================================
   sw.js — Service Worker · PT. BIOLI LESTARI  (v4.5)
   Navigasi      : network-first (race timeout) + fallback cache
   version.json  : network-only  (cek update selalu akurat)
   same-origin   : stale-while-revalidate
   cross-origin  : cache-first   (CDN: font / xlsx / html2canvas)
   ============================================================ */
const CACHE       = 'bioli-v4.5';
const NAV_TIMEOUT = 3500;
const CORE = [
  './', './index.html', './manifest.json',
  './icon-512.png'
];

/* ---- lifecycle ---- */
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // per-item: satu 404 TIDAK menggagalkan install
    await Promise.all(CORE.map((u) => cache.add(u).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ---- helpers ---- */
function sameOrigin(url) {
  try { return new URL(url, self.location.href).origin === self.location.origin; }
  catch (_) { return false; }
}
function cacheable(r) { return r && (r.ok || r.type === 'opaque'); }

// stale-while-revalidate (aset same-origin)
async function swr(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const netP = fetch(req).then((r) => { if (cacheable(r)) cache.put(req, r.clone()); return r; }).catch(() => null);
  if (hit) { return hit; }
  return (await netP) || hit || Response.error();
}

// cache-first (CDN cross-origin)
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try { const r = await fetch(req); if (cacheable(r)) cache.put(req, r.clone()); return r; }
  catch (_) { return hit || Response.error(); }
}

// network-first + race timeout (navigasi dokumen)
async function navFirst(req) {
  const cache = await caches.open(CACHE);
  const KEY = './index.html';
  let timer;
  const timeout = new Promise((res) => { timer = setTimeout(() => res('TIMEOUT'), NAV_TIMEOUT); });
  const netP = fetch(req).then((r) => { clearTimeout(timer); return r; }).catch(() => { clearTimeout(timer); return null; });
  const winner = await Promise.race([netP, timeout]);
  clearTimeout(timer);
  if (winner && winner !== 'TIMEOUT' && winner.ok) {
    try { await cache.put(KEY, winner.clone()); } catch (_) {}
    return winner;
  }
  const cached = (await cache.match(KEY)) || (await cache.match('./')) || (await cache.match(req));
  if (cached) {
    if (winner === 'TIMEOUT') { netP.then((r) => { if (cacheable(r)) cache.put(KEY, r.clone()).catch(() => {}); }); }
    return cached;
  }
  return (winner && winner !== 'TIMEOUT') ? winner : Response.error();
}

/* ---- router ---- */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST/PUT dll → lewat network
  let path = '';
  try { path = new URL(req.url).pathname; } catch (_) { return; }

  // 1) version.json: selalu network (jangan sampai ke-cache)
  if (path.endsWith('/version.json') || path === '/version.json') { e.respondWith(fetch(req)); return; }
  // 2) navigasi dokumen: network-first
  if (req.mode === 'navigate') { e.respondWith(navFirst(req)); return; }
  // 3) CDN: cache-first
  if (!sameOrigin(req.url)) { e.respondWith(cacheFirst(req)); return; }
  // 4) aset same-origin: SWR
  e.respondWith(swr(req));
});