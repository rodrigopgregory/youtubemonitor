const CACHE = 'monitor-yt-v1'
const BASE = new URL('./', self.location).href

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([BASE, BASE + 'manifest.webmanifest', BASE + 'icon-192.png'])).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE) || url.pathname.endsWith('codigo-fonte.json')) return
  const ehPagina = req.mode === 'navigate'
  const ehArquivo = /\/assets\/|\.(png|svg|webmanifest)$/.test(url.pathname)
  if (!ehPagina && !ehArquivo) return
  if (ehPagina) {
    e.respondWith(fetch(req).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(BASE, copia)); return r })
      .catch(() => caches.match(BASE).then(r => r || new Response('Sem conexão. Conecte-se à internet para usar o Monitor.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))))
    return
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)) } return r })))
})
