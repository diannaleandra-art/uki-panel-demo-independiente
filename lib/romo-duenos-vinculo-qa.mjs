/**
 * Romo Balmaceda: comprobar la MISMA sesión Google de Uki antes de preparar
 * una autorización de dueños. LECTURA de identidad únicamente; sin SQL,
 * sin asignación de roles y sin recopilar contraseñas.
 *
 * Es sólo un candidato verificado. No concede acceso ni crea una fila
 * en romo_personal_acceso_v1. Activación real requiere autorización adicional.
 */
import {ROMO_STORE_ID,ownerGoogleEmailMatchesVerifiedToken,
  verifyFirebaseGoogleToken} from './romo-identidad-servidor-qa.mjs';

const TOKEN=/^Bearer ([A-Za-z0-9_.-]{30,12000})$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;

/** La configuración debe permanecer apagada sin autorización expresa. */
export function ownerLinkInspectionEnabled(env={}){
  return env.VERCEL_ENV==='production'&&
    env.ROMO_DUENOS_VINCULO_ENABLED==='true'&&
    typeof env.ROMO_DUENOS_GOOGLE_EMAIL==='string'&&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ROMO_DUENOS_GOOGLE_EMAIL.trim())&&
    !env.ROMO_DUENOS_GOOGLE_EMAIL.includes(',');
}

/**
 * Verifica firma Firebase, proveedor Google y email aprobado en el servidor.
 * Solo retorna el UID fiable para una fase FUTURA de alta autorizada.
 */
export async function inspectRomoOwnerGoogle({
  authorization,env={},verifyToken=verifyFirebaseGoogleToken
}={}){
  if(!ownerLinkInspectionEnabled(env))return Object.freeze({ok:false,reason:'disabled'});
  const match=typeof authorization==='string'?authorization.match(TOKEN):null;
  if(!match||match[1].startsWith('UKIDEV1.')||typeof verifyToken!=='function')
    return Object.freeze({ok:false,reason:'invalid_session'});
  let claims;
  try{claims=await verifyToken(match[1])}catch{
    return Object.freeze({ok:false,reason:'invalid_session'});
  }
  if(!UID.test(String(claims?.sub||''))||
    !ownerGoogleEmailMatchesVerifiedToken(claims,env))
    return Object.freeze({ok:false,reason:'not_owner_google'});
  return Object.freeze({
    ok:true,storeId:ROMO_STORE_ID,verifiedUid:claims.sub,
    // NO significa permiso en Neon ni habilitación de pedidos.
    authorizationGranted:false,
    requiresRomoRoleEnrollment:true
  });
}


/**
 * Únicamente LECTURA: tras verificar la firma Google en inspectRomoOwnerGoogle,
 * consultar si el mismo UID YA está activo como dueña de Romo. No crea,
 * actualiza ni concede permisos. La función no se llama desde el navegador.
 */
export async function inspectRomoOwnerRoleQA({verifiedUid,db}={}){
 if(typeof verifiedUid!=='string'||!UID.test(verifiedUid)||!db||
    typeof db.query!=='function')
  throw new Error('La identidad Google verificada y conexión Romo son obligatorias');
 const rows=await db.query(
  'SELECT rol FROM public.romo_personal_acceso_v1 WHERE auth_uid=$1 AND store_id=$2 AND activo=true LIMIT 1',
  [verifiedUid,ROMO_STORE_ID]
 );
 if(!Array.isArray(rows)||rows.length>1||
   (rows.length===1&&!['duenos','agendador','inventario'].includes(rows[0]?.rol)))
  throw new Error('La comprobación de permisos Romo no es válida');
 const ownerActive=rows.length===1&&rows[0].rol==='duenos';
 return Object.freeze({
  storeId:ROMO_STORE_ID,
  ownerRoleActive:ownerActive,
  requiresRomoRoleEnrollment:!ownerActive,
  // Esta ruta NO concede acceso ni activa pedidos aunque el rol ya exista.
  authorizationGranted:false
 });
}
