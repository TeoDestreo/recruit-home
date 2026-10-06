// Minimal service worker: makes the site installable and shows an offline page
// when a page can't load. Only the offline page is cached; never API responses, videos or other pages.
const CACHE='acpe-offline-v2';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.add('/offline')).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 if(e.request.mode!=='navigate'||e.request.destination!=='document')return;
 e.respondWith(fetch(e.request).catch(()=>caches.match('/offline')));
});
