/**
 * Romo La Serena: vinculación sólo de la MISMA identidad Google de Uki.
 * Sin nuevo inicio de sesión, PIN ni contraseña. No habilita operaciones.
 * Identidad siempre desde token Google firmado; rol decidido en servidor.
 */
import {inspectRomoOwnerGoogle} from './romo-duenos-vinculo-qa.mjs';
import {ROMO_STORE_ID} from './romo-identidad-servidor-qa.mjs';
const READ='SELECT rol,activo FROM public.romo_personal_acceso_v1 WHERE auth_uid=$1 AND store_id=$2 LIMIT 1';
const INSERT='INSERT INTO public.romo_personal_acceso_v1 (auth_uid,store_id,rol,activo) '+
 'SELECT $1,$2,\'duenos\',true WHERE NOT EXISTS ('+
 'SELECT 1 FROM public.romo_personal_acceso_v1 '+
 'WHERE store_id=$2 AND rol=\'duenos\' AND activo=true AND auth_uid<>$1) '+
 'ON CONFLICT (auth_uid) DO NOTHING RETURNING rol,activo';
export function romoAltaDuenosConfigQA(env={}){
 if(env.VERCEL_ENV!=='production'||
    env.ROMO_DUENOS_VINCULO_ENABLED!=='true'||
    env.ROMO_DUENOS_ALTA_EXPLICITA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const hostname=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 const raw=String(env.ROMO_DUENOS_ALTA_DATABASE_URL||'');
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!/^[a-z0-9.-]+$/.test(hostname))return null;
 let parsed;
 try{parsed=new URL(raw)}catch{return null}
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||
    parsed.hostname.toLowerCase()!==hostname||
    parsed.pathname!=='/romos_sushi'||parsed.username!=='romo_owner_linker'||
    !parsed.password)return null;
 return Object.freeze({origin,databaseUrl:parsed.toString(),storeId:ROMO_STORE_ID});
}
export async function enlazarDuenosRomoConGoogleExistenteQA({
 authorization,db,env={},verifyToken
}={}){
 if(!romoAltaDuenosConfigQA(env))
  throw Error('Vinculación de dueña Romo aún no habilitada');
 if(!db||typeof db.query!=='function')throw Error('Base Romo no disponible');
 const proof=await inspectRomoOwnerGoogle({
  authorization,env,...(verifyToken?{verifyToken}:{})
 });
 if(!proof.ok||typeof proof.verifiedUid!=='string')
  throw Error('Cuenta Google de Uki no verificada');
 const uid=proof.verifiedUid;
 const existing=await db.query(READ,[uid,ROMO_STORE_ID]);
 if(!Array.isArray(existing)||existing.length>1)
  throw Error('Estado de acceso Romo inválido');
 if(existing.length){
  if(existing[0].rol!=='duenos'||existing[0].activo!==true)
   throw Error('La cuenta tiene otro acceso y requiere revisión');
  return Object.freeze({ok:true,storeId:ROMO_STORE_ID,alreadyLinked:true,salesEnabled:false});
 }
 const added=await db.query(INSERT,[uid,ROMO_STORE_ID]);
 if(!Array.isArray(added)||added.length!==1||
    added[0]?.rol!=='duenos'||added[0]?.activo!==true)
  throw Error('No se completó vinculación; revisar permisos');
 return Object.freeze({ok:true,storeId:ROMO_STORE_ID,alreadyLinked:false,salesEnabled:false});
}
