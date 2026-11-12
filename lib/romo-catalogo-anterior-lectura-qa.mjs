/**
 * Romo's Sushi — inspección del catálogo anterior (Supabase).
 * Solo proyección de lectura, sin escrituras ni migración automática.
 * Conserva precio de origen SIN sumar 500 automáticamente.
 */
export const LEGACY_SUPABASE_HOST='awldmutolllpyucvhicc.supabase.co';
export const LEGACY_CATALOG_FIELDS='id,name,kind,pieces,price,available,valid_from,valid_until,sort_order';
const text=(s,n)=>typeof s==='string'&&s.trim().length>=1&&s.trim().length<=n;
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000;
const validDate=s=>s===null||s===undefined||typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
function productView(row){
 if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Registro de carta anterior inválido');
 if(!text(row.id,120)||!text(row.name,100)||!['promo','extra'].includes(row.kind)||
  !money(row.price)||row.price<1||
  !(row.available===true||row.available===false)||
  !validDate(row.valid_from)||!validDate(row.valid_until)||
  (row.sort_order!==undefined&&row.sort_order!==null&&(!Number.isSafeInteger(row.sort_order)||row.sort_order<0||row.sort_order>10000))||
  /pizzas?/i.test(row.name))throw Error('Registro de carta anterior no verificable');
 const pieces=Number(row.pieces||0);
 if(!Number.isSafeInteger(pieces)||pieces<0||pieces>300||row.kind==='promo'&&(pieces<12||pieces%12!==0))
  throw Error('Piezas de la promoción no verificables');
 // No inferir korokes, salsas, ingredientes o bonificaciones desde solo 9 columnas.
 return Object.freeze({
  id:row.id,name:row.name,kind:row.kind,pieces,precioOriginal:row.price,
  disponibleOrigen:row.available,orden:row.sort_order??null,
  vigenciaDesde:row.valid_from??null,vigenciaHasta:row.valid_until??null,
  ajuste500Aplicado:false,precioPropuesto:null,
  requiereRevisionComposicion:row.kind==='promo',
  fotoAsignada:false,importado:false
 });
}
/** Se usa para mostrar la revisión al dueño, NO para aplicar una migración. */
export function legacyRomoCatalogReview(rows){
 if(!Array.isArray(rows)||rows.length>100)throw Error('Catálogo origen inesperado');
 const seen=new Set();
 const products=rows.map(row=>{
  const v=productView(row);
  if(seen.has(v.id))throw Error('Código duplicado en catálogo anterior');
  seen.add(v.id);
  return v;
 });
 products.sort((a,b)=>(a.orden??99999)-(b.orden??99999));
 return Object.freeze({
  storeId:'romo:serena',source:'supabase:romos_products',soloLectura:true,
  requiereRevisionPrecios:true,ajuste500Aplicado:false,
  productos:products,cuenta:products.length,publicacionHabilitada:false
 });
}
export function legacySupabaseUrl(){
 const url=new URL('/rest/v1/romos_products','https://'+LEGACY_SUPABASE_HOST);
 url.searchParams.set('select',LEGACY_CATALOG_FIELDS);
 url.searchParams.set('order','sort_order.asc');
 url.searchParams.set('limit','100');
 return url.toString();
}
