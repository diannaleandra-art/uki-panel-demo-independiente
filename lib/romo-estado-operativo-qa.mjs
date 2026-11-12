/**
 * PUENTE OPERATIVO ROMO / QA INACTIVO
 *
 * Replica la estructura COMPLETA del estado Uki (pedidos, caja, cierres,
 * clientes, movimientos) mediante una foto CIFRADA exclusiva de Romo.
 * La contraseña permanece en el navegador; Neon ve sólo AES-GCM.
 *
 * Un único documento lógico Romo con revisión optimista:
 * ningún teléfono puede sobreescribir un cierre/pedido de otro teléfono
 * sin detectar la revisión. NO usar el mismo almacén que Uki.
 *
 * Inventario necesita su propio mecanismo y permisos por rol; no se
 * autoriza mediante esta foto global.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';

export const ROMO_OPERATIVO_STORE_ID='romo:serena';
export const ROMO_OPERATIVO_SUCURSAL='Romo’s Sushi La Serena';
export const ROMO_OPERATIVO_FORMAT='uki-v813-browser';
export const ROMO_OPERATIVO_MAX_CIPHER_B64=2400000;
const UKI_HOSTS=new Set([
 'ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech',
 'ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech'
]);
const UKI_URL_ENVS=[
 'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL',
 'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL'
];

const BASE64=/^[A-Za-z0-9+/]+={0,2}$/;
const validBase64=(value,min,max)=>{
 if(typeof value!=='string'||value.length<min||value.length>max||
    value.length%4!==0||!BASE64.test(value))return false;
 // bytes length: base64 output length less padding
 const n=value.length*3/4-(value.endsWith('==')?2:value.endsWith('=')?1:0);
 return Number.isInteger(n)&&n>0;
};
const byteLength=value=>value.length*3/4-(value.endsWith('==')?2:value.endsWith('=')?1:0);

export function validateRomoEncryptedState(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
   snapshot.formato!==ROMO_OPERATIVO_FORMAT||
   snapshot.version!==1||snapshot.sucursal!==ROMO_OPERATIVO_SUCURSAL)
  throw new Error('La copia cifrada no pertenece a Romo La Serena');
 if(!validBase64(snapshot.salt,20,32)||byteLength(snapshot.salt)!==16||
    !validBase64(snapshot.iv,16,24)||byteLength(snapshot.iv)!==12||
    !validBase64(snapshot.cifrado,24,ROMO_OPERATIVO_MAX_CIPHER_B64)||
    byteLength(snapshot.cifrado)<17)
  throw new Error('El cifrado operativo de Romo no es válido');
 const raw=JSON.stringify(snapshot);
 if(raw.length>ROMO_OPERATIVO_MAX_CIPHER_B64+700)
  throw new Error('El snapshot supera el límite de seguridad');
 // No aceptar propiedades extras que puedan almacenar claves/cuentas sin cifrar.
 const keys=Object.keys(snapshot).sort();
 if(keys.join('|')!==['cifrado','formato','iv','salt','sucursal','version'].sort().join('|'))
  throw new Error('El estado cifrado contiene propiedades no autorizadas');
 return Object.freeze({...snapshot});
}

export function romoOperativoConfig(env={}){
 if(env.VERCEL_ENV!=='production'||env.ROMO_OPERATIVO_LIVE_ENABLED!=='true')
  return null;
 let db,origin;
 try{
  db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''));
  origin=new URL(String(env.ROMO_PANEL_ALLOWED_ORIGIN||''));
 }catch{return null}
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').trim().toLowerCase();
 if(!host||db.hostname.toLowerCase()!==host||UKI_HOSTS.has(host)||
    !host.endsWith('.neon.tech')||
    !['postgres:','postgresql:'].includes(db.protocol)||
    db.pathname!=='/romos_sushi'||!db.username||!db.password||
    origin.protocol!=='https:'||origin.username||origin.password||
    origin.pathname!=='/'||origin.search||origin.hash||
    !/^https:\/\/[^\/\s?#@]+$/.test(origin.origin))
  return null;
 for(const key of UKI_URL_ENVS){
  try{if(new URL(String(env[key]||'')).hostname.toLowerCase()===host)return null}catch{}
 }
 return Object.freeze({url:db.toString(),origin:origin.origin,storeId:ROMO_OPERATIVO_STORE_ID});
}

function verifyIdentity(identity,operation){
 return authorizeRomoOperation(identity,'romo','serena',operation);
}
function dbReady(db){
 if(!db||typeof db.query!=='function')throw new Error('Base exclusiva de Romo no disponible');
}

export async function readRomoOperativeState({db,identity}={}){
 verifyIdentity(identity,'orders.read');dbReady(db);
 const rows=await db.query(
  'SELECT revision, snapshot FROM public.romo_estado_operativo_v1 WHERE store_id=$1 LIMIT 1',
  [ROMO_OPERATIVO_STORE_ID]
 );
 if(!Array.isArray(rows)||rows.length>1)throw new Error('Estado Romo inconsistente');
 if(!rows.length)return Object.freeze({storeId:ROMO_OPERATIVO_STORE_ID,revision:0,snapshot:null});
 const rev=Number(rows[0].revision);
 if(!Number.isSafeInteger(rev)||rev<1)throw new Error('Revisión Romo no válida');
 return Object.freeze({
  storeId:ROMO_OPERATIVO_STORE_ID,revision:rev,
  snapshot:validateRomoEncryptedState(rows[0].snapshot)
 });
}

export class RomoConflictoRevision extends Error {
 constructor(){super('Romo cambió desde otro equipo: recarga antes de guardar');this.name='RomoConflictoRevision';this.code='REVISION_CONFLICTO';}
}

/**
 * POST de la foto TOTAL del panel, nunca de datos en claro.
 * La identidad verificada debe ser dueños/agendador con permiso de caja.
 * No permitir escritura solo por conocer una clave Uki.
 *
 * La tabla tiene UNA única fila. INSERT if expected=0 y UPDATE if expected>=1.
 * Si dos equipos guardan el mismo revisionEsperada, solo uno puede ganar.
 */
export async function saveRomoOperativeState({
 db,identity,expectedRevision,snapshot
}={}){
 verifyIdentity(identity,'cash.write');dbReady(db);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
    expectedRevision>Number.MAX_SAFE_INTEGER-1)
  throw new Error('Se requiere una revisión operativa válida');
 const envelope=validateRomoEncryptedState(snapshot);
 let rows;
 if(expectedRevision===0){
  rows=await db.query(
   'INSERT INTO public.romo_estado_operativo_v1 (store_id,revision,snapshot,actualizado_por) VALUES ($1,1,$2::jsonb,$3) ON CONFLICT (store_id) DO NOTHING RETURNING revision',
   [ROMO_OPERATIVO_STORE_ID,JSON.stringify(envelope),identity.userId]
  );
 }else{
  rows=await db.query(
   'UPDATE public.romo_estado_operativo_v1 SET revision=revision+1,snapshot=$3::jsonb,actualizado_por=$4,actualizado_en=now() WHERE store_id=$1 AND revision=$2 RETURNING revision',
   [ROMO_OPERATIVO_STORE_ID,expectedRevision,JSON.stringify(envelope),identity.userId]
  );
 }
 if(!Array.isArray(rows)||rows.length>1)throw new Error('Guardado de Romo inconsistente');
 if(rows.length===0)throw new RomoConflictoRevision();
 const revision=Number(rows[0].revision);
 if(!Number.isSafeInteger(revision)||revision!==expectedRevision+1)
  throw new Error('Revisión guardada de Romo inválida');
 return Object.freeze({storeId:ROMO_OPERATIVO_STORE_ID,revision});
}
