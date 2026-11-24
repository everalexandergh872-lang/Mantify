/* Service worker: permite abrir la app sin señal y la mantiene actualizada.
   Cambia VERSION cada vez que publiques una nueva versión del index.html. */
const VERSION='mantify-v25';
const SHELL=['./','./index.html','./styles.css','./config.js','./backlog.js','./app.js','./manifest.webmanifest','./img/icon-192.png','./img/icon-512.png','./img/apple-touch-icon.png','./img/svg/favicon.svg'];
const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js'];
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{const c=await caches.open(VERSION);
    await Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})));
    await Promise.all(LIBS.map(u=>fetch(u,{mode:'cors'}).then(r=>c.put(u,r)).catch(()=>{})));
    self.skipWaiting()})());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==VERSION)await caches.delete(k);await self.clients.claim()})());
});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  // Los datos (Firestore / autenticación) nunca se cachean aquí: los maneja Firebase.
  if(/googleapis\.com|firebaseio\.com|firebaseapp\.com|identitytoolkit|securetoken|cloudfunctions\.net|(^|\.)google\.com$/.test(u.host))return;
  if(r.mode==='navigate'){ // página: primero la red (versión nueva), si no hay señal la copia guardada
    e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(VERSION).then(k=>k.put('./index.html',c));return x}).catch(()=>caches.match('./index.html').then(x=>x||caches.match('./'))));return}
  if(u.origin===location.origin&&/\.(js|css)$/.test(u.pathname)){ // código propio: también red primero, para que HTML, CSS y JS siempre sean de la misma versión
    e.respondWith(fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(VERSION).then(k=>k.put(r,c))}return x}).catch(()=>caches.match(r)));return}
  e.respondWith(caches.match(r).then(hit=>{
    const net=fetch(r).then(x=>{if(x&&(x.ok||x.type==='opaque')){const c=x.clone();caches.open(VERSION).then(k=>k.put(r,c))}return x}).catch(()=>hit);
    return hit||net}));
});
