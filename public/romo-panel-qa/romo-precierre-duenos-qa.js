/* Romo Sushi La Serena — bandeja privada de precierres remitidos por personal.
 * No modifica pedidos/caja. El dueño confirma dentro del mismo CAS cifrado.
 */
(function(){
'use strict';
const STORE='romo:serena',LOCAL='Romo’s Sushi La Serena';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let rows=[],selected=null,busy=false;
const $=id=>document.getElementById(id);
const msg=(v,error=false)=>{const el=$('romoPersonalPrecierreStatusQA');if(el){
 el.textContent=String(v||'');el.dataset.error=String(error);
}};
const current=()=>{
 const x=window.ukiQAGet?.();
 if(x?.suc!==LOCAL||x.estado?.suc!==LOCAL)return null;
 return x.estado;
};
const openShift=()=>{
 const s=current(),day=window.ukiRomoFechaOperativaPrecierreQA?.();
 if(!s||typeof day!=='string')return null;
 const caja=s.cajasDiarias?.[LOCAL+'|'+day],shift=caja?.turnoPrecierreAbierto;
 if(!caja?.turnoAbierto||caja?.baseConfirmada!==true||!shift||
   shift.fechaOperativa!==day||!Number.isSafeInteger(Number(shift.inicioMs)))
  return null;
 return {day,shift,caja};
};
const equalName=(a,b)=>String(a||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')===
 String(b||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
async function api(body){
 const token=await window.ukiInventarioToken?.();
 if(typeof token!=='string'||token.length<30)
  throw Error('Abre el panel Romo con Google de dueños');
 const r=await fetch('/api/romo-precierre-trabajador-qa',{
  method:'POST',cache:'no-store',credentials:'omit',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(body)
 });
 const d=await r.json().catch(()=>null);
 if(!r.ok||d?.ok!==true||d.storeId!==STORE)
  throw Error(String(d?.error||'No se pudo conectar a Neon Romo').slice(0,200));
 return d;
}
async function crearPin(){
 if(busy||!current())return;
 const field=$('romoPrecierrePinCrearQA'),value=String(field?.value||'');
 if(!/^\d{6}$/.test(value))return msg('Escribe un PIN distinto del inventario: seis números.',true);
 if(!confirm('¿Registrar este PIN exclusivo de precierre? No se podrá cambiar desde este formulario.'))return;
 busy=true;msg('Configurando PIN en Neon Romo…');
 try{
  const result=await api({action:'crear-pin',codigo:value});
  if(result.configurado!==true)throw Error('Neon no confirmó la configuración');
  if(field)field.value='';
  msg('✓ PIN de precierre configurado. Entrégalo únicamente al personal autorizado.');
 }catch(e){msg(e?.message||e,true)}finally{busy=false}
}
async function estadoPin(){
 if(busy||!current())return;
 busy=true;msg('Comprobando acceso limitado…');
 try{const r=await api({action:'estado-pin'});
  msg(r.configurado?'✓ PIN de precierre configurado (no se muestra).':'PIN de precierre sin configurar.');
 }catch(e){msg(e?.message||e,true)}finally{busy=false}
}
function shareLink(){
 const x=openShift();
 if(!x){msg('Abre primero el turno de Caja y el turno del trabajador.',true);return}
 const turno=x.day+'@'+x.shift.inicioMs;
 const url=location.origin+'/romo-panel-qa/romo-precierre-trabajador.html?turno='+
  encodeURIComponent(turno);
 const text='ROMO · Precierre de tu turno\n'+url+
  '\nUsa tu PIN exclusivo de precierre; no el PIN de inventario.';
 if(typeof navigator.share==='function'){
  navigator.share({title:'Precierre Romo',text}).catch(e=>{
   if(e?.name!=='AbortError')window.prompt('Copia el enlace del trabajador:',text);
  });
 }else if(navigator.clipboard?.writeText){
  navigator.clipboard.writeText(text).then(()=>msg('✓ Enlace copiado para enviarlo al trabajador.'))
   .catch(()=>window.prompt('Copia el enlace del trabajador:',text));
 }else window.prompt('Copia el enlace del trabajador:',text);
}
function matches(record,x){
 return record?.estado==='pendiente'&&x&&
  record.fecha_operativa===x.day&&
  Number(record.inicio_ms)===Number(x.shift.inicioMs)&&
  record.turno_ref===x.day+'@'+x.shift.inicioMs&&
  equalName(record.trabajador,x.shift.nombre)&&
  UUID.test(String(record.id||''))&&
  Number.isSafeInteger(Number(record.efectivo_contado))&&
  Number(record.efectivo_contado)>=0;
}
function seleccion(){
 const x=openShift(),r=rows.find(y=>y.id===selected);
 if(!matches(r,x))return null;
 const cash=Number($('romoPrecierreContadoQA')?.value);
 const raw=String($('romoPrecierreContadoQA')?.value??'').trim();
 const note=String($('romoPrecierreObsQA')?.value||'').trim();
 if(raw===''||cash!==Number(r.efectivo_contado)||note!==String(r.observaciones||'').trim())
  return null;
 return {id:r.id,turno_ref:r.turno_ref,fecha:r.fecha_operativa,
   inicioMs:Number(r.inicio_ms),nombre:r.trabajador,efectivoContado:cash,
   observaciones:note};
}
function usar(id){
 const x=openShift(),r=rows.find(y=>y.id===id);
 if(!matches(r,x))return msg('El envío no corresponde al turno y trabajador abiertos. Revisa antes de continuar.',true);
 const count=$('romoPrecierreContadoQA'),obs=$('romoPrecierreObsQA');
 if(!count||!obs)return msg('Abre la pestaña Precierre para revisar el conteo.',true);
 count.value=String(r.efectivo_contado);
 obs.value=String(r.observaciones||'');
 selected=r.id;
 msg('✓ Conteo de '+r.trabajador+' cargado. Verifica el efectivo y pulsa Guardar precierre del trabajador. Nada se ha guardado todavía.');
 count.focus();
}
async function conciliar(r,revision){
 if(!r||!UUID.test(String(r.id||''))||
    !Number.isSafeInteger(revision)||revision<1)throw Error('Falta recibo cifrado de Romo');
 const snap=current(),registros=Object.values(snap?.cajasDiarias||{})
  .flatMap(c=>Array.isArray(c?.precierres)?c.precierres:[]);
 if(!registros.some(x=>x.solicitudId===r.id&&x.inicioMs===r.inicioMs))
  throw Error('No existe un precierre confirmado con ese identificador');
 const respuesta=await api({action:'conciliar',id:r.id,turno_ref:r.turno_ref,revision});
 if(respuesta.conciliado!==true)throw Error('Neon no reconoció la conciliación');
 selected=null;
 return true;
}
async function verEnvios(){
 if(busy||!current())return;
 busy=true;msg('Consultando conteos recibidos para Romo…');
 try{
  const result=await api({action:'pendientes'});
  if(!Array.isArray(result.envios)||result.envios.length>50)
   throw Error('Bandeja fuera de alcance');
  rows=result.envios;
  const root=$('romoPersonalPrecierreListadoQA');
  if(!root)return;
  root.replaceChildren();
  const x=openShift();
  const existing=Object.values(current()?.cajasDiarias||{})
   .flatMap(c=>Array.isArray(c?.precierres)?c.precierres:[]);
  const important=rows.filter(r=>matches(r,x)||existing.some(p=>p.solicitudId===r.id));
  for(const r of important.slice(0,25)){
   const div=document.createElement('div');div.className='card';
   const title=document.createElement('b');
   title.textContent=r.trabajador+' · '+r.fecha_operativa+' · '+r.estado;
   const detail=document.createElement('p');detail.className='muted';
   detail.textContent='Contado: $'+Number(r.efectivo_contado).toLocaleString('es-CL')+
    ' · '+String(r.observaciones||'').slice(0,240);
   div.append(title,detail);
   const saved=existing.some(p=>p.solicitudId===r.id&&Number(p.inicioMs)===Number(r.inicio_ms));
   if(matches(r,x)&&!saved){
    const button=document.createElement('button');button.type='button';button.className='sm ok';
    button.textContent='Usar conteo para precierre';
    button.onclick=()=>usar(r.id);div.append(button);
   }else if(saved&&r.estado==='pendiente'){
    const button=document.createElement('button');button.type='button';button.className='sm';
    button.textContent='Marcar como conciliado (ya guardado)';
    button.onclick=async()=>{
     button.disabled=true;
     try{
      const st=window.ukiRomoSesionRemotaQA?.estado?.();
      await conciliar({id:r.id,turno_ref:r.turno_ref,inicioMs:Number(r.inicio_ms)},
       Number(st?.revision));
      msg('✓ Envío conciliado contra un precierre ya guardado.');await verEnvios();
     }catch(e){msg(e.message||e,true)}finally{button.disabled=false}
    };
    div.append(button);
   }
   root.append(div);
  }
  msg(important.length?important.length+' registro(s) relacionados con el turno o precierres guardados.':
   'Sin envíos del trabajador para este turno. No se alteró Caja.');
 }catch(e){msg(e?.message||e,true)}
 finally{busy=false}
}
window.ukiRomoPrecierreDuenosQA=Object.freeze({
 crearPin,estadoPin,shareLink,verEnvios,seleccion,conciliar
});
})();