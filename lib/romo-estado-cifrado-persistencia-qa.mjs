/**
 * Romo La Serena — bóveda cifrada del MISMO panel de Uki.
 * Código de PREPARACIÓN. No despliegue, no sesión alternativa ni migración.
 * Guarda exclusivamente el sobre AES-GCM del panel; jamás la contraseña.
 * La identidad viene de Google firmado + rol activo en Neon Romo.
 * El almacenamiento Uki/Firestore NO se consulta ni se escribe.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';

const STORE='romo:serena';
const SUCURSAL='Romo’s Sushi La Serena';
const FORMAT='uki-v813-browser';
const MAX_SNAPSHOT_BYTES=2_000_000;
const SELECT='SELECT revision,snapshot FROM public.romo_estado_operativo_v1 WHERE store_id=$1';
const INSERT='INSERT INTO public.romo_estado_operativo_v1 (store_id,revision,snapshot,actualizado_por) VALUES ($1,1,$2::jsonb,$3) ON CONFLICT(store_id) DO NOTHING RETURNING revision';
const UPDATE='UPDATE public.romo_estado_operativo_v1 SET revision=revision+1,snapshot=$2::jsonb,actualizado_por=$3,actualizado_en=NOW() WHERE store_id=$1 AND revision=$4 RETURNING revision';

const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const safeRevision=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000000;

function base64(value,{exact=null,max=MAX_SNAPSHOT_BYTES}={}){
 if(typeof value!=='string'||value.length>max||value.length<4||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
   throw Error('Paquete cifrado de Romo inválido');
 const decoded=Buffer.from(value,'base64');
 if(decoded.toString('base64')!==value||
    (exact!==null&&decoded.length!==exact))
   throw Error('Paquete cifrado de Romo dañado');
 return decoded.length;
}

/** Acepta sólo el formato exacto emitido por cifrarLocal del panel existente. */
export function validarSobreCifradoRomoQA(snapshot){
 if(!isObject(snapshot)||
    Object.keys(snapshot).length!==6||
    Object.keys(snapshot).some(k=>!['formato','version','sucursal','salt','iv','cifrado'].includes(k))||
    snapshot.formato!==FORMAT||snapshot.version!==1||snapshot.sucursal!==SUCURSAL)
   throw Error('Sobre cifrado de otra sucursal o versión');
 base64(snapshot.salt,{exact:16,max:64});
 base64(snapshot.iv,{exact:12,max:64});
 const ciphertextBytes=base64(snapshot.cifrado);
 if(ciphertextBytes<16)throw Error('Cifrado incompleto');
 const encoded=JSON.stringify(snapshot);
 if(Buffer.byteLength(encoded,'utf8')>MAX_SNAPSHOT_BYTES)
   throw Error('Estado demasiado grande para guardar');
 return encoded;
}

function backend(db){
 if(!db||typeof db.query!=='function')
   throw Error('Solo el servidor autorizado puede acceder a Romo');
 return db;
}

function rowToResult(rows){
 if(!Array.isArray(rows)||rows.length>1)
   throw Error('Lectura de Romo ambigua');
 if(!rows.length)
   return Object.freeze({ok:true,storeId:STORE,revision:0,snapshot:null});
 const r=rows[0],revision=Number(r.revision);
 if(!safeRevision(revision)||revision<1)
   throw Error('Revisión cifrada inválida');
 const snapshot=typeof r.snapshot==='string'?JSON.parse(r.snapshot):r.snapshot;
 validarSobreCifradoRomoQA(snapshot);
 return Object.freeze({ok:true,storeId:STORE,revision,snapshot});
}

/** Descifrado EXCLUSIVO del navegador con la clave existente; el servidor sólo lee ciphertext. */
export async function leerEstadoCifradoRomoQA({db,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','cash.read');
 const rows=await backend(db).query(SELECT,[STORE]);
 return rowToResult(rows);
}

/**
 * Guardado con CAS y permiso del panel verificado.
 * La protección de contraseña en el navegador + sincronización son
 * requisitos adicionales; una fila de dueños sola NO habilita la operación.
 */
export async function guardarEstadoCifradoRomoQA({db,identity,expectedRevision,snapshot}={}){
 const actor=authorizeRomoOperation(identity,'romo','serena','cash.write');
 if(!safeRevision(expectedRevision))throw Error('Actualiza antes de guardar Romo');
 const contenido=validarSobreCifradoRomoQA(snapshot);
 if(expectedRevision===0){
  // Evitar que un agendador o una apertura sin clave verificada bloquee
  // la caja inicial cifrándola con una contraseña no registrada.
  authorizeRomoOperation(identity,'romo','serena','owners.write');
  const proofRows=await backend(db).query(
   'SELECT uki_source FROM public.romo_clave_compartida_v1 WHERE store_id=$1 LIMIT 1',
   [STORE]);
  if(!Array.isArray(proofRows)||proofRows.length!==1)
   throw Error('Primero vincula la clave Uki cifrada mediante acceso de dueños');
 }
 const sql=expectedRevision===0?INSERT:UPDATE;
 const args=expectedRevision===0?
   [STORE,contenido,actor.actorId]:
   [STORE,contenido,actor.actorId,expectedRevision];
 const rows=await backend(db).query(sql,args);
 if(!Array.isArray(rows)||rows.length>1)
   throw Error('Confirmación de guardado Romo inválida');
 if(rows.length===0)throw Error('Romo cambió en otro teléfono; recarga antes de guardar');
 const next=Number(rows[0].revision);
 if(next!==expectedRevision+1)
   throw Error('Revisión guardada inesperada');
 return Object.freeze({ok:true,storeId:STORE,revision:next});
}

export const ROMO_ESTADO_CIFRADO_QA_NO_ACTIVADO=true;
