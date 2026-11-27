'use strict';
// Este service worker sólo recibe avisos. No intercepta ni almacena pedidos o páginas.
const romo=self.location.pathname.startsWith('/romo-panel-qa/');
const branches=romo?['romo']:['arica','serena'];
const panel=new URL(romo?'index.html':'uki-sushi-local.html',self.registration.scope);
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
 let p;try{p=e.data.json();}catch{return;}
 if(!branches.includes(p?.branch)||typeof p.title!=='string'||typeof p.body!=='string'||typeof p.tag!=='string')return;
 e.waitUntil(self.registration.showNotification(p.title.slice(0,120),{
  body:p.body.slice(0,170),tag:p.tag.slice(0,60),icon:new URL('avisos-pedidos-192.png',self.registration.scope).href,
  data:{branch:p.branch}
 }));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 const branch=e.notification.data?.branch;if(!branches.includes(branch))return;
 const target=new URL(panel);target.searchParams.set('avisos',branch);
 target.hash=String(e.notification.tag||'').slice(0,60);
 e.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const current=windows.find(c=>c.url===target.href);
  // No navegar una pestaña donde se está editando un borrador.
  if(current)return current.focus();
  return self.clients.openWindow(target.href);
 })());
});
