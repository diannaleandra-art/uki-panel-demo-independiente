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
