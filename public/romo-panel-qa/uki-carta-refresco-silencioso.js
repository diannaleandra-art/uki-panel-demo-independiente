/* Sólo presentación de nuevas solicitudes, sin tocar ventas, caja ni borradores. */
(()=>{
'use strict';
const editables='input,textarea,select,[contenteditable]:not([contenteditable="false"])';
const tarjetas='details[data-uki-pedido-id],details.romo-pedido-card,details.uki-cancelar-pedido';
const motivos='select[id^="ukiCartaMotivo"],select[id^="ukiMotivoRechazo"],.romo-solicitud-card select';
function app(){return document.getElementById('app');}
function editing(){
 const root=app();if(!root)return false;
 const focus=document.activeElement;
 return !!(focus&&root.contains(focus)&&focus.matches(editables)||
  root.querySelector('details[data-uki-pedido-id][open],details.romo-pedido-card[open],details.uki-cancelar-pedido[open]')||
  [...root.querySelectorAll(motivos)].some(n=>n.value));
}
function applyWithoutJump(draw){
 const y=window.scrollY;
 const root=app();
 const cards=y>160&&root?[...root.querySelectorAll(tarjetas)]:[];
 const before=cards.find(c=>c.getBoundingClientRect().bottom>100);
 const key=before?.getAttribute('data-uki-pedido-id')||before?.id;
 const offset=key?before.getBoundingClientRect().top:null;
 draw();
 if(!offset&&offset!==0)return;
 const after=[...(app()?.querySelectorAll(tarjetas)||[])].find(c=>(c.getAttribute('data-uki-pedido-id')||c.id)===key);
 if(after){const delta=after.getBoundingClientRect().top-offset;if(Math.abs(delta)>1)window.scrollBy({top:delta,behavior:'instant'});}
}
function create({branch,view,protectedWork,showsPending,render}){
 let local='',ids=null,unread=new Set(),dirty=false,timer=null;
 function sync(){
  const active=branch();
  if(active!==local){local=active;ids=null;unread=new Set();dirty=false;}
 }
 function badge(){
  sync();
  const btn=document.querySelector('#nav button[aria-label="Pedidos"]');
  if(!btn)return;
  const old=btn.querySelector('[data-uki-carta-nuevos]');
  if(!unread.size){old?.remove();return;}
  const label=unread.size===1?'1 nuevo':unread.size+' nuevos';
  if(old?.textContent===label)return;
  const node=old||document.createElement('span');
  if(!old){
   node.dataset.ukiCartaNuevos='';node.setAttribute('role','status');
   node.style.cssText='display:block;font-size:10px;font-weight:750;line-height:1.1;color:#fff;background:#ae2529;padding:2px 4px;border-radius:6px;white-space:nowrap';
   btn.append(node);
  }
  node.textContent=label;
 }
 function blocked(){return view()!=='pedidos'||document.visibilityState==='hidden'||protectedWork()||editing();}
 function flush(){
  sync();
  if(!local||blocked()){badge();return false;}
  const draw=dirty;dirty=false;
  if(showsPending())unread.clear();
  if(draw)applyWithoutJump(render);
  badge();
  return draw;
 }
 function complete(b,rows,changed,force=false){
  sync();if(!local||b!==local)return false;
  if(Array.isArray(rows)){
   const next=new Set(rows.filter(x=>x?.estado==='pendiente'&&x.id).map(x=>String(x.id)));
   for(const id of next)if(!ids?.has(id))unread.add(id);
   for(const id of unread)if(!next.has(id))unread.delete(id);
   ids=next;
  }
  if(changed||force)dirty=true;
  return flush();
 }
 function settle(){
  if(timer!==null)return;
  timer=setTimeout(()=>{timer=null;flush();},0);
 }
 // Al terminar de escribir o cerrar la ficha, aplica lo ya consultado, sin un nuevo GET.
 document.addEventListener('toggle',settle,true);
 document.addEventListener('focusout',settle,true);
 document.addEventListener('click',settle,true);
 const nav=document.getElementById('nav');
 if(nav)new MutationObserver(badge).observe(nav,{childList:true,subtree:true});
 return {complete,flush,blocked};
}
window.ukiCrearRefrescoCarta=create;
window.ukiCartaFormularioActivo=editing;
})();
