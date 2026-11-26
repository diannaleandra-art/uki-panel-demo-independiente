'use strict';
const TYPES=new Set(['todos','entrada','conteo','merma','personal','traspasos']);
function range(input){
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 const {desde,hasta}=input,tipo=input.tipo||'todos';
 if(!valid(desde)||!valid(hasta)||desde>hasta||Date.parse(hasta)-Date.parse(desde)>30*86400000||!TYPES.has(tipo))throw Object.assign(Error('Selecciona un período de hasta 31 días y un tipo válido.'),{status:400});
 return {desde,hasta,tipo};
}
async function read(db,branch,input,items,includeJustifications=true){
 if(!['arica','serena'].includes(branch))throw Object.assign(Error('Bodega inválida.'),{status:400});
 const {desde,hasta,tipo}=range(input);
 const rows=await db.query(
 "SELECT sku,accion AS tipo,cantidad_base AS cantidad,unidad_base AS unidad,realizado_por AS responsable,creado_en AS fecha,NULL::text AS motivo,NULL::text AS folio,NULL::text AS contraparte FROM public.uki_inventario_movimientos_live WHERE branch=$1 AND accion IN ('entrada','conteo') AND (creado_en AT TIME ZONE 'America/Santiago')::date BETWEEN $2::date AND $3::date AND ($4='todos' OR accion=$4) UNION ALL "+
 "SELECT sku,action,quantity,unidad_base,worker_name,created_at,NULL::text,NULL::text,NULL::text FROM public.uki_inventario_extras_movimientos_live WHERE branch=$1 AND action IN ('entrada','conteo') AND (created_at AT TIME ZONE 'America/Santiago')::date BETWEEN $2::date AND $3::date AND ($4='todos' OR action=$4) ORDER BY fecha DESC LIMIT 2001",[branch,desde,hasta,tipo]);
 let declared=[];
 if(includeJustifications&&['todos','merma','personal','traspasos'].includes(tipo)){
  declared=await db.query("SELECT sku,kind AS tipo,quantity AS cantidad,unit AS unidad,worker AS responsable,created_at AS fecha,reason AS motivo,transfer_ref AS folio,counterparty AS contraparte FROM public.inventario_justificaciones_v1 WHERE store_id=$1 AND (created_at AT TIME ZONE 'America/Santiago')::date BETWEEN $2::date AND $3::date AND ($4='todos' OR kind=$4 OR ($4='traspasos' AND kind IN ('traspaso_salida','traspaso_entrada'))) ORDER BY created_at DESC LIMIT 2001",['uki:'+branch,desde,hasta,tipo]);
 }
 if(rows.length+declared.length>2000)throw Object.assign(Error('Hay más de 2.000 movimientos. Consulta un período más corto.'),{status:400});
 const names=new Map(items.map(x=>[x.sku,x.name]));
 return {branch,desde,hasta,tipo,justificacionesDisponibles:includeJustifications,movimientos:[...rows,...declared].sort((a,b)=>Date.parse(b.fecha)-Date.parse(a.fecha)).map(r=>({...r,name:names.get(r.sku)||r.sku,cantidad:r.cantidad===null?null:Number(r.cantidad)}))};
}
module.exports={range,read};
