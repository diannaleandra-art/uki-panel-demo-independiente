/**
 * Romo La Serena: editor de SOBREESCRITURAS mínimas sobre la carta aprobada.
 *
 * NO reemplaza romo_catalogo_v1, los 40 productos ni sus recetas.
 * No modifica ningún producto si un guardado no queda confirmado con CAS
 * y registro de auditoría en UNA sentencia SQL.
 * Esta librería no habilita rutas ni banderas de producción.
 */
import {createHash} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';

const STORE='romo:serena';
// Compatibilidad de las 40 referencias confirmadas. Este SKU es solo Uki.
const SKU_PROMO_SOLO_UKI='dish:sushi-burger-promo';
const ALLOWED=new Set(['price','available','name','description','categoriaSlug']);
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const HAS=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const POSINT=x=>Number.isSafeInteger(x)&&x>=0;
const SHA=/^[0-9a-f]{64}$/;

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
  }
  return {revision,overrides:data.overrides};
}

function validarPatch(patch,categories){
  if(!OBJ(patch)||Object.keys(patch).length<1||
     Object.keys(patch).some(k=>!ALLOWED.has(k)))
    throw Error('Solo se permiten campos de edición aprobados');
  if(HAS(patch,'price')&&(!Number.isSafeInteger(patch.price)||
      patch.price<1||patch.price>1000000))
    throw Error('Precio inválido');
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
    categories:carta.categories,products:productos,ingredients:carta.ingredients,
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
  const contenido={storeId:STORE,revision,overrides};
  if(Buffer.byteLength(JSON.stringify(contenido),'utf8')>180000)
    throw Error('El registro de ediciones es demasiado grande');
  return Object.freeze({
    storeId:STORE,expectedRevision,revision,baseSha256:base.hash,
    sku,anterior:before,nuevo:Object.keys(next).length?next:null,
    actorId:identity.userId,motivo:motivo.trim(),contenido
  });
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
