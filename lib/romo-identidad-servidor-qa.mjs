/**
 * Romo La Serena — resolución de identidad exclusiva del servidor.
 *
 * Reutiliza el inicio de sesión Google del Firebase Auth de Uki, PERO el
 * permiso de operar Romo sólo proviene de public.romo_personal_acceso_v1,
 * en la nueva base exclusiva de Romo. No reutilizar roles, caja ni tokens de
 * sucursal de Uki. No acepta rol, UID ni sucursal del body del navegador.
 *
 * Módulo inactivo hasta conectar servicio y configurar permisos reales.
 */
export const FIREBASE_PROJECT='uki-panel-f4909';
export const ROMO_STORE_ID='romo:serena';
const allowedRoles=new Set(['duenos','agendador','inventario']);
const UID=/^[A-Za-z0-9_-]{1,128}$/;

/**
 * El correo es solo un filtro extra para los DUEÑOS, NO es por sí mismo
 * una autorización. Se exige: Google firmado + email verificado + UID
 * registrado y activo con rol 'duenos' en la base privada de Romo.
 *
 * El correo real no se almacena en el repositorio; lo configura la dueña
 * como secreto/variable protegida ROMO_DUENOS_GOOGLE_EMAIL en el servidor.
 */
export function ownerGoogleEmailMatchesVerifiedToken(claims,env={}){
  const expected=String(env.ROMO_DUENOS_GOOGLE_EMAIL||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expected)||
     expected.includes(',')||!claims||typeof claims!=='object')
    return false;
  const email=String(claims.email||'').trim().toLowerCase();
  return email===expected&&claims.email_verified===true&&
    claims.firebase?.sign_in_provider==='google.com'&&
    claims.iss==='https://securetoken.google.com/'+FIREBASE_PROJECT&&
    (claims.aud===FIREBASE_PROJECT||
      (Array.isArray(claims.aud)&&claims.aud.length===1&&claims.aud[0]===FIREBASE_PROJECT));
}

/** Usar únicamente en backend; la importación de jose no llega al cliente. */
export async function verifyFirebaseGoogleToken(token){
  if(typeof token!=='string'||token.length<30||token.length>12000)
    throw new Error('Token inválido');
  const {createRemoteJWKSet,jwtVerify}=await import('jose');
  const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
  const result=await jwtVerify(token,jwks,{
    issuer:'https://securetoken.google.com/'+FIREBASE_PROJECT,
    audience:FIREBASE_PROJECT,
    algorithms:['RS256']
  });
  return result.payload;
}

function bearer(value){
  if(typeof value!=='string')return null;
  const match=value.match(/^Bearer ([A-Za-z0-9_.-]{30,12000})$/);
  if(!match||match[1].startsWith('UKIDEV1.'))return null;
  return match[1];
}

function validClaims(p){
  if(!p||typeof p!=='object'||typeof p.sub!=='string'||!UID.test(p.sub))return false;
  if(p.iss!=='https://securetoken.google.com/'+FIREBASE_PROJECT)return false;
  const audValid=p.aud===FIREBASE_PROJECT||(Array.isArray(p.aud)&&p.aud.length===1&&p.aud[0]===FIREBASE_PROJECT);
  if(!audValid||p.firebase?.sign_in_provider!=='google.com'||p.email_verified!==true)return false;
  return true;
}

/**
 * verifyToken solo puede ser el verificador de firma del servidor.
 * Inyección para tests; en el endpoint pasar verifyFirebaseGoogleToken,
 * nunca un callback enviado por el cliente.
 */
export async function resolveRomoIdentity({authorization,db,verifyToken=verifyFirebaseGoogleToken,env={}}={}){
  const token=bearer(authorization);
  if(!token)return null;
  if(!db||typeof db.query!=='function')throw new Error('Base Romo requerida para permisos');
  if(typeof verifyToken!=='function')throw new Error('Verificación criptográfica requerida');
  let claims;
  try{claims=await verifyToken(token)}catch{return null}
  if(!validClaims(claims))return null;
  const rows=await db.query(
    'SELECT rol FROM public.romo_personal_acceso_v1 WHERE auth_uid=$1 AND store_id=$2 AND activo=true LIMIT 1',
    [claims.sub,ROMO_STORE_ID]
  );
  if(!Array.isArray(rows)||rows.length!==1||!allowedRoles.has(rows[0].rol))return null;
  if(rows[0].rol==='duenos'&&!ownerGoogleEmailMatchesVerifiedToken(claims,env))return null;
  return Object.freeze({
    userId:claims.sub,
    brand:'romo',
    role:rows[0].rol,
    branches:Object.freeze(['serena'])
  });
}
