'use strict';
// El punto de partida certifica un conteo físico, no habilita descuentos automáticos.
// La foto y el registro se obtienen dentro de una misma sentencia SQL.
// El token de revisión evita confirmar un inventario que cambió durante la consulta.
const sourceFor=store=>{
 if(store==='romo:serena')return `SELECT jsonb_build_object('revision',revision,'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('sku',i->>'sku','name',i->>'name','unit',i->>'stock_unit','quantity',(i->>'stock_qty')::numeric) ORDER BY i->>'sku') FROM jsonb_array_elements(contenido->'items') i WHERE COALESCE(i->>'archived','false')<>'true'),'[]'::jsonb)) AS snapshot FROM public.romo_inventario_v1 WHERE store_id=$1`;
 if(!['uki:arica','uki:serena'].includes(store))throw Error('Sucursal no autorizada');
 return `SELECT jsonb_build_object('items',COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.sku,x.source),'[]'::jsonb)) AS snapshot FROM (
 SELECT sku,name,stock_unit AS unit,stock_qty AS quantity,version,'catalogo' AS source FROM public.uki_inventario_items_live WHERE branch=split_part($1,':',2)
 UNION ALL SELECT sku,name,stock_unit,stock_qty,version,'extra' FROM public.uki_inventario_extras_live WHERE branch=split_part($1,':',2)) x`;
};
async function baseline(db,store,uid,body){
 const source=sourceFor(store);
 if(body.action==='consultar-inicio'){
 const rows=await db.query(`WITH current_stock AS (${source}) SELECT snapshot,md5(snapshot::text) AS token,(SELECT jsonb_build_object('cutoff',cutoff,'confirmed_at',confirmed_at) FROM public.costeo_inicio_v1 WHERE store_id=$1) AS existing FROM current_stock`,[store]);
 if(rows.length!==1)return {ok:false,status:409,error:'No hay inventario configurado.'};
 return {ok:true,store,...rows[0],automaticEnabled:false};
 }
 if(body.action!=='confirmar-inicio'||body.confirmar!==true||typeof body.token!=='string'||!/^[a-f0-9]{32}$/.test(body.token)||body.sinPendientes!==true)return {ok:false,status:400,error:'Confirma conteo físico y ausencia de pedidos preparados pendientes.'};
 const rows=await db.query(`WITH current_stock AS (${source}) INSERT INTO public.costeo_inicio_v1(store_id,cutoff,snapshot,confirmed_by)
 SELECT $1,statement_timestamp(),snapshot,$3 FROM current_stock WHERE md5(snapshot::text)=$2 AND jsonb_array_length(snapshot->'items')>0
 ON CONFLICT(store_id) DO NOTHING RETURNING cutoff,confirmed_at`,[store,body.token,uid]);
 if(rows.length!==1)return {ok:false,status:409,error:'El inventario cambió o ya existe un punto de inicio. Actualiza la consulta.'};
 return {ok:true,store,existing:rows[0],automaticEnabled:false};
}
module.exports={baseline};
