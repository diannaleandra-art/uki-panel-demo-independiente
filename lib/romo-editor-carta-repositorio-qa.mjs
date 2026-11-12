/**
 * Romo — repositorio para conectar el MISMO editor Carta y precios del panel Uki.
 * PREPARACIÓN QA NO DESPLEGADA. No tiene credenciales, HTTP, Firebase ni red propia.
 * Nunca usar el conector simplificado que perdería detalles de promo/armado.
 * db debe inyectarse desde servidor, con autenticación Google real verificada;
 * la tabla Romo tiene permisos del servicio REVOCADOS hasta autorización.
 */
import {normalizarCatalogoCompletoRomoQA,cambiarCartaRomoEnMemoriaQA,cambiarCategoriasRomoEnMemoriaQA,vistaCartaRomoQA} from './romo-editor-carta-compatibilidad-qa.mjs';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
const STORE='romo:serena';
const SELECT='SELECT revision,contenido FROM public.romo_catalogo_v1 WHERE store_id=$1';
const INSERT='INSERT INTO public.romo_catalogo_v1(store_id,revision,contenido,actualizado_por) VALUES($1,1,$2::jsonb,$3) ON CONFLICT(store_id) DO NOTHING RETURNING revision';
const UPDATE='UPDATE public.romo_catalogo_v1 SET revision=revision+1,contenido=$2::jsonb,actualizado_por=$3,actualizado_en=NOW() WHERE store_id=$1 AND revision=$4 RETURNING revision';
function requireDb(db){if(!db||typeof db.query!=='function')throw Error('Backend Romo no habilitado');return db}
function decode(rows){
 if(!Array.isArray(rows)||rows.length>1)throw Error('Lectura de catálogo ambigua');
 if(!rows.length)return null;
 const {revision,contenido}=rows[0];
 let raw=contenido;
 if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{throw Error('Documento corrupto')}}
 const doc=normalizarCatalogoCompletoRomoQA(raw);
 if(Number(revision)!==doc.revision||doc.revision<1)throw Error('Revisión de catálogo discordante');
 return doc;
}
async function read(db){
 const rows=await requireDb(db).query(SELECT,[STORE]);
 return decode(rows);
}
function json(doc){
 const safe=JSON.stringify(normalizarCatalogoCompletoRomoQA(doc));
 if(Buffer.byteLength(safe,'utf8')>175000)throw Error('Catálogo demasiado grande');
 return safe;
}
/** Lectura administradora: rol consultado en Neon por backend, nunca del navegador. */
export async function leerEditorRomoQA({db,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','catalog.read');
 return read(db);
}
/** Lectura PÚBLICA FILTRADA: sin costos, proveedores, usuarios ni registros de caja. */
export async function leerCartaPublicaRomoQA({db}={}){
 const full=await read(db);return full?vistaCartaRomoQA(full):null;
}
/** Alta inicial SOLO con catálogo Romo confirmado por propietaria, no con Uki. */
export async function prepararAltaCatalogoRomoQA({db,identity,snapshot}={}){
 const actor=authorizeRomoOperation(identity,'romo','serena','catalog.write');
 const source=normalizarCatalogoCompletoRomoQA(snapshot);
 if(source.revision!==0||source.products.length===0)throw Error('Inicialización requiere catálogo Romo confirmado');
 const next={...source,revision:1};
 const rows=await requireDb(db).query(INSERT,[STORE,json(next),actor.actorId]);
 if(!Array.isArray(rows)||rows.length!==1||Number(rows[0].revision)!==1)
  throw Error('El catálogo ya existe o no se confirmó; consulta antes de editar');
 return {storeId:STORE,revision:1};
}
/** Control optimista de cambios en dos teléfonos, con todos los detalles intactos. */
export async function guardarAccionCartaRomoQA({db,identity,mutation}={}){
 const actor=authorizeRomoOperation(identity,'romo','serena','catalog.write');
 const before=await read(db);
 if(!before)throw Error('Primero configura la carta comercial Romo aprobada');
 const after=cambiarCartaRomoEnMemoriaQA(before,mutation);
 const rows=await requireDb(db).query(UPDATE,[STORE,json(after),actor.actorId,before.revision]);
 if(!Array.isArray(rows)||rows.length!==1||Number(rows[0].revision)!==after.revision)
  throw Error('La carta cambió en otro dispositivo: actualiza antes de guardar');
 return {storeId:STORE,revision:after.revision};
}
/**
 * Misma tabla Romo, mismas reglas del editor, versión global atómica.
 * No abre endpoint; la identidad viene exclusivamente del servidor.
 * Acciones: crear, renombrar, retirar, restaurar. No destruye productos.
 */
export async function guardarAccionCategoriaRomoQA({db,identity,mutation}={}){
 const actor=authorizeRomoOperation(identity,'romo','serena','catalog.write');
 if(!mutation||mutation.storeId!==STORE)throw Error('Sucursal ajena no admitida');
 const before=await read(db);
 if(!before)throw Error('Primero configura la carta comercial Romo aprobada');
 const after=cambiarCategoriasRomoEnMemoriaQA(before,mutation);
 const rows=await requireDb(db).query(UPDATE,[STORE,json(after),actor.actorId,before.revision]);
 if(!Array.isArray(rows)||rows.length!==1||Number(rows[0].revision)!==after.revision)
  throw Error('La carta cambió en otro dispositivo: actualiza antes de guardar');
 return {storeId:STORE,revision:after.revision};
}
export const ROMO_EDITOR_CARTA_NO_PUBLICADO=true;
