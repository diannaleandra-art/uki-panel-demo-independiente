/**
 * Conciliación privada, SOLO LECTURA, entre carta e inventario Romo.
 * No deducir que dos nombres parecidos están vinculados ni modificar
 * disponibles, stock, pedidos o precios automáticamente.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {readInventarioRomoQA,validateRomoInventory} from './romo-inventario-qa.mjs';
const STORE='romo:serena';
const fail=message=>{throw new Error(message)};
const normal=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLocaleLowerCase('es-CL').replace(/[^a-z0-9]/g,'');
const bool=v=>typeof v==='boolean';
const safeNombre=v=>typeof v==='string'&&v.trim().length>=2&&v.length<=100;
export function conciliarInventarioCartaRomoQA(catalogo,inventario,{revisionInventario=0}={}){
 if(catalogo?.storeId!==STORE||!Array.isArray(catalogo.ingredients)||
    catalogo.ingredients.length>1500||catalogo.ingredients.length<1||
    !Number.isSafeInteger(Number(catalogo.revision))||
    Number(catalogo.revision)<0)
  fail('El catálogo de Romo no está listo para conciliación');
 validateRomoInventory(inventario);
 if(!Number.isSafeInteger(revisionInventario)||revisionInventario<0)
  fail('Revisión de inventario Romo inválida');
 const allSku=new Set(),enlaces=new Map(),nombres=new Map();
 for(const it of inventario.items){
  if(it.kind!=='ingrediente')continue;
  if(!it.archived&&safeNombre(it.name)){
   const name=normal(it.name);
   nombres.set(name,[...(nombres.get(name)||[]),it]);
  }
  if(it.carta_sku!==undefined&&it.carta_sku!==null&&it.carta_sku!==''){
   if(typeof it.carta_sku!=='string'||!/^romo:[a-z0-9-]{3,90}$/.test(it.carta_sku))
    fail('Código de enlace inventario-carta inválido');
   enlaces.set(it.carta_sku,[...(enlaces.get(it.carta_sku)||[]),it]);
  }
 }
 const filas=[];
 for(const ing of catalogo.ingredients){
  if(!ing||typeof ing.sku!=='string'||!/^romo:[a-z0-9-]{3,90}$/.test(ing.sku)||
     !safeNombre(ing.name)||!bool(ing.visible)||!bool(ing.available)||
     allSku.has(ing.sku))fail('Ingredientes Romo inválidos o duplicados');
  allSku.add(ing.sku);
  const found=enlaces.get(ing.sku)||[];
  const suggested=nombres.get(normal(ing.name))||[];
  let estado='sin_vinculo';
  if(found.length>1)estado='vinculo_duplicado';
  else if(found.length===1){
   if(found[0].archived)estado='archivado';
   else if(found[0].available!==ing.available)estado='disponibilidad_diferente';
   else if(found[0].available&&found[0].stock_qty===0)estado='sin_stock_revisar';
   else estado='coincide';
  }
  filas.push(Object.freeze({
   sku:ing.sku,nombre:ing.name,visibleCarta:ing.visible,
   disponibleCarta:ing.available,estado,
   // Una coincidencia por nombre es sugerencia, NUNCA vínculo confirmado.
   sugerenciaSku:found.length===0&&suggested.length===1?suggested[0].sku:null,
   vinculado:found.length===1,
   disponibleInventario:found.length===1?found[0].available:null,
   stock:found.length===1?found[0].stock_qty:null,
   unidad:found.length===1?found[0].stock_unit:null
  }));
 }
 const conteos=Object.create(null);
 for(const f of filas)conteos[f.estado]=(conteos[f.estado]||0)+1;
 return Object.freeze({
  storeId:STORE,modo:'solo_lectura',soloLectura:true,
  inventarioRevision:revisionInventario,catalogoRevision:Number(catalogo.revision),
  ingredientes:filas.length,coinciden:conteos.coincide||0,
  sinVinculo:conteos.sin_vinculo||0,
  revisar:(conteos.vinculo_duplicado||0)+(conteos.archivado||0)+
   (conteos.disponibilidad_diferente||0)+(conteos.sin_stock_revisar||0),
  inventarioSinCarta:inventario.items.filter(x=>x.kind==='ingrediente'&&
   !!x.carta_sku&&!allSku.has(x.carta_sku)).length,
  filas:Object.freeze(filas),
  modificaCarta:false,modificaStock:false
 });
}
export async function consultarConciliacionInventarioCartaRomoQA({db,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','owners.read');
 if(typeof db?.query!=='function')fail('Base privada de Romo no disponible');
 const [inventory,rows]=await Promise.all([
  readInventarioRomoQA({db,identity}),
  db.query('SELECT contenido FROM public.romo_catalogo_v1 WHERE store_id=$1 LIMIT 1',[STORE])
 ]);
 if(!Array.isArray(rows)||rows.length!==1)
  fail('Catálogo Romo no disponible en esta base');
 const catalogo=typeof rows[0].contenido==='string'?
  JSON.parse(rows[0].contenido):rows[0].contenido;
 return conciliarInventarioCartaRomoQA(catalogo,inventory.contenido,{
  revisionInventario:inventory.revision
 });
}
