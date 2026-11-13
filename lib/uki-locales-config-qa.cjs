'use strict';
// Un nuevo local es una CONFIGURACIÓN en borrador, no una copia de ventas.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const str=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const err=s=>{throw Error(s)};
const MODULOS=Object.freeze({carta:false,pedidos:false,caja:false,inventario:false,timbres:false,cierres:false,publicado:false});
function normalizarFichaLocal(v,{negocios=[],sucursales=[]}={}){
 if(!v||typeof v!=='object'||Array.isArray(v))err('Ficha no válida');
 const allow=['negocio_id','sucursal_id','nombre','direccion','whatsapp','instagram','horarios','plantilla','color','logoUrl','portadaUrl'];
 if(Object.keys(v).some(k=>!allow.includes(k)))err('No puedes activar ventas ni copiar datos desde la ficha');
 if(!UUID.test(String(v.negocio_id||''))||!UUID.test(String(v.sucursal_id||'')))err('Selecciona negocio y sucursal');
 if(!negocios.some(b=>b.id===v.negocio_id)||
    !sucursales.some(s=>s.id===v.sucursal_id&&s.negocio_id===v.negocio_id))
  err('La sucursal no pertenece a ese negocio');
 const nombre=str(v.nombre,90),direccion=str(v.direccion,200),horarios=str(v.horarios,180);
 if(nombre.length<3||direccion.length<5)err('Completa nombre y dirección');
 if(!['uki-motor','carta-vacia'].includes(v.plantilla))err('Plantilla inválida');
 const color=str(v.color,10).toLowerCase();
 if(!/^#[a-f0-9]{6}$/.test(color))err('Color inválido');
 const wa=str(v.whatsapp,30).replace(/\D/g,'');
 if(wa&&!/^569\d{8}$/.test(wa))err('WhatsApp chileno inválido');
 const insta=str(v.instagram,50).replace(/^@/,'');
 if(insta&&!/^[A-Za-z0-9._]{1,30}$/.test(insta))err('Usuario de Instagram inválido');
 const image=x=>{
  const value=str(x,500);if(!value)return '';
  let u;try{u=new URL(value)}catch{err('Enlace de imagen inválido')}
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.hostname==='localhost')
   err('Las imágenes deben estar alojadas en HTTPS');
  return u.href;
 };
 return Object.freeze({version:1,nombre,direccion,whatsapp:wa?'+'+wa:'',
  instagram:insta?'@'+insta:'',horarios,plantilla:v.plantilla,color,
  logoUrl:image(v.logoUrl),portadaUrl:image(v.portadaUrl),
  motor:'uki-panel-unico',copiarDatos:false,modulos:{...MODULOS}});
}
function storeIdConocido(brand,local){
 const clean=x=>str(x,120).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const n=clean(brand),s=clean(local),serena=/serena|balmaceda/.test(s);
 if(/\buki\b/.test(n)&&/arica|regimiento/.test(s))return 'uki:arica';
 if(/\buki\b/.test(n)&&serena)return 'uki:serena';
 if(/\bromo/.test(n)&&serena)return 'romo:serena';
 return null;
}
module.exports={normalizarFichaLocal,storeIdConocido,MODULOS};
