/* Uki · vista de dueños. SOLO PRESENTACIÓN en QA.
 * Une ventas manuales y cierres confirmados para consultar su historial.
 * Jamás combina importes ni crea movimientos; el resumen contable existente
 * permanece en su origen para no duplicar ingresos.
 */
const n=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 !Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const validMoney=m=>Number.isSafeInteger(Number(m))&&Number(m)>=0&&Number(m)<=1e9;
const key=s=>n(s).replace(/\s+/g,'');
const branchAuto=s=>/regimiento|arica/.test(n(s))?'arica':
 /la serena|serena/.test(n(s))?'serena':null;
const isUkiBusiness=(b,id)=>b.some(x=>String(x.id)===String(id)&&/\buki\b/i.test(String(x.nombre||'')));
function allowAuto({negocio_id='',sucursal_id='',razon_social_id='todos',negocios=[],sucursales=[]}={}){
 if(razon_social_id&&razon_social_id!=='todos')return {enabled:false,branch:null};
 if(negocio_id&&!isUkiBusiness(negocios,negocio_id))return {enabled:false,branch:null};
 if(!sucursal_id)return {enabled:true,branch:null};
 const suc=sucursales.find(x=>String(x.id)===String(sucursal_id));
 const chosen=branchAuto(suc?.nombre);
 return {enabled:!!chosen&&(!negocio_id||String(suc?.negocio_id)===String(negocio_id)),branch:chosen};
}
const pagos=c=>Object.fromEntries(Object.entries(c.medios||{})
 .filter(([k,v])=>typeof k==='string'&&k.length<=35&&validMoney(v)));
export function unirVentasDuenos({movimientos=[],cierres=[],desde='',hasta='',negocio_id='',sucursal_id='',razon_social_id='todos',negocios=[],sucursales=[]}={}){
 const visibles=Array.isArray(movimientos)?movimientos:[];
 const manuales=visibles.filter(m=>m&&m.tipo==='venta'&&validDay(String(m.fecha||'').slice(0,10))&&
  validMoney(m.monto)).map(m=>({
   origen:m.fuente==='cierre'?'Cierre ingresado manualmente':'Venta manual',
   fecha:String(m.fecha).slice(0,10),sucursal:(
    sucursales.find(x=>String(x.id)===String(m.sucursal_id))?.nombre||'General'),
   nombre:negocios.find(x=>String(x.id)===String(m.negocio_id))?.nombre||'Negocio',
   importe:Number(m.monto),id:String(m.id||''),ref:String(m.referencia||'').trim(),
   estado:String(m.estado||''),tipo:'manual',confirmado:false,medios:null
  })).filter(m=>(!desde||m.fecha>=desde)&&(!hasta||m.fecha<=hasta));
 const opts=allowAuto({negocio_id,sucursal_id,razon_social_id,negocios,sucursales});
 const vistos=new Set();
 const auto=(Array.isArray(cierres)?cierres:[]).filter(c=>{
  if(!opts.enabled||!['arica','serena'].includes(c?.branch)||
   !validDay(String(c.fecha_operativa||'').slice(0,10))||!validMoney(c.venta_total)||
   typeof c.turno_ref!=='string'||!/^uki\|(arica|serena)\|\d{13}$/.test(c.turno_ref))return false;
  const fecha=String(c.fecha_operativa).slice(0,10);
  if((desde&&fecha<desde)||(hasta&&fecha>hasta)||(opts.branch&&opts.branch!==c.branch))return false;
  const k=c.branch+'|'+c.turno_ref;
  if(vistos.has(k))return false;
  vistos.add(k);return true;
 }).map(c=>({
  origen:'Cierre final automático',fecha:String(c.fecha_operativa).slice(0,10),
  sucursal:c.branch==='arica'?'Regimiento Arica':'La Serena',
  nombre:'Uki Sushi',importe:Number(c.venta_total),id:c.turno_ref,ref:c.turno_ref,
  tipo:'cierre',confirmado:true,estado:'confirmado',medios:pagos(c),
  gastos:Number(c.gastos_cierre||0),delivery:Number(c.delivery_por_pagar||0),
  propinas:Number(c.propinas||0),retiros:Number(c.retiros||0)
 }));
 const referenciaManual=new Map();
 for(const m of manuales)if(m.ref&&m.estado!=='anulado')referenciaManual.set(key(m.ref),m);
 let coincidencias=0,conflictos=0;
 const autosVisibles=[];
 for(const c of auto){
  const manual=referenciaManual.get(key(c.ref));
  if(manual&&manual.importe===c.importe){
   manual.confirmado=true;manual.origen='Cierre final · ya registrado manualmente';
   coincidencias++;
  }else{
   if(manual)conflictos++;
   autosVisibles.push(c);
  }
 }
 const items=[...manuales,...autosVisibles].sort((a,b)=>
  b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id));
 return {
  items,
  manuales:manuales.length,cierresConfirmados:auto.length,
  coincidencias,conflictos,
  totalManual:manuales.filter(x=>x.estado!=='anulado').reduce((n,x)=>n+x.importe,0),
  totalCierresSoloInformativo:auto.reduce((n,x)=>n+x.importe,0)
 };
}

/**
 * Extensión de PRESENTACIÓN QA, no realiza red ni crea movimientos.
 * Los cierres Romo viven en tabla independiente; no reutilizar filas Uki.
 * Importes informativos NO se suman automáticamente a las ventas manuales.
 */
export function unirVentasDuenosConRomoQA({
 cierresRomo=[],movimientos=[],cierres=[],desde='',hasta='',
 negocio_id='',sucursal_id='',razon_social_id='todos',
 negocios=[],sucursales=[]
}={}){
 const base=unirVentasDuenos({movimientos,cierres,desde,hasta,negocio_id,
  sucursal_id,razon_social_id,negocios,sucursales});
 const romo=negocios.find(b=>/romo.?s sushi/i.test(n(b?.nombre||'')));
 // Sin negocio Romo explícito en catálogo no asumir que existe.
 if(!romo||razon_social_id!=='todos')return {
  ...base,cierresRomoConfirmados:0,coincidenciasRomo:0,
  conflictosRomo:0,totalCierresRomoSoloInformativo:0
 };
 if(negocio_id&&String(negocio_id)!==String(romo.id))return {
  ...base,cierresRomoConfirmados:0,coincidenciasRomo:0,
  conflictosRomo:0,totalCierresRomoSoloInformativo:0
 };
 const sucRomo=sucursales.find(s=>String(s?.negocio_id)===String(romo.id)&&
  /serena/.test(n(s?.nombre||'')));
 if(!sucRomo||(sucursal_id&&String(sucursal_id)!==String(sucRomo.id)))return {
  ...base,cierresRomoConfirmados:0,coincidenciasRomo:0,
  conflictosRomo:0,totalCierresRomoSoloInformativo:0
 };
 const vistos=new Set();
 const auto=(Array.isArray(cierresRomo)?cierresRomo:[]).filter(x=>{
  if(!x||x.store_id!=='romo:serena'||x.estado&&x.estado!=='cerrado'||
   !validDay(String(x.fecha_operativa||'').slice(0,10))||
   !validMoney(x.venta_total)||typeof x.turno_ref!=='string'||
   !/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(x.turno_ref)||
   x.source_key!=='romo:serena|'+x.turno_ref||
   x.turno_ref.slice(0,10)!==String(x.fecha_operativa).slice(0,10))
   return false;
  const fecha=String(x.fecha_operativa).slice(0,10);
  if((desde&&fecha<desde)||(hasta&&fecha>hasta))return false;
  if(vistos.has(x.source_key))return false;
  vistos.add(x.source_key);return true;
 }).map(x=>({
  origen:'Cierre final automático · Romo',
  fecha:String(x.fecha_operativa).slice(0,10),
  sucursal:'La Serena',nombre:'Romo’s Sushi',
  importe:Number(x.venta_total),id:x.source_key,ref:x.source_key,
  tipo:'cierre',confirmado:true,estado:'confirmado',medios:pagos(x),
  gastos:Number(x.gastos_cierre||0),
  delivery:Number(x.delivery_por_pagar||0),
  propinas:Number(x.propinas||0),retiros:Number(x.retiros||0)
 }));
 const items=[...base.items],manualesRomo=items.filter(x=>x.tipo==='manual'&&
  /romo/i.test(n(x.nombre))&&/serena/i.test(n(x.sucursal))&&x.estado!=='anulado');
 let coincidencias=0,conflictos=0;
 for(const cierre of auto){
  const refAlterna=cierre.id.slice('romo:serena|'.length);
  const manual=manualesRomo.find(x=>{
   const r=key(x.ref);return r===key(cierre.id)||r===key(refAlterna);
  });
  if(manual&&manual.importe===cierre.importe){
   manual.confirmado=true;
   manual.origen='Cierre Romo · ya registrado manualmente';
   coincidencias++;
  }else{
   if(manual)conflictos++;
   items.push(cierre);
  }
 }
 items.sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id));
 return {...base,items,cierresRomoConfirmados:auto.length,
  coincidenciasRomo:coincidencias,conflictosRomo:conflictos,
  totalCierresRomoSoloInformativo:auto.reduce((a,x)=>a+x.importe,0)};
}
