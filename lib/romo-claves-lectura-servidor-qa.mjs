/**
 * Conexión de LECTURA de verificadores cifrados en la base PRIVADA Romo.
 * Autenticación JWT Firebase y roles se verifican ANTES desde el servidor,
 * nunca a partir de cabeceras o JSON inventados por el navegador.
 *
 * Sin escrituras, sin contraseña en solicitud, sin conexión ni variables
 * activadas por defecto. No mezcla datos, tokens ni colecciones de Uki.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {validateRomoPassProof} from './romo-clave-compartida-qa.mjs';

const STORE='romo:serena';
const MAX_PROOF_BYTES=1200;
const URL_KEYS=Object.freeze([
  'UKI_INVENTARIO_LIVE_DATABASE_URL','UKI_INVENTARIO_QA_DATABASE_URL',
  'UKI_FIN_PRIVATE_DATABASE_URL','UKI_FIN_QA_DATABASE_URL'
]);

/**
 * Sólo configuración explícita en el backend de Romo.
 * Este flag es independiente de ROMO_PEDIDOS_LIVE_ENABLED, que debe seguir
 * apagado mientras no se hayan terminado las pruebas de pedidos.
 */
export function romoClavesReadConfig(env={}){
  if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='preparacion/uki-romo-sobre-main-20261114'||
    env.ROMO_ACCESO_CLAVES_QA_ENABLED!=='true')
    return null;
  const raw=String(env.ROMO_PRIVATE_DATABASE_URL||'');
  const hostname=String(env.ROMO_PRIVATE_DATABASE_HOST||'').trim().toLowerCase();
  const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
  if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||
     !/^[a-z0-9.-]+$/.test(hostname))return null;
  let parsed;
  try{parsed=new URL(raw)}catch{return null}
  if(!['postgres:','postgresql:'].includes(parsed.protocol)||
     parsed.hostname.toLowerCase()!==hostname||!parsed.username||
     !parsed.password||parsed.pathname!=='/romos_sushi')return null;
  for(const name of URL_KEYS){
    try{
      const uki=new URL(String(env[name]||''));
      // Exigir proyecto/host diferente, no solo otro nombre de BD.
      if(uki.hostname.toLowerCase()===hostname)return null;
    }catch{}
  }
  return Object.freeze({url:parsed.toString(),origin,storeId:STORE});
}

/**
 * Devuelve solo uno o dos paquetes AES-GCM ya validados.
 * El usuario debe tener una sesión Google firmada y figurar ACTIVO
 * en public.romo_personal_acceso_v1 (control previo resolveRomoIdentity).
 * La clave se valida localmente en el iPhone/PC; nunca llega al servidor.
 */
export async function readRomoSharedPassProofs({db,identity}){
  authorizeRomoOperation(identity,'romo','serena','catalog.read');
  if(!db||typeof db.query!=='function')
    throw new Error('Base exclusiva de Romo no disponible');
  const rows=await db.query(
    'SELECT uki_source,proof FROM public.romo_clave_compartida_v1 WHERE store_id=$1 ORDER BY uki_source LIMIT 3',
    [STORE]
  );
  if(!Array.isArray(rows)||rows.length>2)
    throw new Error('La configuración de claves de Romo es inválida');
  const sources=new Set();
  const proofs=[];
  for(const row of rows){
    const value=typeof row?.proof==='string'?JSON.parse(row.proof):row?.proof;
    const text=JSON.stringify(value);
    if(!text||text.length>MAX_PROOF_BYTES)
      throw new Error('Prueba cifrada de Romo inválida');
    const checked=validateRomoPassProof(value);
    if(row.uki_source!==checked.slot||sources.has(checked.slot))
      throw new Error('Fuentes de contraseña Uki duplicadas o ajenas');
    sources.add(checked.slot);
    // No devolver metadatos de trabajadores/ventas, ni contraseñas.
    proofs.push(Object.freeze({...value}));
  }
  return Object.freeze({
    storeId:STORE,
    configured:proofs.length>0,
    proofs:Object.freeze(proofs)
  });
}
