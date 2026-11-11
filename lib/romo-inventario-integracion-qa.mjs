/**
 * Romo La Serena — inventario independiente, API futura, sin escritura real.
 * Nunca se guardará un inventario Romo en tiendas, claves o tablas de Uki.
 * Este módulo no habilita ningún endpoint ni ejecuta migraciones.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {reportRomoInventory,ROMO_INVENTORY_STORE_ID} from './romo-inventario-modelo-qa.mjs';

export const ROMO_INVENTORY_FORMAT='romo-inventario-v1';
export const emptyRomoInventory=()=>({
 formato:ROMO_INVENTORY_FORMAT,sucursal:ROMO_INVENTORY_STORE_ID,items:[]
});
export function normalizeRomoInventory(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||
  data.formato!==ROMO_INVENTORY_FORMAT||data.sucursal!==ROMO_INVENTORY_STORE_ID)
  throw Error('Inventario no corresponde a Romo La Serena');
 const items=reportRomoInventory(ROMO_INVENTORY_STORE_ID,data.items);
 if(JSON.stringify(items).length>220000)throw Error('Inventario demasiado grande');
 // Guardar solo datos de artículos; diferencia y reponer se recalculan siempre.
 return {formato:ROMO_INVENTORY_FORMAT,sucursal:ROMO_INVENTORY_STORE_ID,
  items:items.map(({id,name,unit,recibido,hay,disponible},i)=>({
   id,name,unit,recibido,hay,disponible,minimo:data.items[i].minimo
  }))};
}
function dbReady(db){
 if(!db||typeof db.query!=='function')throw Error('Base exclusiva de Romo requerida');
}
export class RomoInventoryConflict extends Error {
 constructor(){super('Otro teléfono modificó inventario de Romo: actualiza antes de guardar');
  this.code='ROMO_INVENTORY_CONFLICT';}
}
export async function readRomoInventory({db,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','inventory.read');
 dbReady(db);
 const rows=await db.query(
  'SELECT revision,contenido FROM public.romo_inventario_v1 WHERE store_id=$1 LIMIT 1',
  [ROMO_INVENTORY_STORE_ID]
 );
 if(!Array.isArray(rows)||rows.length>1)throw Error('Inventario inconsistente');
 if(!rows.length)return {storeId:ROMO_INVENTORY_STORE_ID,revision:0,inventory:emptyRomoInventory()};
 const revision=Number(rows[0].revision);
 if(!Number.isSafeInteger(revision)||revision<1)throw Error('Revisión inválida');
 return {storeId:ROMO_INVENTORY_STORE_ID,revision,inventory:normalizeRomoInventory(rows[0].contenido)};
}
/** Preparado pero no expuesto en ninguna API. */
export async function saveRomoInventory({db,identity,expectedRevision,inventory}={}){
 authorizeRomoOperation(identity,'romo','serena','inventory.write');
 dbReady(db);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
  throw Error('Revisión inválida');
 const data=JSON.stringify(normalizeRomoInventory(inventory));
 let rows;
 if(expectedRevision===0){
  rows=await db.query(
   'INSERT INTO public.romo_inventario_v1(store_id,revision,contenido,actualizado_por) VALUES($1,1,$2::jsonb,$3) ON CONFLICT(store_id) DO NOTHING RETURNING revision',
   [ROMO_INVENTORY_STORE_ID,data,identity.userId]);
 }else{
  rows=await db.query(
   'UPDATE public.romo_inventario_v1 SET revision=revision+1,contenido=$3::jsonb,actualizado_por=$4,actualizado_en=NOW() WHERE store_id=$1 AND revision=$2 RETURNING revision',
   [ROMO_INVENTORY_STORE_ID,expectedRevision,data,identity.userId]);
 }
 if(!Array.isArray(rows)||rows.length>1)throw Error('No se pudo confirmar inventario');
 if(!rows.length)throw new RomoInventoryConflict();
 const revision=Number(rows[0].revision);
 if(revision!==expectedRevision+1)throw Error('Revisión de inventario no confirmada');
 return {storeId:ROMO_INVENTORY_STORE_ID,revision};
}
