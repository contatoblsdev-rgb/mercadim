/* Mercadim — service worker
   Arquivos do app: rede primeiro (pega a versão nova logo), com cópia para funcionar sem internet.
   Bibliotecas e fontes de CDN: cache primeiro.
   Supabase (dados e login): nunca passa pelo cache. */
const VERSAO = "mercadim-v1";
const APP = ["/", "/index.html", "/styles.css", "/app.js", "/config.js", "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];
const CDN = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(APP.concat(CDN)).catch(() => c.addAll(APP))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co") || url.pathname.startsWith("/auth/")) return;
  const daCdn = /cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (daCdn) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("/index.html") : undefined))));
});
