/**
 * Vínculo explícito entre artículo de inventario y SKU de carta.
 * Solo QA y solo dueños. Se guarda en inventario Romo con CAS Neon.
 * NO sincroniza existencias, disponibilidad, precios ni ventas.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {readInventarioRomoQA,validateRomoInventory,
 RomoInventarioRevisionConflicto} from './romo-inventario-qa.mjs';
const STORE='romo:serena';
const LINK=/^romo:[a-z0-9-]{3,90}$/;
const SKU=/^[A-Za-z0-9_-]{4,90}$/;
const fail=(m)=>{throw new Error(m)};
const ensure=(x,m)=>{if(!x)fail(m)};
const rev=n=>Number.isSafeInteger(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER-1;
function comprobarCatalogoRomo(catalogo,revision){
 ensure(catalogo?.storeId===STORE&&Array.isArray(catalogo.ingredients)&&
  catalogo.ingredients.length>=1&&catalogo.ingredients.length<=1500&&
  rev(catalogo.revision)&&catalogo.revision===revision,
  'Revisión o contenido de catálogo Romo inválido');
 const codigos=new Set();
 for(const ingrediente of catalogo.ingredients){
  ensure(ingrediente&&typeof ingrediente.sku==='string'&&
   LINK.test(ingrediente.sku)&&
   typeof ingrediente.name==='string'&&ingrediente.name.trim().length>=2&&
   ingrediente.name.length<=100&&typeof ingrediente.available==='boolean'&&
   typeof ingrediente.visible==='boolean'&&!codigos.has(ingrediente.sku),
   'Catálogo Romo contiene ingredientes duplicados o inválidos');
  codigos.add(ingrediente.sku);
 }
 return codigos;
}
export function prepararVinculoInventarioCartaRomoQA(original,{
 identity,action,args,catalogo=null,ahoraMs=Date.now()
}={}){
 const auth=authorizeRomoOperation(identity,'romo','serena','catalog.write');
 ensure(['vincular_carta','desvincular_carta'].includes(action),
  'Solo se permite vincular o desvincular ingredientes');
 ensure(Number.isSafeInteger(ahoraMs)&&ahoraMs>1700000000000&&
  ahoraMs<=Date.now()+300000,'Momento de enlace inválido');
 ensure(args&&typeof args==='object'&&!Array.isArray(args)&&
  typeof args.sku==='string'&&SKU.test(args.sku),
  'Artículo de inventario inválido');
 ensure(args.confirmado===true,
  'Se requiere confirmación expresa del vínculo de ingrediente');
 const state=structuredClone(validateRomoInventory(original));
 const item=state.items.find(x=>x.sku===args.sku);
 ensure(item&&item.kind==='ingrediente',
  'Solo se puede vincular un artículo del tipo ingrediente');
 const before=structuredClone(item);
 let catalogoRevision=null;
 if(action==='vincular_carta'){
  ensure(!item.archived,'El artículo está archivado');
  ensure(item.carta_sku===undefined||item.carta_sku===null,
   'El artículo ya está vinculado: desvincula antes de cambiarlo');
  ensure(typeof args.carta_sku==='string'&&LINK.test(args.carta_sku)&&
   rev(args.catalogoRevision),
   'El código o revisión de carta no es válido');
  catalogoRevision=args.catalogoRevision;
  const codigos=comprobarCatalogoRomo(catalogo,catalogoRevision);
  ensure(codigos.has(args.carta_sku),
   'El ingrediente seleccionado no existe en la carta actual de Romo');
  ensure(!state.items.some(x=>x.sku!==item.sku&&
   x.carta_sku===args.carta_sku),
   'Este ingrediente de carta ya está vinculado con otro artículo');
  item.carta_sku=args.carta_sku;
 }else{
  ensure(typeof item.carta_sku==='string'&&LINK.test(item.carta_sku),
   'No existe vínculo que deshacer');
  ensure(typeof args.motivo==='string'&&args.motivo.trim().length>=4&&
   args.motivo.trim().length<=160,'Indica un motivo para desvincular');
  delete item.carta_sku;
 }
 const event={tipo:action,sku:args.sku,actor:auth.actorId,fechaMs:ahoraMs,
  antes:before,despues:structuredClone(item),
  ...(action==='desvincular_carta'?{motivo:args.motivo.trim()}:{catalogoRevision})};
 state.movimientos=[...state.movimientos,event].slice(-3000);
 validateRomoInventory(state);
 return Object.freeze({
  state,change:Object.freeze({tipo:action,sku:args.sku,actor:auth.actorId,
   cartaSku:action==='vincular_carta'?item.carta_sku:null,fechaMs:ahoraMs})
 });
}
export async function guardarVinculoInventarioCartaRomoQA({
 db,identity,expectedRevision,action,args,ahoraMs=Date.now()
}={}){
 authorizeRomoOperation(identity,'romo','serena','catalog.write');
 ensure(typeof db?.query==='function','Neon Romo no disponible');
 ensure(rev(expectedRevision),'Revisión de inventario inválida');
 ensure(['vincular_carta','desvincular_carta'].includes(action),
  'Acción de enlace no permitida');
 const before=await readInventarioRomoQA({db,identity});
 if(before.revision!==expectedRevision)throw new RomoInventarioRevisionConflicto();
 let catalogo=null,catalogoRevision=null;
 if(action==='vincular_carta'){
  ensure(rev(args?.catalogoRevision),'Revisión de carta inválida');
  const rows=await db.query(
   'SELECT revision,contenido FROM public.romo_catalogo_v1 WHERE store_id=$1 LIMIT 1',
   [STORE]);
  ensure(Array.isArray(rows)&&rows.length===1,
   'No se pudo verificar la carta Romo');
  const row=rows[0],revDb=Number(row.revision);
  catalogo=typeof row.contenido==='string'?JSON.parse(row.contenido):row.contenido;
  ensure(rev(revDb)&&revDb===args.catalogoRevision&&
   Number(catalogo?.revision)===revDb,'La carta cambió; actualiza antes de vincular');
  catalogoRevision=revDb;
 }
 const {state,change}=prepararVinculoInventarioCartaRomoQA(before.contenido,{
  identity,action,args,catalogo,ahoraMs
 });
 const contenido=JSON.stringify(state);
 let sql,params;
 if(action==='vincular_carta'){
  // La MISMA sentencia que inserta verifica también SKU y revisión actual
  // de catálogo, para rechazar selecciones desactualizadas entre dos equipos.
  sql='INSERT INTO public.romo_inventario_v1 AS v '+
   '(store_id,revision,contenido,actualizado_por,actualizado_en) '+
   'SELECT $1,$2,$3::jsonb,$4,now() FROM public.romo_catalogo_v1 AS c '+
   'WHERE c.store_id=$1 AND c.revision=$6 '+
   "AND (c.contenido->>'revision')::bigint=$6 "+
   "AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.contenido->'ingredients') AS i "+
   "WHERE i->>'sku'=$7) "+
   'ON CONFLICT (store_id) DO UPDATE SET '+
   'revision=EXCLUDED.revision,contenido=EXCLUDED.contenido,'+
   'actualizado_por=EXCLUDED.actualizado_por,actualizado_en=now() '+
   'WHERE v.revision=$5 RETURNING revision';
  params=[STORE,expectedRevision+1,contenido,identity.userId,expectedRevision,
   catalogoRevision,args.carta_sku];
 }else{
  sql='INSERT INTO public.romo_inventario_v1 AS v '+
   '(store_id,revision,contenido,actualizado_por,actualizado_en) '+
   'VALUES($1,$2,$3::jsonb,$4,now()) ON CONFLICT (store_id) DO UPDATE SET '+
   'revision=EXCLUDED.revision,contenido=EXCLUDED.contenido,'+
   'actualizado_por=EXCLUDED.actualizado_por,actualizado_en=now() '+
   'WHERE v.revision=$5 RETURNING revision';
  params=[STORE,expectedRevision+1,contenido,identity.userId,expectedRevision];
 }
 const rows=await db.query(sql,params);
 if(!Array.isArray(rows)||rows.length!==1||
  Number(rows[0].revision)!==expectedRevision+1)
  throw new RomoInventarioRevisionConflicto();
 return Object.freeze({storeId:STORE,revision:expectedRevision+1,change,
  modificaCarta:false,modificaDisponibilidad:false});
}
