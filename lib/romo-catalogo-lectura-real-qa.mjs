/**
 * Vista de SOLO LECTURA del catálogo REAL ya guardado de Romo La Serena.
 * Mantiene las categorías y categoriaSlug presentes en Neon; el adaptador
 * editor QA anterior NO reconoce todavía esos campos, y NO debe escribir.
 * No toca precios, promociones, fotos ni datos de Uki.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
const STORE='romo:serena';
const STRING=x=>typeof x==='string'&&x.length>0&&x.length<=500;
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const INT=x=>Number.isSafeInteger(x)&&x>=0;
const MAX_BYTES=180000;
const REQUIRE={
 categories:['slug','nombre','visible','version'],
 products:['sku','name','price','available','visible','version'],
 ingredients:['sku','name','category','surcharge','surfaces','available','visible','version'],
 promotions:['sku','name','price','promoType','available','visible','version']
};
function checkList(doc,field,max){
 const list=doc[field];
 if(!Array.isArray(list)||list.length>max)throw Error('Catálogo Romo incompleto');
 for(const item of list){
  if(!OBJ(item)||REQUIRE[field].some(k=>!Object.hasOwn(item,k)))
   throw Error('Registro de Romo incompleto');
  if(!INT(item.version)||item.version<1||typeof item.visible!=='boolean')
   throw Error('Estado Romo inválido');
  if(field==='categories'){
   if(!STRING(item.slug)||!STRING(item.nombre))throw Error('Categoría Romo inválida');
  }else{
   if(!STRING(item.sku)||!STRING(item.name)||typeof item.available!=='boolean')
    throw Error('Producto Romo inválido');
   if(field==='ingredients'){
    if(!Array.isArray(item.surfaces)||!INT(item.surcharge)||!STRING(item.category))
     throw Error('Ingrediente Romo inválido');
   }else if(!INT(item.price))throw Error('Precio Romo inválido');
  }
 }
}
export function validarCatalogoRealRomoQA(row){
 if(!OBJ(row))throw Error('Catálogo Romo no encontrado');
 const revision=Number(row.revision);
 const doc=typeof row.contenido==='string'?JSON.parse(row.contenido):row.contenido;
 if(!OBJ(doc)||doc.storeId!==STORE||doc.brand!=='romo'||
    !INT(revision)||revision<1||doc.revision!==revision)
  throw Error('Catálogo de otro local o versión inesperada');
 checkList(doc,'categories',100);
 checkList(doc,'products',300);
 checkList(doc,'ingredients',200);
 checkList(doc,'promotions',100);
 for(const section of ['products','promotions']){
  for(const item of doc[section]){
   if(item.categoriaSlug!==undefined&&!STRING(item.categoriaSlug))
    throw Error('Asignación de categoría inválida');
  }
 }
 if(Buffer.byteLength(JSON.stringify(doc),'utf8')>MAX_BYTES)
  throw Error('Catálogo Romo demasiado grande');
 // Sólo lectura: conservamos campos relevantes del registro tal como están,
 // incluidas categories y categoriaSlug. No serializar nunca para REEMPLAZAR
 // un documento Neon desde esta vista.
 return Object.freeze({
  ok:true,storeId:STORE,revision,
  catalogo:Object.freeze({
   storeId:STORE,brand:'romo',revision,
   categories:doc.categories.map(x=>Object.freeze({...x})),
   products:doc.products.map(x=>Object.freeze({...x})),
   ingredients:doc.ingredients.map(x=>Object.freeze({...x})),
   promotions:doc.promotions.map(x=>Object.freeze({...x}))
  }),
  readOnly:true
 });
}
export async function leerCatalogoRealPanelRomoQA({db,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','catalog.read');
 if(!db||typeof db.query!=='function')throw Error('Conexión Romo obligatoria');
 const rows=await db.query(
  'SELECT revision,contenido FROM public.romo_catalogo_v1 WHERE store_id=$1',
  [STORE]);
 if(!Array.isArray(rows)||rows.length!==1)
  throw Error('El catálogo Romo todavía no está preparado');
 return validarCatalogoRealRomoQA(rows[0]);
}
export const ROMO_CATALOGO_REAL_LECTURA_QA_NO_ACTIVADO=true;
