/**
 * Romo La Serena — CONTRATO DE CATÁLOGO QA. No configura despliegues, no
 * ejecuta migraciones ni escribe datos hasta que un servicio lo invoque.
 * La base de Romo es independiente de la carta y las tablas de Uki.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';

export const ROMO_STORE_ID='romo:serena';
export const ROMO_CATALOG_FORMAT='romo-catalogo-v1';
const productKinds=new Set(['sushi','roll','handroll','gohan','burger','entrada','bebida','extra','otro']);
const promotionKinds=new Set(['sushi','gohan','combo','otro']);
const ingredientKinds=new Set(['vegetal','proteina','envoltura','salsa','adicional']);
const skuPattern=/^[a-z0-9][a-z0-9._:-]{0,119}$/;
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const peso=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000;
const qty=value=>Number.isSafeInteger(value)&&value>=0&&value<=300;
const empty=()=>({formato:ROMO_CATALOG_FORMAT,sucursal:ROMO_STORE_ID,productos:[],promociones:[],ingredientes:[]});
export const emptyRomoCatalog=()=>structuredClone(empty());

function itemNormalized(row,type){
 if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Producto inválido');
 const allowed=type==='productos'?productKinds:type==='promociones'?promotionKinds:ingredientKinds;
 if(!skuPattern.test(row.sku||'')||!row.sku.startsWith('romo:'))
  throw Error('Código de artículo no pertenece a Romo');
 if(!allowed.has(row.kind)||!text(row.name,100)||
    (row.description!==undefined&&row.description!==''&&!text(row.description,500))||
    /\bpizzas?\b/i.test(row.name)||/\bpizzas?\b/i.test(row.kind))
  throw Error('Tipo o nombre de artículo no permitido');
 if(!peso(row.price)||type!=='ingredientes'&&row.price<1)
  throw Error('Precio de artículo inválido');
 if(row.available!==undefined&&typeof row.available!=='boolean'||
    row.visible!==undefined&&typeof row.visible!=='boolean')
  throw Error('Visibilidad o disponibilidad inválida');
 const result={sku:row.sku,kind:row.kind,name:row.name.trim(),description:String(row.description||'').trim(),
  price:row.price,available:row.available!==false,visible:row.visible===true};
 if(type==='promociones'){
  const pieces=row.pieces??0,rolls=row.rollCount??0,perRoll=row.piecesPerRoll??12,
   sauces=row.sauceCount??0,korokes=row.korokes??0;
  if(!qty(pieces)||!qty(rolls)||![10,12].includes(perRoll)||
     !qty(sauces)||!qty(korokes)||rolls>20||sauces>20||korokes>30||
     (rolls>0&&pieces!==rolls*perRoll))
   throw Error('Composición de promoción inválida');
  Object.assign(result,{pieces,rollCount:rolls,piecesPerRoll:perRoll,sauceCount:sauces,korokes});
  if(row.payments!==undefined){
   const payments=new Set(['efectivo','transferencia','debito','credito','edenred','junaeb']);
   if(!Array.isArray(row.payments)||row.payments.length>6||
      row.payments.some(x=>!payments.has(x)))
    throw Error('Medios de pago inválidos');
   result.payments=[...new Set(row.payments)];
  }
 }
 return result;
}
export function normalizeRomoCatalog(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||
    data.formato!==ROMO_CATALOG_FORMAT||data.sucursal!==ROMO_STORE_ID)
  throw Error('Catálogo no corresponde a Romo La Serena');
 const result=empty(),used=new Set();
 for(const section of ['productos','promociones','ingredientes']){
  const entries=data[section];
  if(!Array.isArray(entries)||entries.length>300)throw Error('Sección de catálogo inválida');
  result[section]=entries.map(x=>{
   const item=itemNormalized(x,section);
   if(used.has(item.sku))throw Error('Código de artículo repetido');
   used.add(item.sku);
   return item;
  });
 }
 if(JSON.stringify(result).length>220000)throw Error('Catálogo supera límite de seguridad');
 return result;
}
export function publicRomoCatalog(catalog){
 const safe=normalizeRomoCatalog(catalog);
 return {
  storeId:ROMO_STORE_ID,
  productos:safe.productos.filter(x=>x.visible&&x.available),
  promociones:safe.promociones.filter(x=>x.visible&&x.available),
  ingredientes:safe.ingredientes.filter(x=>x.visible&&x.available)
 };
}
function checkDB(db){
 if(!db||typeof db.query!=='function')throw Error('Base independiente de Romo requerida');
}
export class RomoCatalogConflict extends Error {
 constructor(){super('El catálogo cambió en otro equipo; recarga antes de guardar');this.code='ROMO_CATALOG_CONFLICT';}
}
export async function readRomoCatalog({db,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','catalog.read');
 checkDB(db);
 const rows=await db.query(
  'SELECT revision,contenido FROM public.romo_catalogo_v1 WHERE store_id=$1 LIMIT 1',
  [ROMO_STORE_ID]
 );
 if(!Array.isArray(rows)||rows.length>1)throw Error('Estado de catálogo inconsistente');
 if(!rows.length)return {storeId:ROMO_STORE_ID,revision:0,catalog:empty()};
 const revision=Number(rows[0].revision);
 if(!Number.isSafeInteger(revision)||revision<1)throw Error('Revisión inválida');
 return {storeId:ROMO_STORE_ID,revision,catalog:normalizeRomoCatalog(rows[0].contenido)};
}
/** Función reservada para pruebas / futura administración aprobada.
 * Ningún endpoint publicado en esta rama invoca saveRomoCatalog. */
export async function saveRomoCatalog({db,identity,expectedRevision,catalog}={}){
 authorizeRomoOperation(identity,'romo','serena','catalog.write');
 checkDB(db);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
  throw Error('Revisión esperada inválida');
 const safe=normalizeRomoCatalog(catalog);
 const data=JSON.stringify(safe);
 let rows;
 if(expectedRevision===0){
  rows=await db.query(
   'INSERT INTO public.romo_catalogo_v1(store_id,revision,contenido,actualizado_por) VALUES($1,1,$2::jsonb,$3) ON CONFLICT(store_id) DO NOTHING RETURNING revision',
   [ROMO_STORE_ID,data,identity.userId]);
 }else{
  rows=await db.query(
   'UPDATE public.romo_catalogo_v1 SET revision=revision+1,contenido=$3::jsonb,actualizado_por=$4,actualizado_en=NOW() WHERE store_id=$1 AND revision=$2 RETURNING revision',
   [ROMO_STORE_ID,expectedRevision,data,identity.userId]);
 }
 if(!Array.isArray(rows)||rows.length>1)throw Error('Guardado no confirmado');
 if(!rows.length)throw new RomoCatalogConflict();
 const revision=Number(rows[0].revision);
 if(revision!==expectedRevision+1)throw Error('Revisión no confirmada');
 return {storeId:ROMO_STORE_ID,revision};
}
