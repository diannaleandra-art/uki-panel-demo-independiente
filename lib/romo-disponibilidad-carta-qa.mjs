/**
 * Romo QA: disponibilidad de UN ingrediente explícitamente vinculado.
 * Actualiza inventario y catálogo en UNA sentencia Neon, bajo locks y CAS.
 * Nunca modifica precios, visibilidad, stock, promociones, pedidos ni Uki.
 * Solo dueños autorizados. El backend no confía en datos de catálogo del cliente.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {readInventarioRomoQA,validateRomoInventory,
 RomoInventarioRevisionConflicto} from './romo-inventario-qa.mjs';
const STORE='romo:serena';
const CODE=/^romo:[a-z0-9-]{3,90}$/;
const SKU=/^[A-Za-z0-9_-]{4,90}$/;
const err=message=>{throw new Error(message)};
const check=(v,message)=>{if(!v)err(message)};
const rev=n=>Number.isSafeInteger(n)&&n>=0&&n<Number.MAX_SAFE_INTEGER-1;
export class RomoDisponibilidadCartaConflictoQA extends Error{
 constructor(){super('Inventario o Carta de Romo cambió: actualiza ambas vistas antes de repetir.');
  this.code='ROMO_DISPONIBILIDAD_CONFLICTO';}
}
export function prepararDisponibilidadRomoCartaQA(inventario,catalogo,{
 identity,sku,available,expectedCatalogRevision,ahoraMs=Date.now()
}={}){
 const access=authorizeRomoOperation(identity,'romo','serena','catalog.write');
 check(typeof sku==='string'&&SKU.test(sku),'SKU de artículo inválido');
 check(typeof available==='boolean','Indica disponible o no disponible');
 check(rev(expectedCatalogRevision),'Revisión de Carta inválida');
 check(Number.isSafeInteger(ahoraMs)&&ahoraMs>1700000000000&&
  ahoraMs<=Date.now()+300000,'Fecha del movimiento inválida');
 const old=validateRomoInventory(inventario);
 const nextInv=structuredClone(old);
 check(catalogo&&catalogo.storeId===STORE&&
  rev(catalogo.revision)&&catalogo.revision===expectedCatalogRevision&&
  Array.isArray(catalogo.ingredients)&&catalogo.ingredients.length>0&&
  catalogo.ingredients.length<=1500,'Carta Romo no corresponde a esta revisión');
 const nextCat=structuredClone(catalogo);
 const items=nextInv.items.filter(x=>x.sku===sku);
 check(items.length===1,'El artículo Romo no está registrado');
 const article=items[0],previous=structuredClone(article);
 check(article.kind==='ingrediente'&&!article.archived&&
  typeof article.carta_sku==='string'&&CODE.test(article.carta_sku),
  'El artículo no tiene vínculo vigente con ingrediente de Carta');
 check(nextInv.items.filter(x=>x.carta_sku===article.carta_sku).length===1,
  'El ingrediente de Carta tiene más de un vínculo');
 const skus=new Set();
 for(const ingredient of nextCat.ingredients){
  check(ingredient&&typeof ingredient.sku==='string'&&CODE.test(ingredient.sku)&&
   !skus.has(ingredient.sku)&&typeof ingredient.available==='boolean'&&
   typeof ingredient.visible==='boolean',
   'Catálogo Romo contiene ingredientes inválidos o repetidos');
  skus.add(ingredient.sku);
 }
 const matches=nextCat.ingredients.filter(x=>x.sku===article.carta_sku);
 check(matches.length===1,'El vínculo apunta a un ingrediente inexistente');
 const originalCarta=matches[0].available;
 check(previous.available!==available||originalCarta!==available,
  'La disponibilidad ya coincide: no se necesita registrar un cambio');
 article.available=available;matches[0].available=available;
 nextCat.revision=expectedCatalogRevision+1;
 const event={tipo:'disponibilidad_carta',sku,actor:access.actorId,
  fechaMs:ahoraMs,antes:previous,despues:structuredClone(article),
  cartaSku:article.carta_sku,catalogoRevisionAnterior:expectedCatalogRevision,
  disponibleCartaAnterior:originalCarta,disponibleCartaNuevo:available};
 nextInv.movimientos=[...nextInv.movimientos,event].slice(-3000);
 validateRomoInventory(nextInv);
 check(nextCat.ingredients.length===catalogo.ingredients.length,
  'No se deben agregar ingredientes automáticamente');
 return Object.freeze({
  inventario:nextInv,catalogo:nextCat,
  cambio:Object.freeze({sku,cartaSku:article.carta_sku,available,
   actor:access.actorId,fechaMs:ahoraMs}),
  cambiosPermitidos:['available','revision','historial'],
  modificaPrecios:false,modificaStock:false,modificaVisibilidad:false
 });
}
/**
 * Cada lectura comprueba la revisión y el snapshot. El WRITE usa FOR UPDATE
 * de las dos filas en una misma sentencia con dos UPDATE condicionados:
 * si una revisión o contenido cambió, no se ejecuta ninguno.
 */
export async function guardarDisponibilidadRomoCartaQA({
 db,identity,expectedRevision,args={},ahoraMs=Date.now()
}={}){
 authorizeRomoOperation(identity,'romo','serena','catalog.write');
 check(typeof db?.query==='function','Base Neon Romo no disponible');
 check(rev(expectedRevision)&&rev(args.expectedCatalogRevision),
  'Revisiones de Inventario o Carta inválidas');
 check(args.confirmado===true,'Confirma la actualización en Inventario y Carta');
 check(typeof args.sku==='string'&&SKU.test(args.sku)&&
  typeof args.available==='boolean','Solo se permite cambiar disponibilidad');
 const inv=await readInventarioRomoQA({db,identity});
 if(inv.revision!==expectedRevision)throw new RomoInventarioRevisionConflicto();
 const rowsCat=await db.query(
  'SELECT revision,contenido FROM public.romo_catalogo_v1 WHERE store_id=$1 LIMIT 1',
  [STORE]);
 check(Array.isArray(rowsCat)&&rowsCat.length===1,'Catálogo Romo no disponible');
 const row=rowsCat[0],catalogoRevision=Number(row.revision);
 check(rev(catalogoRevision),'Revisión Neon del catálogo inválida');
 if(catalogoRevision!==args.expectedCatalogRevision)
  throw new RomoDisponibilidadCartaConflictoQA();
 const cat=typeof row.contenido==='string'?JSON.parse(row.contenido):row.contenido;
 const cambio=prepararDisponibilidadRomoCartaQA(inv.contenido,cat,{
  identity,sku:args.sku,available:args.available,
  expectedCatalogRevision:catalogoRevision,ahoraMs
 });
 const beforeInv=JSON.stringify(inv.contenido),beforeCat=JSON.stringify(cat);
 const nextInv=JSON.stringify(cambio.inventario),nextCat=JSON.stringify(cambio.catalogo);
 // Las dos tablas ya deben existir: no crear registros ni inventar stock.
 // Los bloqueos y la igualdad de contenido evitan escrituras parcialmente
 // confirmadas si otro equipo actuó mientras se preparaba la operación.
 const sql=
 'WITH old_inventory AS MATERIALIZED ('+
 ' SELECT revision,contenido FROM public.romo_inventario_v1 '+
 ' WHERE store_id=$1 FOR UPDATE), '+
 'old_catalog AS MATERIALIZED ('+
 ' SELECT revision,contenido FROM public.romo_catalogo_v1 '+
 ' WHERE store_id=$1 FOR UPDATE), '+
 'verified AS MATERIALIZED ('+
 ' SELECT 1 FROM old_inventory i CROSS JOIN old_catalog c '+
 ' WHERE i.revision=$2 AND c.revision=$3 '+
 ' AND i.contenido=$4::jsonb AND c.contenido=$5::jsonb), '+
 'save_inventory AS ('+
 ' UPDATE public.romo_inventario_v1 AS v SET '+
 ' revision=$2+1,contenido=$6::jsonb,actualizado_por=$8,actualizado_en=now() '+
 ' WHERE v.store_id=$1 AND v.revision=$2 AND EXISTS(SELECT 1 FROM verified) '+
 ' RETURNING v.revision), '+
 'save_catalog AS ('+
 ' UPDATE public.romo_catalogo_v1 AS v SET '+
 ' revision=$3+1,contenido=$7::jsonb,actualizado_por=$8,actualizado_en=now() '+
 ' WHERE v.store_id=$1 AND v.revision=$3 AND EXISTS(SELECT 1 FROM verified) '+
 ' RETURNING v.revision) '+
 'SELECT i.revision AS inventario_revision,c.revision AS catalogo_revision '+
 'FROM save_inventory i CROSS JOIN save_catalog c';
 const result=await db.query(sql,[STORE,expectedRevision,catalogoRevision,
  beforeInv,beforeCat,nextInv,nextCat,identity.userId]);
 if(!Array.isArray(result)||result.length!==1||
  Number(result[0].inventario_revision)!==expectedRevision+1||
  Number(result[0].catalogo_revision)!==catalogoRevision+1)
  throw new RomoDisponibilidadCartaConflictoQA();
 return Object.freeze({
  storeId:STORE,revision:expectedRevision+1,catalogoRevision:catalogoRevision+1,
  cambio:cambio.cambio,atomic:true,sinModificarUki:true
 });
}
