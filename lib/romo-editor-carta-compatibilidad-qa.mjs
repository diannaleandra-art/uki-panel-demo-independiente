/**
 * Adaptador QA NO CONECTADO: misma Carta y precios del panel Uki, solo ámbito romo:serena.
 * Mantiene el detalle necesario para armado, fotos REFERENCIADAS, recargos, pagos,
 * promociones, productos, retirados y agotados; no abre red ni toca caja/pedidos.
 * No importar en el panel Uki ni publicar sin autorización y pruebas completas.
 * Los identificadores de fotos son referencias: la carga de imágenes aún falta.
 * El backend futuro validará la identidad Google/rol y revisiones atómicamente.
 */
import {
 normalizarCategoriasRomoQA,comprobarAsignacionesRomoQA,
 precioPublicoRomoQA,categoriaPublicaRomoQA
} from './romo-categorias-descuentos-qa.mjs';
const SCOPE='romo:serena';
const LIMITS={"products":300,"ingredients":200,"promotions":100};
const SECTIONS=["products","ingredients","promotions"];
const paySet=new Set(["efectivo","transferencia","debito","credito","edenred","junaeb"]);
const surfacesSet=new Set(["classic","premium","monthly","handroll","burger","gohan"]);
const allowedSurfaces={vegetal:[...surfacesSet],proteina:['classic','premium','monthly','handroll','burger'],envoltura:['classic','premium','monthly','handroll']};
const banned=/(?:uki|pizza)/i;
export function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype}

export function requiredText(v,max=150,nullable=false){if(nullable&&(v==null||v===''))return '';if(typeof v!=='string'||!v.trim()||v.trim().length>max||banned.test(v))throw Error('Texto Romo inválido');return v.trim()}

export function int(v,max=1000000){if(!Number.isSafeInteger(v)||v<0||v>max)throw Error('Valor no permitido');return v}

export function sku(v){const s=requiredText(v,120);if(!/^[a-z0-9][a-z0-9:_-]{0,119}$/.test(s)||s.startsWith('uki:'))throw Error('Código inválido');return s}

export function extraFields(item,allowed){if(!plain(item)||Object.keys(item).some(k=>!allowed.includes(k)))throw Error('Campos no reconocidos: revisa antes de guardar')}

export function normalizeRecord(section,input){
 const base=['sku','name','description','price','available','visible','version','photoRef','discountPercent','categoriaSlug'];
 const productFields=[...base,'kind','group'];
 const ingredientFields=['sku','name','category','surcharge','surfaces','available','visible','version'];
 const promoFields=[...base,'promoType','rollCount','piecesPerRoll','sauceCount','korokes','payments','customizable'];
 extraFields(input,section==='products'?productFields:section==='ingredients'?ingredientFields:promoFields);
 const out={sku:sku(input.sku),name:requiredText(input.name,100),version:int(input.version,1000000)};
 if(out.version<1)throw Error('Versión de registro inválida');
 if(typeof input.available!=='boolean'||typeof input.visible!=='boolean')throw Error('Estados obligatorios');
 out.available=input.available;out.visible=input.visible;
 if(section==='ingredients'){
  if(!['vegetal','proteina','envoltura'].includes(input.category))throw Error('Categoría inválida');
  out.category=input.category;out.surcharge=int(input.surcharge,50000);
  if(!Array.isArray(input.surfaces)||!input.surfaces.length||input.surfaces.length>6||
    new Set(input.surfaces).size!==input.surfaces.length||input.surfaces.some(v=>!allowedSurfaces[input.category].includes(v)))
    throw Error('Preparaciones inválidas');
  out.surfaces=[...input.surfaces];
 }else{
  out.description=requiredText(input.description,500,true);
  out.price=int(input.price);
  if(input.discountPercent!==undefined){
   out.discountPercent=int(input.discountPercent,99);
   if(out.discountPercent>0&&out.price<1)throw Error('No puede descontarse un precio cero');
  }
  if(input.categoriaSlug!==undefined){
   if(typeof input.categoriaSlug!=='string'||!/^[a-z0-9][a-z0-9-]{1,44}$/.test(input.categoriaSlug))
    throw Error('Asignación de categoría inválida');
   out.categoriaSlug=input.categoriaSlug;
  }
  if(input.photoRef!==undefined){
    if(typeof input.photoRef!=='string'||!/^romo-[a-z0-9_-]{4,80}$/.test(input.photoRef))throw Error('Referencia de fotografía inválida');
    out.photoRef=input.photoRef;
  }
  if(section==='products'){
   out.kind=requiredText(input.kind,35);out.group=requiredText(input.group,80);
  }else{
   if(!['sushi','gohan','combo'].includes(input.promoType))throw Error('Tipo de promoción inválido');
   out.promoType=input.promoType;
   out.rollCount=int(input.rollCount,20);out.piecesPerRoll=int(input.piecesPerRoll,12);
   out.sauceCount=int(input.sauceCount,20);out.korokes=int(input.korokes,30);
   if(input.promoType==='sushi'){
    if(out.rollCount<1||![10,12].includes(out.piecesPerRoll)||input.customizable!==true)throw Error('Armado de promoción de sushi inválido');
   }else if(out.rollCount!==0||out.korokes!==0||out.sauceCount>1||input.customizable!==false){
    throw Error('La promoción fija no tiene rolls armables');
   }
   if(!Array.isArray(input.payments)||!input.payments.length||input.payments.length>6||
     new Set(input.payments).size!==input.payments.length||input.payments.some(p=>!paySet.has(p)))
     throw Error('Medios de pago inválidos');
   out.payments=[...input.payments];out.customizable=input.customizable;
  }
 }
 return out;
}

export function normalizarCatalogoCompletoRomoQA(snapshot){
 if(!plain(snapshot)||snapshot.storeId!==SCOPE||snapshot.brand!=='romo'||!SECTIONS.every(s=>Array.isArray(snapshot[s]))||Object.keys(snapshot).some(k=>!['storeId','brand','revision','categories',...SECTIONS].includes(k)))
  throw Error('Catálogo ajeno o incompleto');
 const revision=int(snapshot.revision,1000000000);
 const ids=new Set(),out={storeId:SCOPE,brand:'romo',revision};
 for(const section of SECTIONS){
  if(snapshot[section].length>LIMITS[section])throw Error('Sección demasiado grande');
  out[section]=snapshot[section].map(input=>{
   const item=normalizeRecord(section,input);
   if(ids.has(item.sku))throw Error('Código repetido');
   ids.add(item.sku);
   return item;
  });
 }
 if(snapshot.categories!==undefined)out.categories=normalizarCategoriasRomoQA(snapshot.categories);
 comprobarAsignacionesRomoQA(out);
 if(JSON.stringify(out).length>175000)throw Error('El catálogo excede el límite de prueba');
 return out;
}

export function cambiarCartaRomoEnMemoriaQA(snapshot,mutation){
 const before=normalizarCatalogoCompletoRomoQA(snapshot);
 if(!plain(mutation)||mutation.storeId!==SCOPE||
   !SECTIONS.includes(mutation.section)||
   !['crear','editar','retirar','restaurar','agotado','disponible'].includes(mutation.action)||
   !Number.isSafeInteger(mutation.expectedRevision)||mutation.expectedRevision!==before.revision)
   throw Error('Acción de Romo inválida o revisión desactualizada');
 const list=before[mutation.section],pos=list.findIndex(x=>x.sku===mutation.sku);
 const next={...before,[mutation.section]:[...list],revision:before.revision+1};
 const section=mutation.section;
 if(mutation.action==='crear'){
  if(pos!==-1||SECTIONS.some(s=>before[s].some(x=>x.sku===mutation.sku)))throw Error('Producto duplicado');
  if(!plain(mutation.item)||mutation.item.sku!==mutation.sku)throw Error('Falta el producto completo');
  next[section].push(normalizeRecord(section,{...mutation.item,version:1}));
 }else{
  if(pos<0)throw Error('Producto inexistente');
  const old=list[pos];
  if(!Number.isSafeInteger(mutation.expectedVersion)||mutation.expectedVersion!==old.version)
   throw Error('Registro editado en otro dispositivo');
  let update={...old};
  if(mutation.action==='editar'){
   if(!plain(mutation.patch)||Object.keys(mutation.patch).length===0||
     Object.keys(mutation.patch).some(k=>['sku','version','kind'].includes(k)))
     throw Error('Edición incompatible');
   update={...update,...mutation.patch};
  }else if(mutation.action==='retirar')update.visible=false;
  else if(mutation.action==='restaurar')update.visible=true;
  else if(mutation.action==='agotado')update.available=false;
  else if(mutation.action==='disponible')update.available=true;
  update.version=old.version+1;
  next[section][pos]=normalizeRecord(section,update);
 }
 return normalizarCatalogoCompletoRomoQA(next);
}

export function vistaCartaRomoQA(snapshot){
 const s=normalizarCatalogoCompletoRomoQA(snapshot);
 const result={storeId:SCOPE,revision:s.revision};
 const categories=s.categories||[];
 if(s.categories)result.categorias=categories.filter(c=>c.visible).map(c=>({slug:c.slug,nombre:c.nombre}));
 result.products=s.products.filter(x=>x.visible).map(x=>({
  sku:x.sku,name:x.name,description:x.description,
  ...precioPublicoRomoQA(x.price,x.discountPercent??0),
  kind:x.kind,group:x.group,available:x.available,
  ...categoriaPublicaRomoQA(x,categories),...(x.photoRef?{photoRef:x.photoRef}:{})
 }));
 result.ingredients=s.ingredients.filter(x=>x.visible).map(x=>({
  sku:x.sku,name:x.name,category:x.category,surcharge:x.surcharge,
  surfaces:[...x.surfaces],available:x.available
 }));
 result.promotions=s.promotions.filter(x=>x.visible).map(x=>({
  sku:x.sku,name:x.name,description:x.description,
  ...precioPublicoRomoQA(x.price,x.discountPercent??0),
  ...categoriaPublicaRomoQA(x,categories),
  promoType:x.promoType,rollCount:x.rollCount,piecesPerRoll:x.piecesPerRoll,
  sauceCount:x.sauceCount,korokes:x.korokes,payments:[...x.payments],
  customizable:x.customizable,available:x.available,
  ...(x.photoRef?{photoRef:x.photoRef}:{})
 }));
 return result;
}

/** Alta/renombrado/retiro de categorías EN EL MISMO documento de Romo.
 * Nunca borra productos ni cambia el grupo original del armado.
 * Controla revisión global y versión de la categoría para dos dispositivos.
 */
export function cambiarCategoriasRomoEnMemoriaQA(snapshot,mutation){
 const before=normalizarCatalogoCompletoRomoQA(snapshot);
 if(!plain(mutation)||mutation.storeId!==SCOPE||
    !['crear','renombrar','retirar','restaurar'].includes(mutation.action)||
    !Number.isSafeInteger(mutation.expectedRevision)||
    mutation.expectedRevision!==before.revision)
  throw Error('Cambio de categoría o revisión inválida');
 const list=[...(before.categories||[])];
 const pos=list.findIndex(c=>c.slug===mutation.slug);
 if(mutation.action==='crear'){
  if(pos!==-1)throw Error('Categoría Romo ya existe');
  list.push({slug:mutation.slug,nombre:mutation.nombre,version:1,visible:true});
 }else{
  if(pos===-1)throw Error('Categoría Romo no encontrada');
  const old=list[pos];
  if(mutation.expectedVersion!==old.version)throw Error('Categoría modificada en otro teléfono');
  const after={...old,version:old.version+1};
  if(mutation.action==='renombrar')after.nombre=mutation.nombre;
  if(mutation.action==='retirar')after.visible=false;
  if(mutation.action==='restaurar')after.visible=true;
  list[pos]=after;
 }
 return normalizarCatalogoCompletoRomoQA({...before,
   revision:before.revision+1,categories:list});
}
