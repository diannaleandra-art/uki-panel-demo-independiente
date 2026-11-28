/* Aviso local para el personal. No confirma pagos ni envía mensajes al cliente. */
(()=>{
 'use strict';
 let operacion=null, caja=null, texto=null, cerrar=null, timer=null;
 const controles=new WeakMap();
 function quitar(){
  clearTimeout(timer);timer=null;
  caja?.remove();caja=texto=cerrar=null;
 }
 function mostrar(mensaje,tipo){
  clearTimeout(timer);timer=null;
  if(!caja){
   caja=document.createElement('aside');caja.id='ukiEstadoGuardadoPedido';
   caja.style.cssText='position:fixed;z-index:250;top:calc(env(safe-area-inset-top, 0px) + 12px);left:50%;transform:translateX(-50%);width:calc(100% - 24px);max-width:460px;box-sizing:border-box;padding:13px 15px;border:1px solid;border-radius:14px;box-shadow:0 8px 23px #25201838;display:flex;gap:10px;align-items:center;font:600 15px/1.4 system-ui,sans-serif';
   texto=document.createElement('div');texto.setAttribute('role','status');texto.setAttribute('aria-atomic','true');texto.style.flex='1';
   cerrar=document.createElement('button');cerrar.type='button';cerrar.className='sm';cerrar.textContent='Cerrar';
   cerrar.onclick=quitar;caja.append(texto,cerrar);document.body.append(caja);
  }
  const color=tipo==='ok'?['#e8f4eb','#214b31','#77a688']:tipo==='duda'?['#fff1df','#713e15','#c38c57']:['#faf6ee','#493319','#c3a577'];
  [caja.style.background,caja.style.color,caja.style.borderColor]=color;
  cerrar.hidden=tipo==='proceso';
  texto.textContent=mensaje;
  if(tipo==='ok')timer=setTimeout(quitar,8500);
 }
 function controlesActuales(boton=operacion?.boton){
  for(const id of ['ukiGuardarPedido','ukiCancelarEdicionPedido',...(boton?[boton]:[])]){
   const b=document.getElementById(id);if(!b)continue;
   const antes=controles.get(b);
   const guardar=id!=='ukiCancelarEdicionPedido';
   if(operacion){
    if(!antes)controles.set(b,{disabled:b.disabled,nodos:guardar?[...b.childNodes]:null});
    b.disabled=true;
    if(guardar){b.setAttribute('aria-busy','true');b.textContent=operacion.pago?'Guardando pago…':'Guardando…';}
   }else if(antes){
    b.disabled=antes.disabled;
    b.removeAttribute('aria-busy');
    if(antes.nodos)b.replaceChildren(...antes.nodos);
    controles.delete(b);
   }
  }
 }
 function requisito(b,disabled){
  if(!b)return;
  const antes=controles.get(b);
  if(antes)antes.disabled=disabled;
  b.disabled=!!operacion||disabled;
 }
 function iniciar(pago,boton=null){
  if(operacion)return null;
  const actual={pago:pago===true,boton,resultado:null};operacion=actual;
  controlesActuales();
  mostrar(actual.pago?'Guardando pago… Espera la confirmación.':'Guardando pedido… Espera la confirmación.','proceso');
  return actual;
 }
 function resultado(mensaje,tipo){
  if(operacion)operacion.resultado={mensaje,tipo};
 }
 function terminar(actual){
  if(!actual||operacion!==actual)return;
  operacion=null;controlesActuales(actual.boton);
  if(actual.resultado)mostrar(actual.resultado.mensaje,actual.resultado.tipo);
  else quitar();
 }
 window.ukiEstadoGuardadoPedido=Object.freeze({iniciar,terminar,resultado,requisito,controlesActuales,ocupado:()=>!!operacion});
})();
