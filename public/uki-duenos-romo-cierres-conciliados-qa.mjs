/**
 * Romo → Mi Administración QA: proyección financiera de SOLO LECTURA.
 * Solo incorpora constancias verificadas por el backend Google + PIN,
 * sin guardar asientos en fin_movimientos ni mezclar las cajas de Uki.
 * Ante ventas manuales Romo de la misma fecha, se bloquea la suma para
 * no duplicar ingresos. El nombre histórico delivery_por_pagar contiene los pagos al repartidor del cierre Romo.
 */
const STORE='romo:serena';
const N=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const ROMO=s=>/\bromo\b/.test(N(s).replace(/[’']/g,''))||/romos/.test(N(s).replace(/[’']/g,''));
const DAY=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 !Number.isNaN(Date.parse(x+'T12:00:00Z'))&&
 new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const M=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000000;
const MEDIOS=new Set(['Efectivo','Transferencia','Débito','Edenred','Junaeb','Otros','Uber Eats','PedidosYa','Rappi']);
const fail=m=>{throw Error(m);};

function alcances({negocios,sucursales,negocio_id='',sucursal_id='',razon_social_id='todos'}){
 if(razon_social_id&&razon_social_id!=='todos')return false;
 const ids=new Set(negocios.filter(b=>ROMO(b?.nombre)).map(b=>String(b.id)));
 if(!ids.size)fail('No se encontró el negocio Romo para conciliar las ventas manuales');
 if(negocio_id&&!ids.has(String(negocio_id)))return false;
 if(sucursal_id){
  const suc=sucursales.find(x=>String(x.id)===String(sucursal_id));
  if(!suc||!ids.has(String(suc.negocio_id))||!/serena/.test(N(suc.nombre)))
   return false;
 }
 return ids;
}
function validarCierre(c){
 if(!c||c.estado_contable!=='pendiente_incorporacion'||
  typeof c.turno_ref!=='string'||!/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(c.turno_ref)||
  !DAY(c.fecha_operativa)||c.fecha_operativa!==c.turno_ref.slice(0,10)||
  c.source_key!==STORE+'|'+c.turno_ref||
  !Number.isSafeInteger(c.revision_neon)||c.revision_neon<1||
  !M(c.venta_total)||!M(c.pedidos)||c.pedidos>10000||
  !M(c.gastos_cierre)||!M(c.delivery_por_pagar)||!M(c.propinas)||
  !c.medios||typeof c.medios!=='object'||Array.isArray(c.medios)||
  Object.entries(c.medios).some(([medio,valor])=>!MEDIOS.has(medio)||!M(valor))||
  Object.values(c.medios).reduce((a,b)=>a+b,0)!==c.venta_total)
  fail('Una constancia Romo es inconsistente; no se suman resultados parciales');
}
export function conciliarCierresRomoResumenQA({
 cierres=[],movimientos=[],negocios=[],sucursales=[],
 negocio_id='',sucursal_id='',razon_social_id='todos',
 desde='',hasta='',lecturaAutorizada=false,
 movimientosCompletos=false
}={}){
 const empty={items:[],confirmados:0,incluidos:0,bloqueados:0,
  deliveryPorPagar:0,soloVistaPrevia:true,motivo:''};
 if(!lecturaAutorizada)return {...empty,motivo:'Cierres Romo aún no verificados con Google y PIN'};
 if(!Array.isArray(cierres)||!Array.isArray(movimientos)||!Array.isArray(negocios)||
    !Array.isArray(sucursales)||cierres.length>=100)
  fail('No se recibió una consulta financiera completa');
 if(!movimientosCompletos)
  return {...empty,motivo:'Consulta financiera limitada o incompleta; no se suman cierres Romo'};
 const ids=alcances({negocios,sucursales,negocio_id,sucursal_id,razon_social_id});
 if(ids===false)return empty;
 const keys=new Set(),candidatos=[];
 for(const c of cierres){
  validarCierre(c);
  if(c.version_cierre!=null&&(!Number.isInteger(c.version_cierre)||c.version_cierre<2||c.version_cierre>32||c.fuente_version!==c.source_key+'|v'+c.version_cierre||!M(c.venta_original)||c.diferencia_venta!==c.venta_total-c.venta_original))fail('Versión de cierre inconsistente');
  if(keys.has(c.source_key))fail('Cierre Romo duplicado en la consulta');
  keys.add(c.source_key);
  if((desde&&c.fecha_operativa<desde)||(hasta&&c.fecha_operativa>hasta))continue;
  candidatos.push(c);
 }
 const diasManuales=new Set();
 for(const m of movimientos){
  if(m?.tipo!=='venta'||m.estado==='anulado'||!ids.has(String(m.negocio_id)))continue;
  const f=String(m.fecha||'').slice(0,10);
  if(!DAY(f))fail('Venta manual Romo con fecha desconocida; conciliar');
  diasManuales.add(f);
 }
 const items=[];let bloqueados=0,deliveryPorPagar=0;
 for(const c of candidatos){
  if(diasManuales.has(c.fecha_operativa)){bloqueados++;continue;}
  deliveryPorPagar+=c.delivery_por_pagar;
  items.push(Object.freeze({
   tipo:'cierre',marca:'romo',origen:c.version_cierre?'Cierre Romo rectificado · v'+c.version_cierre:'Cierre Romo confirmado',
   fecha:c.fecha_operativa,sucursal:'La Serena',nombre:'Romo’s Sushi',
   importe:c.venta_total,id:c.source_key,ref:c.source_key,version:c.version_cierre||1,ventaOriginal:c.venta_original??c.venta_total,
   confirmado:true,estado:'confirmado',medios:{...c.medios},
   gastos:c.gastos_cierre,delivery:c.delivery_por_pagar,deliveryPorPagar:0,
   propinas:c.propinas,retiros:0
  }));
 }
 return Object.freeze({
  items,confirmados:candidatos.length,incluidos:items.length,bloqueados,
  deliveryPorPagar,soloVistaPrevia:true,
  motivo:bloqueados?
   'Hay ventas manuales Romo en fechas de cierres; se excluyeron '+bloqueados+
    ' cierre(s) hasta conciliar para evitar duplicar ingresos.':''
 });
}
