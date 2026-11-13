'use strict';
/**
 * Un solo guardado de sucursal financiera + ficha privada, todo en borrador.
 * Este módulo no abre el local ni crea ventas. Backend se mantiene cerrado.
 */
const {normalizarFichaLocal}=require('./uki-locales-config-qa.cjs');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function prepararNuevaSucursalQA({ficha,negocioId,nombreSucursal,registroId,actor}={}){
 if(!uuid.test(String(negocioId||''))||!uuid.test(String(registroId||'')))
  throw Error('Selecciona un negocio válido');
 if(typeof actor!=='string'||actor.length<5||actor.length>256)throw Error('Acceso no autorizado');
 const branch=String(nombreSucursal||'').trim();
 if(branch.length<2||branch.length>100||/[<>\u0000-\u001f]/.test(branch))
  throw Error('Nombre de sucursal inválido');
 if(!ficha||typeof ficha!=='object'||Array.isArray(ficha))
  throw Error('Completa la ficha del local');
 const dummy='123e4567-e89b-42d3-a456-426614174099';
 const info=normalizarFichaLocal({...ficha,negocio_id:negocioId,sucursal_id:dummy},{
  negocios:[{id:negocioId}],sucursales:[{id:dummy,negocio_id:negocioId}]
 });
 return Object.freeze({
  storeId:'local:'+registroId,
  args:[negocioId,branch,registroId,'local:'+registroId,JSON.stringify(info),actor],
  configuracion:info
 });
}
const NEW_LOCAL_SQL=[
 "WITH nueva_sucursal AS (",
 " INSERT INTO public.fin_sucursales(negocio_id,nombre)",
 " VALUES($1::uuid,$2::text) ON CONFLICT(negocio_id,nombre) DO NOTHING RETURNING id",
 "), creado AS (",
 " INSERT INTO public.fin_locales_operativos_qa",
 " (id,negocio_id,sucursal_id,store_id,configuracion,creado_por,actualizado_por)",
 " SELECT $3::uuid,$1::uuid,id,$4::text,$5::jsonb,$6::text,$6::text",
 " FROM nueva_sucursal LIMIT 1 ON CONFLICT DO NOTHING",
 " RETURNING id,sucursal_id,store_id,estado,revision",
 ") SELECT * FROM creado"
].join(' ');
module.exports={prepararNuevaSucursalQA,NEW_LOCAL_SQL};
