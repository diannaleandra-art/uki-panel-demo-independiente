/* Opt-in de avisos del sistema: separado del audio, caja y aceptación del pedido. */
(()=>{
'use strict';
const romo=location.hostname==='romos-sushi-panel.vercel.app';
if(!romo&&location.hostname!=='diannaleandra-art.github.io')return;
const script=document.currentScript?.src;
if(!script)return;
const folder=new URL('./',script);
const API=romo?'/api/romo-solicitudes-carta-qa':'https://uki-sushi-pedidos.vercel.app/api/carta-solicitudes-live';
const localKey='uki.pedidos.push.v1';
const names={arica:'Uki Regimiento Arica',serena:'Uki La Serena',romo:'Romo La Serena'};
const branch=()=>typeof S==='undefined'?'':romo?(S.suc==='Romo’s Sushi La Serena'?'romo':''):
 S.suc==='Uki Regimiento Arica'?'arica':S.suc==='Uki La Serena'?'serena':'';
const token=()=>romo?window.ukiInventarioToken?.():window.ukiMesasQAToken?.();
const $=id=>document.getElementById(id);
const startURL=new URL(location.href),incoming=startURL.searchParams.get('avisos');
const isAppleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const homeApp=()=>navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
const supported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const saved=()=>{try{return JSON.parse(localStorage.getItem(localKey)||'null');}catch{return null;}};
const remember=data=>{try{if(data)localStorage.setItem(localKey,JSON.stringify(data));else localStorage.removeItem(localKey);}catch{}};
let reg=null,working=false,feedback='',feedbackBranch='',renewing=false,routeHandled=false;
const ready=new Map(),preparing=new Set(),prepareError=new Map();
const renderBox=()=>mount();
function status(msg,b){feedback=msg;feedbackBranch=b;renderBox();}
function pause(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function worker(){
 const old=await navigator.serviceWorker.getRegistration(folder.href);
 // No sustituir un service worker que pertenezca a otra función de este panel.
 if(old&&old.scope===folder.href&&[old.active,old.waiting,old.installing].filter(Boolean).some(w=>new URL(w.scriptURL).pathname!==new URL('avisos-pedidos-sw.js',folder).pathname))
  throw Error('Este panel ya tiene otra aplicación web activa en este equipo.');
 if(!reg){reg=await navigator.serviceWorker.register(new URL('avisos-pedidos-sw.js',folder),{scope:folder.href,updateViaCache:'none'});}
 for(let i=0;i<35;i++){if(reg.active)return reg;await pause(200);}
 throw Error('No se activó el servicio de avisos. Actualiza y vuelve a intentar.');
}
async function request(b,data=null){
 const auth=await token();if(!auth||branch()!==b)throw Error('Abre el local con tu acceso autorizado a pedidos.');
 const url=data?API:API+'?modo=avisos-push'+(!romo?'&branch='+encodeURIComponent(b):'');
 const r=await fetch(url,{method:data?'PATCH':'GET',cache:'no-store',credentials:'omit',
  headers:{Authorization:'Bearer '+auth,...(data?{'Content-Type':'application/json'}:{})},
  ...(data?{body:JSON.stringify({...data,action:'avisos-push',...(!romo?{branch:b}:{})})}:{}),
  signal:AbortSignal.timeout(14000)});
 const out=await r.json().catch(()=>null);
 if(!r.ok||out?.ok!==true)throw Error(out?.error||'No se pudo confirmar el aviso.');
 if(branch()!==b)throw Error('Cambió el local. Revisa la configuración.');
 return out;
}
function bytes(key){return Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4)),c=>c.charCodeAt(0));}
async function currentFor(b){
 const r=await worker(),sub=await r.pushManager.getSubscription();
 if(!sub||saved()?.branch!==b)throw Error('Primero activa los avisos para este local.');
 return sub;
}
async function prepare(b,force=false){
 if(preparing.has(b)||ready.has(b)||!force&&prepareError.has(b))return;
 preparing.add(b);prepareError.delete(b);
 try{
  const [{publicKey},r]=await Promise.all([request(b),worker()]);
  if(typeof publicKey!=='string')throw Error('No se pudo confirmar el servicio de avisos.');
  ready.set(b,{r,key:bytes(publicKey)});
 }catch(e){prepareError.set(b,e.message||'No se pudo abrir el servicio de avisos.');}
 finally{preparing.delete(b);renderBox();}
}
async function activate(b,sub){
 if(!sub)throw Error('El navegador no permitió los avisos. Revisa los permisos de notificaciones.');
 await request(b,{operacion:'activar',subscription:sub.toJSON()});
 remember({branch:b,at:Date.now()});
}
async function act(op,b,subTask){
 if(working||branch()!==b)return;
 working=true;status(op==='activar'?'Activando…':op==='prueba'?'Enviando prueba…':'Desactivando…',b);
 try{
  if(op==='activar'){await activate(b,await subTask);status('Avisos activos en este equipo para '+names[b]+'.',b);}
  else{
   const sub=await currentFor(b);
   await request(b,{operacion:op,endpoint:sub.endpoint});
   if(op==='desactivar'){await sub.unsubscribe();remember(null);status('Avisos desactivados en este equipo.',b);}
   else status('Prueba enviada. Busca el aviso del sistema, no dentro del panel.',b);
  }
 }catch(e){status(e.message||'No se confirmó la configuración de avisos.',b);}
 finally{working=false;renderBox();}
}
async function renew(b,data){
 if(renewing||working||!data||data.branch!==b||Date.now()-data.at<7*86400000||!supported()||Notification.permission!=='granted')return;
 renewing=true;
 try{const sub=await currentFor(b);await activate(b,sub);}catch{}finally{renewing=false;}
}
function button(label,fn){const b=document.createElement('button');b.className='sm';b.type='button';b.textContent=label;b.onclick=fn;b.disabled=working;return b;}
function route(b){
 if(routeHandled||incoming!==b||!b||document.body.classList.contains('uki-operativo-bloqueado'))return;
 routeHandled=true;
 queueMicrotask(()=>{
  if(branch()!==b){routeHandled=false;return;}
  if(typeof ir!=='function')return;
  ir('pedidos');
  if(S.vista!=='pedidos')return;
  if(romo){
   if(typeof ukiRomoLimpiarFiltrosPedidosQA==='function')ukiRomoLimpiarFiltrosPedidosQA();
   if(typeof ukiRomoCambiarFiltroQA==='function')ukiRomoCambiarFiltroQA('por-confirmar');
   if(typeof ukiRomoActualizarSolicitudesCartaQA==='function')void ukiRomoActualizarSolicitudesCartaQA();
  }else if(typeof ukiCambiarCategoriaPedidos==='function')ukiCambiarCategoriaPedidos('por-confirmar');
 });
}
let attached=null,previous='';
function mount(){
 const b=branch();route(b);
 const app=$('app');if(!b||!app||!['inicio','pedidos'].includes(S.vista))return;
 const stored=saved(),active=stored?.branch===b&&supported()&&Notification.permission==='granted';
 const hint=isAppleMobile&&!homeApp();
 const unusable=!supported()&&!hint;
 const msg=feedbackBranch===b?feedback:'';
 if(!hint&&!unusable&&!active)void prepare(b);
 const signature=JSON.stringify([b,active,hint,unusable,msg,working,stored?.branch,routeHandled,ready.has(b),prepareError.get(b)]);
 if(attached?.isConnected&&signature===previous)return;
 previous=signature;
 if(!attached?.isConnected){
  attached=document.createElement('section');attached.id='avisosPedidosSistema';attached.className='card';
  const header=app.querySelector('.section-head');
  if(header)header.insertAdjacentElement('afterend',attached);else app.prepend(attached);
 }
 const title=document.createElement('strong');title.textContent='🔔 Avisos de pedidos';attached.replaceChildren(title);
 const desc=document.createElement('p');desc.className='muted';desc.style.margin='6px 0';
 desc.textContent=hint?'En iPhone: abre el panel en Safari, toca Compartir → Agregar a inicio y vuelve a entrar desde ese icono.':
  unusable?'Este navegador no permite los avisos en segundo plano. Usa Edge en Windows o Safari en Mac.':
  active?'Activos en este equipo para '+names[b]+'.':
  stored?.branch&&stored.branch!==b?'Este equipo está configurado para '+names[stored.branch]+'. Activa aquí si quieres cambiar al local actual.':
  'Recibe los pedidos de la carta aunque el panel no esté abierto.';
 attached.append(desc);
 if(!hint&&!unusable){
  if(!active){
   const ok=ready.get(b),issue=prepareError.get(b);
   const enable=button(ok?'Activar avisos de pedidos':issue?'Reintentar cargar avisos':'Preparando avisos…',()=>{
    if(!ok){void prepare(b,true);return;}
    if(Notification.permission==='denied'){status('Permite las notificaciones del panel en los ajustes del navegador.',b);return;}
    // Safari exige iniciar subscribe() directamente desde el toque del usuario.
    const subTask=ok.r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:ok.key});
    void act('activar',b,subTask);
   });
   if(!ok&&!issue)enable.disabled=true;
   if(issue)desc.textContent=issue;
   attached.append(enable);
  }
  else attached.append(button('Enviar aviso de prueba',()=>void act('prueba',b)),button('Desactivar en este equipo',()=>void act('desactivar',b)));
 }
 const output=document.createElement('div');output.setAttribute('role','status');
 if(incoming&&incoming!==b&&!routeHandled)output.textContent='Este aviso corresponde a '+(names[incoming]||'otro local')+'. Abre esa sucursal para ver sus pedidos.';
 if(msg)output.textContent=msg;
 attached.append(output);
 if(active)void renew(b,stored);
}
function setup(){
 const app=$('app');if(!app)return;
 let scheduled=false;
 new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;mount();});}}).observe(app,{childList:true,subtree:true});
 mount();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
