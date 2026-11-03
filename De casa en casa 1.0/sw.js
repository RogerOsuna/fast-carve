const SHELL='dcc-shell-v1', RUNTIME='dcc-runtime-v1';
const FILES=['./','index.html','styles.css','app.js','manifest.webmanifest','icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>![SHELL,RUNTIME].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const own=url.origin===location.origin;
  // App propia: red primero (para recibir actualizaciones), caché si no hay conexión.
  // Leaflet y teselas del mapa: caché primero, se rellena sobre la marcha.
  e.respondWith(own
    ? fetch(e.request).then(r=>{const c=r.clone();caches.open(SHELL).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request))
    : caches.match(e.request).then(h=>h||fetch(e.request).then(r=>{if(r.ok||r.type==='opaque'){const c=r.clone();caches.open(RUNTIME).then(x=>x.put(e.request,c))}return r}))
  );
});
