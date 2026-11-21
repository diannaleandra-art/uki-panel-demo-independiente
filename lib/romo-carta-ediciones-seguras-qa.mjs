/**
 * Romo La Serena: editor de SOBREESCRITURAS mínimas sobre la carta aprobada.
 *
 * NO reemplaza romo_catalogo_v1, los 40 productos ni sus recetas.
 * No modifica ningún producto si un guardado no queda confirmado con CAS
 * y registro de auditoría en UNA sentencia SQL.
 * Esta librería no habilita rutas ni banderas de producción.
 */
import {createHash,randomUUID} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import admin from './romo-carta-administracion-qa.cjs';
import ingredientPublication from './romo-ingredientes-publicacion.cjs';

const STORE='romo:serena';
// Compatibilidad de las 40 referencias confirmadas. Este SKU es solo Uki.
const SKU_PROMO_SOLO_UKI='dish:sushi-burger-promo';
const ALLOWED=new Set(['price','available','name','description','categoriaSlug','originalPrice']);
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const HAS=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const POSINT=x=>Number.isSafeInteger(x)&&x>=0;
const SHA=/^[0-9a-f]{64}$/;
const customId=/^dish:romoq-[a-f0-9-]{36}$/;
const categoryId=/^romoq-[a-f0-9-]{36}$/;
const emptyGestion=()=>({categories:[],products:[],promotions:[]});
function textSafe(x,min,max){return typeof x==='string'&&x.trim().length>=min&&x.length<=max&&!/[\r\n\u0000-\u001f*]/.test(x);}
function validGestion(raw,base){
 const g=raw??emptyGestion();
 if(!OBJ(g)||!Array.isArray(g.categories)||!Array.isArray(g.products)||g.categories.length>30||g.products.length>70)throw Error('Gestión de catálogo inválida');
 const categories=new Set(['entradas']);
 const namesCat=new Set(base.carta.categories.map(c=>c.nombre.toLowerCase()));
 for(const c of g.categories){
  if(!OBJ(c)||!categoryId.test(c.slug)||!textSafe(c.nombre,2,45)||categories.has(c.slug)||namesCat.has(c.nombre.toLowerCase()))throw Error('Categoría nueva inválida o duplicada');
  categories.add(c.slug);namesCat.add(c.nombre.toLowerCase());
 }
 const ids=new Set(),names=new Set([...base.products.values()].map(p=>p.name.trim().toLowerCase()));
 for(const p of g.products){
  if(!OBJ(p)||!customId.test(p.sku)||ids.has(p.sku)||!textSafe(p.name,2,100)||names.has(p.name.trim().toLowerCase())||
     typeof p.description!=='string'||p.description.length>500||!POSINT(p.price)||p.price<1||p.price>1000000||
     !categories.has(p.categoriaSlug)||typeof p.available!=='boolean'||
     (p.originalPrice!=null&&(!POSINT(p.originalPrice)||p.originalPrice<=p.price||p.originalPrice>1000000)))throw Error('Producto nuevo inválido o duplicado');
  ids.add(p.sku);names.add(p.name.trim().toLowerCase());
 }
 const promotions=g.promotions??[];
 if(!Array.isArray(promotions)||promotions.length>30||g.products.length+promotions.length>70)throw Error('Límite comercial de promociones');
 for(const p of promotions){
  if(!OBJ(p)||!/^monthly:romoq-[a-f0-9-]{36}$/.test(p.sku)||ids.has(p.sku)||!textSafe(p.name,2,100)||names.has(p.name.trim().toLowerCase())||typeof p.description!=='string'||p.description.length>500||/[\r\n\u0000-\u001f*]/.test(p.description)||!POSINT(p.price)||p.price<1||p.price>1000000||p.categoriaSlug!=='mensual'||typeof p.available!=='boolean'||!Number.isSafeInteger(p.photoVersion)||p.photoVersion<1||p.photoVersion>100000||(p.originalPrice!=null&&(!POSINT(p.originalPrice)||p.originalPrice<=p.price||p.originalPrice>1000000)))throw Error('Promoción comercial inválida');
  const c=p.config;
  if(!OBJ(c)||c.payments?.includes('credito'))throw Error('Medio de pago aún no conectado a carta');
  admin.validPromo({name:p.name,description:p.description,price:p.originalPrice||p.price,available:p.available,...c});
  ids.add(p.sku);names.add(p.name.trim().toLowerCase());
 }
 ingredientPublication.validate(g.ingredientConfig);
 return g;
}
function productoNuevo(p){return {...p,kind:'dish',sourceId:p.sku.slice(5),custom:true};}


export class RomoCartaConflictoQA extends Error{
  constructor(message='La carta cambió. Actualiza y revisa antes de volver a guardar.'){
    super(message);this.name='RomoCartaConflictoQA';this.status=409;
  }
}

function baseCatalogo(carta){
  if(!OBJ(carta)||carta.ok!==true||carta.storeId!==STORE||
     carta.brand!=='romo'||carta.branch!=='serena'||carta.readOnly!==true||
     carta.source!=='carta-aprobada-en-codigo'||
     !Array.isArray(carta.products)||carta.products.length<40||
     carta.products.length>300||
     !Array.isArray(carta.ingredients)||carta.ingredients.length<20||
     !Array.isArray(carta.categories)||carta.categories.length<5)
    throw Error('Referencia de carta Romo incompleta o no aprobada');
  const products=new Map(),categories=new Set();
  for(const c of carta.categories){
    if(!OBJ(c)||typeof c.slug!=='string'||!/^[a-z0-9-]{2,70}$/.test(c.slug)||
       typeof c.nombre!=='string'||!c.nombre.trim()||categories.has(c.slug))
      throw Error('Categorías Romo inválidas');
    categories.add(c.slug);
  }
  for(const p of carta.products){
    if(!OBJ(p)||typeof p.sku!=='string'||p.sku.length>100||products.has(p.sku)||
       !POSINT(p.price)||!categories.has(p.categoriaSlug))
      throw Error('Productos Romo ausentes, duplicados o incorrectos');
    products.set(p.sku,p);
  }
  // Determinista por estructura: si el menú aprobado cambia, no aplicar
  // silenciosamente parches creados sobre otra versión de la carta.
  const string=JSON.stringify({storeId:STORE,categories:carta.categories,
    products:carta.products,ingredients:carta.ingredients});
  const hash=createHash('sha256').update(string,'utf8').digest('hex');
  return {hash,products,categories,carta};
}

function leerFila(row,base){
  if(!row)return {revision:0,overrides:{}};
  const revision=Number(row.revision);
  if(row.store_id!==STORE||!POSINT(revision)||revision<1||
     typeof row.base_sha256!=='string'||!SHA.test(row.base_sha256))
    throw Error('Fila de ediciones Romo inválida');
  if(row.base_sha256!==base.hash)
    throw new RomoCartaConflictoQA('Cambió la carta aprobada; concilia manualmente sus ediciones antes de guardar.');
  const data=typeof row.contenido==='string'?JSON.parse(row.contenido):row.contenido;
  if(!OBJ(data)||data.storeId!==STORE||Number(data.revision)!==revision||
     !OBJ(data.overrides)||Object.keys(data.overrides).length>300)
    throw Error('Ediciones Romo incompletas; no guardar');
  for(const [sku,fields] of Object.entries(data.overrides)){
    if(!base.products.has(sku)||!OBJ(fields)||Object.keys(fields).length===0)
      throw Error('Edición sobre producto desconocido');
    validarPatch(fields,base.categories);
    if(HAS(fields,'originalPrice')&&(fields.originalPrice===null||fields.originalPrice<=(fields.price??base.products.get(sku).price)))
      throw Error('Descuento guardado inválido');
  }
  return {revision,overrides:data.overrides,gestion:validGestion(data.gestion,base)};
}

function validarPatch(patch,categories){
  if(!OBJ(patch)||Object.keys(patch).length<1||
     Object.keys(patch).some(k=>!ALLOWED.has(k)))
    throw Error('Solo se permiten campos de edición aprobados');
  if(HAS(patch,'price')&&(!Number.isSafeInteger(patch.price)||
      patch.price<1||patch.price>1000000))
    throw Error('Precio inválido');
  if(HAS(patch,'originalPrice')&&patch.originalPrice!==null&&
     (!Number.isSafeInteger(patch.originalPrice)||patch.originalPrice<1||patch.originalPrice>1000000))
    throw Error('Precio anterior inválido');
  if(HAS(patch,'available')&&typeof patch.available!=='boolean')
    throw Error('Disponibilidad inválida');
  if(HAS(patch,'name')&&
     (typeof patch.name!=='string'||patch.name.trim().length<2||
      patch.name.trim().length>100))
    throw Error('Nombre inválido');
  if(HAS(patch,'description')&&
     (typeof patch.description!=='string'||patch.description.length>500))
    throw Error('Descripción inválida');
  if(HAS(patch,'categoriaSlug')&&
     (typeof patch.categoriaSlug!=='string'||!categories.has(patch.categoriaSlug)))
    throw Error('La categoría debe existir en la carta aprobada');
}

export function vistaEdicionesRomoQA(carta,row){
  const base=baseCatalogo(carta),actual=leerFila(row,base);
  const productos=carta.products.map(p=>Object.freeze({...p,
    ...(actual.overrides[p.sku]||{}),
    ...(p.sku===SKU_PROMO_SOLO_UKI?{available:false}:{})}));
  if(productos.length!==base.products.size)
    throw Error('La carta aprobada no está completa');
  return Object.freeze({
    ok:true,storeId:STORE,readOnly:true,editable:false,
    revision:actual.revision,baseSha256:base.hash,
    // Mismo catálogo ya aprobado, solo lectura: no cambia hash ni esquema de Neon.
    categories:[...carta.categories,...(actual.gestion?.categories||[])],
    products:[...productos,...(actual.gestion?.products||[]).map(productoNuevo)],ingredients:carta.ingredients,
    ingredientConfig:actual.gestion?.ingredientConfig||null,
    publishedPromotions:(actual.gestion?.promotions||[]).map(p=>({...p,kind:'monthly',id:p.sku.slice(8),custom:true})),
    estado:'preview_catalogo_con_ediciones',
    aviso:'No habilitar la venta ni el editor antes de verificar cambios en la carta pública.'
  });
}

export function prepararCambioRomoQA({
  carta,row,expectedRevision,baseSha256,sku,patch,motivo,identity
}={}){
  authorizeRomoOperation(identity,'romo','serena','catalog.write');
  const base=baseCatalogo(carta),actual=leerFila(row,base);
  // La primera revisión sólo puede nacer de la confirmación manual
  // explícita de la dueña, sin cambios de precio ni disponibilidad.
  if(actual.revision<1)throw new RomoCartaConflictoQA(
    'Primero confirma desde dueños la versión inicial de los 40 productos de Romo.');
  if(!POSINT(expectedRevision)||expectedRevision!==actual.revision||
     typeof baseSha256!=='string'||baseSha256!==base.hash)
    throw new RomoCartaConflictoQA();
  if(typeof sku==='string'&&customId.test(sku)){
    return prepararGestionRomoQA({carta,row,expectedRevision,baseSha256,action:'product-patch',fields:{sku,patch},motivo,identity});
  }
  if(typeof sku!=='string'||!base.products.has(sku))
    throw Error('Producto ajeno a la carta aprobada de Romo');
  if(sku===SKU_PROMO_SOLO_UKI)
    throw Error('La promoción Sushi Burguer de Uki no puede editarse ni publicarse en Romo');
  if(typeof motivo!=='string'||motivo.trim().length<4||
     motivo.trim().length>300)
    throw Error('Indica el motivo de la modificación');
  validarPatch(patch,base.categories);
  // No guardar cambios que el sitio público todavía no es capaz de mostrar.
  // Precios y disponibilidad siguen editables para todos los productos.
  const source=base.products.get(sku);
  if(HAS(patch,'categoriaSlug')&&patch.categoriaSlug!==source.categoriaSlug)
    throw Error('La reasignación de categorías espera la navegación equivalente a Uki');
  if(HAS(patch,'name')&&patch.name!==source.name&&
     ['classic','premium','extra'].includes(source.kind))
    throw Error('La edición de este nombre requiere actualizar el armado de la carta');
  if(HAS(patch,'description')&&patch.description!==String(source.description||'')&&
     ['classic','premium','topping','extra'].includes(source.kind))
    throw Error('Esta descripción todavía no se puede mostrar correctamente');
  const current=actual.overrides[sku]||{};
  const next={...current,...patch};
  if(next.originalPrice===null)delete next.originalPrice;
  if(HAS(next,'originalPrice')&&(!['classic','premium','monthly','dish','topping'].includes(source.kind)||
     next.originalPrice<=(next.price??source.price)))
    throw Error('El precio anterior debe ser mayor al precio final y corresponder a un producto admitido.');
  // Una edición modifica solo campos autorizados, nunca piezas, recetas,
  // métodos de pago, descuentos históricos o ingredientes de otros productos.
  const before=Object.keys(current).length?{...current}:null;
  for(const k of Object.keys(next))
    if(Object.is(next[k],base.products.get(sku)[k]))delete next[k];
  const changed=JSON.stringify(current)!==JSON.stringify(next);
  if(!changed)throw Error('No hay cambios para guardar');
  const overrides={...actual.overrides};
  if(Object.keys(next).length)overrides[sku]=next;
  else delete overrides[sku];
  const revision=expectedRevision+1;
  const contenido={storeId:STORE,revision,overrides,...(actual.gestion?{gestion:actual.gestion}:{})};
  if(Buffer.byteLength(JSON.stringify(contenido),'utf8')>180000)
    throw Error('El registro de ediciones es demasiado grande');
  return Object.freeze({
    storeId:STORE,expectedRevision,revision,baseSha256:base.hash,
    sku,anterior:before,nuevo:Object.keys(next).length?next:null,
    actorId:identity.userId,motivo:motivo.trim(),contenido
  });
}

export function prepararGestionRomoQA({carta,row,expectedRevision,baseSha256,action,fields,motivo,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','catalog.write');
 const base=baseCatalogo(carta),actual=leerFila(row,base);
 if(actual.revision<1||expectedRevision!==actual.revision||baseSha256!==base.hash)throw new RomoCartaConflictoQA();
 if(!OBJ(fields)||typeof motivo!=='string'||motivo.trim().length<4||motivo.length>300)throw Error('Datos de gestión inválidos');
 const g=structuredClone(actual.gestion||emptyGestion());
 let sku,anterior=null,nuevo=null;
 if(action==='category-create'){
  sku='romoq-'+randomUUID();nuevo={slug:sku,nombre:String(fields.nombre||'').trim()};g.categories.push(nuevo);
 }else if(action==='category-rename'||action==='category-delete'){
  sku=fields.slug;const i=g.categories.findIndex(c=>c.slug===sku);
  if(i<0)throw Error('Las categorías originales de armado se conservan.');
  anterior={...g.categories[i]};
  if(action==='category-delete'){g.categories.splice(i,1);for(const p of g.products)if(p.categoriaSlug===sku)p.categoriaSlug='entradas';}
  else{nuevo={...anterior,nombre:String(fields.nombre||'').trim()};g.categories[i]=nuevo;}
 }else if(action==='product-create'){
  sku='dish:romoq-'+randomUUID();
  nuevo={sku,name:String(fields.name||'').trim(),price:fields.price,description:String(fields.description||'').trim(),categoriaSlug:fields.categoriaSlug,available:fields.available};
  g.products.push(nuevo);
 }else if(action==='product-patch'||action==='product-delete'){
  sku=fields.sku;const i=g.products.findIndex(p=>p.sku===sku);
  if(i<0)throw Error('Producto nuevo no encontrado');
  anterior={...g.products[i]};
  if(action==='product-delete')g.products.splice(i,1);
  else{
   if(!OBJ(fields.patch)||Object.keys(fields.patch).some(k=>!ALLOWED.has(k)))throw Error('Edición no autorizada');
   nuevo={...anterior,...fields.patch};if(nuevo.originalPrice===null)delete nuevo.originalPrice;
   g.products[i]=nuevo;
  }
 }else throw Error('Acción no permitida');
 validGestion(g,base);
 if(JSON.stringify(anterior)===JSON.stringify(nuevo))throw Error('No hay cambios');
 const revision=actual.revision+1;
 const contenido={storeId:STORE,revision,overrides:actual.overrides,gestion:g};
 if(Buffer.byteLength(JSON.stringify(contenido),'utf8')>180000)throw Error('Catálogo demasiado grande');
 return {storeId:STORE,expectedRevision,revision,baseSha256:base.hash,sku,anterior,nuevo,actorId:identity.userId,motivo:motivo.trim(),contenido};
}
// A publication uses the existing commercial CAS and order lock. No automatic
// promotion publication, and no administrative draft is read by customers.
export async function publicarPromoRomoQA({db,carta,identity,adminRevision,commercialRevision,sku,retirar,motivo}){
 authorizeRomoOperation(identity,'romo','serena','catalog.write');
 if(!/^promo:[a-f0-9-]{36}$/.test(sku)||!POSINT(adminRevision)||!POSINT(commercialRevision)||commercialRevision<1||typeof retirar!=='boolean')throw Error('Solicitud de promoción inválida');
 const base=baseCatalogo(carta);
 const [commercial,drafts]=await Promise.all([
 db.query('SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',[STORE]),
 db.query('SELECT store_id,revision,contenido FROM public.romo_carta_admin_qa_v1 WHERE store_id=$1',[STORE])]);
 if(commercial.length!==1||drafts.length!==1)throw new RomoCartaConflictoQA();
 const actual=leerFila(commercial[0],base),state=admin.read(drafts[0]);
 if(actual.revision!==commercialRevision||state.revision!==adminRevision)throw new RomoCartaConflictoQA();
 const g=structuredClone(actual.gestion||emptyGestion());g.promotions=g.promotions||[];
 const commercialSku='monthly:romoq-'+sku.slice(6),i=g.promotions.findIndex(p=>p.sku===commercialSku),before=i<0?null:g.promotions[i];
 let next=null,photoVersion=0;
 if(retirar){
  if(i<0)throw new RomoCartaConflictoQA('La promoción no está publicada');
  g.promotions.splice(i,1);
 }else{
  const d=state.data.promotions.find(p=>p.sku===sku);
  if(!d||d.available!==true)throw Error('Activa la promoción en el borrador antes de publicar');
  const keys=['promoType','rollCount','piecesPerRoll','sauceCount','korokes','payments'];
  const config=Object.fromEntries(keys.map(k=>[k,d[k]]));
  admin.validPromo({name:d.name,description:d.description,price:d.price,available:d.available,...config});
  if(config.payments.includes('credito'))throw Error('La tarjeta de crédito todavía no está habilitada en la carta');
  const photos=await db.query('SELECT version FROM public.romo_carta_admin_fotos_qa_v1 WHERE store_id=$1 AND sku=$2',[STORE,sku]);
  photoVersion=Number(photos[0]?.version||0);if(!POSINT(photoVersion)||photoVersion<1)throw Error('Agrega una fotografía antes de publicar');
  const pct=Number(state.data.discounts[sku]||0);
  if(!POSINT(pct)||pct>99)throw Error('Descuento inválido');
  const price=Math.max(1,Math.round(d.price*(100-pct)/100));
  next={sku:commercialSku,name:d.name,description:d.description,price,available:true,categoriaSlug:'mensual',config,photoVersion,...(price<d.price?{originalPrice:d.price}:{})};
  if(i<0)g.promotions.push(next);else g.promotions[i]=next;
 }
 validGestion(g,base);
 if(JSON.stringify(before)===JSON.stringify(next))throw Error('No hay cambios para publicar');
 const revision=actual.revision+1,doc={storeId:STORE,revision,overrides:actual.overrides,gestion:g};
 if(Buffer.byteLength(JSON.stringify(doc),'utf8')>180000)throw Error('Catálogo comercial demasiado grande');
 // Snapshot of draft and exact photo version must still exist at commit.
 const sql=`WITH locked_admin AS (
  SELECT store_id FROM public.romo_carta_admin_qa_v1 WHERE store_id=$1 AND revision=$10 FOR SHARE
 ), locked_photo AS (
  SELECT sku FROM public.romo_carta_admin_fotos_qa_v1 WHERE store_id=$1 AND sku=$11 AND version=$12 FOR SHARE
 ), saved AS (
  UPDATE public.romo_carta_ediciones_v1 SET revision=revision+1,contenido=$4::jsonb,actualizado_por=$5,actualizado_en=now()
  WHERE store_id=$1 AND revision=$2 AND base_sha256=$3 AND EXISTS(SELECT 1 FROM locked_admin) AND ($12=0 OR EXISTS(SELECT 1 FROM locked_photo)) RETURNING store_id,revision
 ), audit AS (
  INSERT INTO public.romo_carta_ediciones_auditoria_v1(store_id,revision,revision_anterior,base_sha256,sku,anterior,nuevo,responsable_uid,motivo)
  SELECT store_id,revision,$2,$3,$6,$7::jsonb,$8::jsonb,$5,$9 FROM saved RETURNING revision
 ) SELECT saved.revision FROM saved JOIN audit USING(revision)`;
 const done=await db.query(sql,[STORE,actual.revision,base.hash,JSON.stringify(doc),identity.userId,commercialSku,JSON.stringify(before),JSON.stringify(next),motivo,adminRevision,sku,photoVersion]);
 if(done.length!==1||Number(done[0].revision)!==revision)throw new RomoCartaConflictoQA();
 return {ok:true,storeId:STORE,guardado:true,auditado:true,revisionComercial:revision,recordId:sku,publicada:!retirar};
}
export async function publicarIngredientesRomoQA({db,carta,identity,adminRevision,commercialRevision,motivo}){
 authorizeRomoOperation(identity,'romo','serena','catalog.write');
 const base=baseCatalogo(carta);
 const [commercial,drafts]=await Promise.all([
  db.query('SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',[STORE]),
  db.query('SELECT store_id,revision,contenido FROM public.romo_carta_admin_qa_v1 WHERE store_id=$1',[STORE])]);
 if(commercial.length!==1||drafts.length!==1)throw new RomoCartaConflictoQA();
 const actual=leerFila(commercial[0],base),state=admin.read(drafts[0]);
 if(actual.revision!==commercialRevision||state.revision!==adminRevision)throw new RomoCartaConflictoQA();
 const g=structuredClone(actual.gestion||emptyGestion()),before=g.ingredientConfig||null;
 const next=ingredientPublication.project(carta,state.data);
 if(JSON.stringify(before||{})===JSON.stringify(next||{}))throw Error('Los ingredientes ya están sincronizados');
 g.ingredientConfig=next;validGestion(g,base);
 const revision=actual.revision+1,doc={storeId:STORE,revision,overrides:actual.overrides,gestion:g};
 if(Buffer.byteLength(JSON.stringify(doc),'utf8')>180000)throw Error('Catálogo comercial demasiado grande');
 const sql=`WITH locked_admin AS (SELECT store_id FROM public.romo_carta_admin_qa_v1 WHERE store_id=$1 AND revision=$10 FOR SHARE),
 saved AS (UPDATE public.romo_carta_ediciones_v1 SET revision=revision+1,contenido=$4::jsonb,actualizado_por=$5,actualizado_en=now()
 WHERE store_id=$1 AND revision=$2 AND base_sha256=$3 AND EXISTS(SELECT 1 FROM locked_admin) RETURNING store_id,revision),
 audit AS (INSERT INTO public.romo_carta_ediciones_auditoria_v1(store_id,revision,revision_anterior,base_sha256,sku,anterior,nuevo,responsable_uid,motivo)
 SELECT store_id,revision,$2,$3,$6,$7::jsonb,$8::jsonb,$5,$9 FROM saved RETURNING revision)
 SELECT saved.revision FROM saved JOIN audit USING(revision)`;
 const done=await db.query(sql,[STORE,actual.revision,base.hash,JSON.stringify(doc),identity.userId,'catalog:ingredients',JSON.stringify(before),JSON.stringify(next),motivo,adminRevision]);
 if(done.length!==1||Number(done[0].revision)!==revision)throw new RomoCartaConflictoQA();
 return {ok:true,storeId:STORE,guardado:true,auditado:true,revisionComercial:revision,ingredientesPublicados:true};
}
export async function guardarGestionRomoQA({db,carta,identity,expectedRevision,baseSha256,action,fields,motivo}={}){
 authorizeRomoOperation(identity,'romo','serena','catalog.write');
 const rows=await db.query('SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',[STORE]);
 if(rows.length!==1)throw new RomoCartaConflictoQA();
 const c=prepararGestionRomoQA({carta,row:rows[0],expectedRevision,baseSha256,action,fields,motivo,identity});
 const saved=await db.query(UPDATE_CAS,[STORE,c.expectedRevision,c.baseSha256,JSON.stringify(c.contenido),c.actorId,c.sku,JSON.stringify(c.anterior),JSON.stringify(c.nuevo),c.motivo]);
 if(saved.length!==1||Number(saved[0].revision)!==c.revision)throw new RomoCartaConflictoQA();
 return {ok:true,storeId:STORE,guardado:true,auditado:true,revision:c.revision,sku:c.sku};
}
const INSERT_CAS=`
WITH saved AS (
 INSERT INTO public.romo_carta_ediciones_v1
   (store_id,revision,base_sha256,contenido,actualizado_por)
 SELECT $1,1,$3,$4::jsonb,$5 WHERE $2=0
 ON CONFLICT DO NOTHING
 RETURNING store_id,revision
), audit AS (
 INSERT INTO public.romo_carta_ediciones_auditoria_v1
 (store_id,revision,revision_anterior,base_sha256,sku,anterior,
  nuevo,responsable_uid,motivo)
 SELECT store_id,revision,0,$3,$6,$7::jsonb,$8::jsonb,$5,$9 FROM saved
 RETURNING revision
)
SELECT saved.revision FROM saved JOIN audit USING (revision)`;

const UPDATE_CAS=`
WITH saved AS (
 UPDATE public.romo_carta_ediciones_v1
 SET revision=revision+1,contenido=$4::jsonb,actualizado_por=$5,
     actualizado_en=now()
 WHERE store_id=$1 AND revision=$2 AND base_sha256=$3
 RETURNING store_id,revision
), audit AS (
 INSERT INTO public.romo_carta_ediciones_auditoria_v1
 (store_id,revision,revision_anterior,base_sha256,sku,anterior,
  nuevo,responsable_uid,motivo)
 SELECT store_id,revision,$2,$3,$6,$7::jsonb,$8::jsonb,$5,$9 FROM saved
 RETURNING revision
)
SELECT saved.revision FROM saved JOIN audit USING (revision)`;

export async function leerEdicionesRomoQA({db,carta,identity}={}){
  authorizeRomoOperation(identity,'romo','serena','catalog.read');
  if(typeof db?.query!=='function')throw Error('Base Neon Romo requerida');
  const rows=await db.query(
    'SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',
    [STORE]);
  if(!Array.isArray(rows)||rows.length>1)throw Error('Lectura Romo no confirmada');
  return vistaEdicionesRomoQA(carta,rows[0]||null);
}

export async function guardarEdicionRomoQA({db,carta,identity,expectedRevision,baseSha256,sku,patch,motivo}={}){
  if(typeof db?.query!=='function')throw Error('Base Neon Romo requerida');
  authorizeRomoOperation(identity,'romo','serena','catalog.write');
  const rows=await db.query(
    'SELECT store_id,revision,base_sha256,contenido FROM public.romo_carta_ediciones_v1 WHERE store_id=$1',
    [STORE]);
  if(!Array.isArray(rows)||rows.length>1)throw Error('Lectura Romo no confirmada');
  const change=prepararCambioRomoQA({
    carta,row:rows[0]||null,identity,expectedRevision,baseSha256,sku,patch,motivo
  });
  const params=[STORE,change.expectedRevision,change.baseSha256,
    JSON.stringify(change.contenido),change.actorId,change.sku,
    JSON.stringify(change.anterior),JSON.stringify(change.nuevo),change.motivo];
  // La auditoría y el catálogo confirman juntos, o ninguno se guarda.
  const saved=await db.query(change.expectedRevision===0?INSERT_CAS:UPDATE_CAS,params);
  if(!Array.isArray(saved)||saved.length!==1||
     Number(saved[0].revision)!==change.revision)
    throw new RomoCartaConflictoQA();
  return Object.freeze({ok:true,storeId:STORE,guardado:true,
    revision:change.revision,sku:change.sku,auditado:true,
    mensaje:'Cambio guardado en ediciones Romo; comprobar aún la carta pública.'});
}


/**
 * Inicialización EXPLÍCITA por la dueña: crea la revisión 1 sin cambiar
 * NINGÚN precio ni producto. Necesaria para la barrera CAS comercial.
 * Nunca se invoca por consulta GET, render ni carga automática.
 */
export async function inicializarCatalogoRomoQA({
  db,carta,identity,baseSha256,motivo='Inicio de revisión segura de catálogo'
}={}){
  authorizeRomoOperation(identity,'romo','serena','catalog.write');
  if(typeof db?.query!=='function')throw Error('Se requiere Neon exclusivo Romo');
  const base=baseCatalogo(carta);
  if(typeof baseSha256!=='string'||baseSha256!==base.hash)
    throw new RomoCartaConflictoQA('La carta aprobada cambió. Actualiza antes de inicializar.');
  if(typeof motivo!=='string'||motivo.trim().length<4||motivo.trim().length>300)
    throw Error('Indica el motivo de inicialización');
  const doc={storeId:STORE,revision:1,overrides:{}};
  const initial=Object.freeze({event:'inicio_carta_aprobada',totalProductos:base.products.size});
  const sql=`
WITH inserted AS (
 INSERT INTO public.romo_carta_ediciones_v1
 (store_id,revision,base_sha256,contenido,actualizado_por)
 VALUES($1,1,$2,$3::jsonb,$4)
 ON CONFLICT DO NOTHING
 RETURNING store_id,revision
), audit AS (
 INSERT INTO public.romo_carta_ediciones_auditoria_v1
 (store_id,revision,revision_anterior,base_sha256,sku,
  anterior,nuevo,responsable_uid,motivo)
 SELECT store_id,revision,0,$2,'catalog:baseline',
  'null'::jsonb,$5::jsonb,$4,$6 FROM inserted
 RETURNING revision
)
SELECT inserted.revision FROM inserted JOIN audit USING(revision)`;
  const rows=await db.query(sql,[STORE,base.hash,
   JSON.stringify(doc),identity.userId,JSON.stringify(initial),motivo.trim()]);
  if(!Array.isArray(rows)||rows.length!==1||Number(rows[0].revision)!==1)
    throw new RomoCartaConflictoQA('El catálogo ya fue inicializado o se modificó');
  return Object.freeze({ok:true,storeId:STORE,revision:1,guardado:true,
    inicializado:true,sinCambiarPrecios:true,auditado:true});
}
