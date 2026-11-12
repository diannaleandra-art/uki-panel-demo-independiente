/**
 * Categorías y descuentos de Romo en QA, sin llamadas HTTP ni efectos
 * comerciales. Un único documento en romo_catalogo_v1 (Neon separado de Uki).
 * El precio base se guarda intacto y SOLO la vista pública calcula la oferta,
 * igual que en Uki. Los importes deben recalcularse en el servidor al cobrar.
 */
const CATEGORY=/^[a-z0-9][a-z0-9-]{1,44}$/;
const NO_HTML=/[<>\u0000-\u001f]/;
const NOT_ROMO=/(^|[^a-záéíóúñ])(uki|pizza|pizzas)(?=$|[^a-záéíóúñ])/i;
export const ROMO_CATEGORIAS_DESCUENTOS_SOLO_QA=true;

export function normalizarCategoriasRomoQA(categories){
 if(!Array.isArray(categories)||categories.length>50)
  throw Error('Lista de categorías Romo inválida');
 const slugs=new Set(),names=new Set();
 return categories.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
     Object.keys(raw).some(k=>!['slug','nombre','visible','version'].includes(k)))
   throw Error('Categoría Romo no permitida');
  const slug=String(raw.slug||'').trim();
  const nombre=typeof raw.nombre==='string'?raw.nombre.trim().replace(/\s+/g,' '):'';
  if(!CATEGORY.test(slug)||nombre.length<2||nombre.length>45||NO_HTML.test(nombre)||NOT_ROMO.test(nombre))
   throw Error('Categoría Romo inválida');
  const nameKey=nombre.toLocaleLowerCase('es-CL');
  if(slugs.has(slug)||names.has(nameKey))throw Error('Categoría repetida');
  slugs.add(slug);names.add(nameKey);
  if(raw.visible!==undefined&&typeof raw.visible!=='boolean')
   throw Error('Visibilidad de categoría inválida');
  const version=raw.version??1;
  if(!Number.isSafeInteger(version)||version<1||version>1000000)
   throw Error('Versión de categoría inválida');
  return {slug,nombre,visible:raw.visible??true,version};
 });
}
export function comprobarAsignacionesRomoQA(snapshot){
 const categories=snapshot.categories||[];
 const slugs=new Set(categories.map(c=>c.slug));
 for(const section of ['products','promotions'])
  for(const item of snapshot[section]){
   if(item.categoriaSlug!==undefined){
    if(!CATEGORY.test(item.categoriaSlug)||!slugs.has(item.categoriaSlug))
     throw Error('Categoría del producto no existe en Romo');
   }
  }
 return snapshot;
}
export function precioPublicoRomoQA(price,percent=0){
 if(!Number.isSafeInteger(price)||price<0||price>1000000||
    !Number.isSafeInteger(percent)||percent<0||percent>99||
    (percent>0&&price<1))
  throw Error('Descuento o precio Romo inválido');
 const final=percent?Math.max(1,Math.round(price*(100-percent)/100)):price;
 return Object.freeze({
  price:final,precioOriginal:price,descuentoPorcentaje:percent
 });
}
export function categoriaPublicaRomoQA(item,categories=[]){
 if(!item.categoriaSlug)return {};
 const category=categories.find(c=>c.slug===item.categoriaSlug);
 // Una categoría retirada no borra el producto, solo oculta su tarjeta.
 if(!category||category.visible===false)return {};
 return {categoriaSlug:category.slug,categoriaNombre:category.nombre};
}
