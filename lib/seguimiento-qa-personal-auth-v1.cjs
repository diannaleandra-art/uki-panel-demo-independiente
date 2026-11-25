'use strict';
/* Autorización real por local. La URL de la bandeja NO da permisos. */
function values(env,name){
 return new Set(String(env[name]||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
}
function inAllowList(payload,env,uidKey,emailKey){
 const id=String(payload.sub||'').toLowerCase();
 const email=String(payload.email||'').toLowerCase();
 return values(env,uidKey).has(id)||
  (payload.email_verified===true&&values(env,emailKey).has(email));
}
async function ukiStaff(req,storeId,env=process.env){
 const branch=storeId==='uki:arica'?'ARICA':storeId==='uki:serena'?'SERENA':null;
 if(!branch)return null;
 const bearer=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]{20,2500})$/)?.[1];
 if(!bearer||bearer.startsWith('UKIDEV1.'))return null;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const result=await jwtVerify(bearer,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',audience:'uki-panel-f4909',algorithms:['RS256']});
 const p=result.payload;
 if(p.firebase?.sign_in_provider!=='google.com'||typeof p.sub!=='string')return null;
 const admin=inAllowList(p,env,'UKI_MESAS_LIVE_ALLOWED_UIDS','UKI_MESAS_LIVE_ALLOWED_EMAILS');
 const staff=inAllowList(p,env,'UKI_MESAS_LIVE_STAFF_UIDS_'+branch,'UKI_MESAS_LIVE_STAFF_EMAILS_'+branch);
 return admin||staff?{storeId,userId:p.sub,role:admin?'duenos':'agendador'}:null;
}
async function authorized(req,db,storeId,env=process.env){
 if(storeId.startsWith('uki:'))return ukiStaff(req,storeId,env);
 if(storeId!=='romo:serena')return null;
 const identity=await import('./romo-identidad-servidor-qa.mjs');
 const person=await identity.resolveRomoIdentity({
  authorization:req.headers?.authorization,db,
  verifyToken:identity.verifyFirebaseGoogleToken
 });
 return person&&['duenos','agendador'].includes(person.role)&&person.userId?
  {storeId,userId:person.userId,role:person.role}:null;
}
// Permiso excepcional para la misma dueña ya identificada en Romo.
// Sólo permite revisar los dos pedidos ficticios Uki; nunca caja ni producción.
async function authorizedRevisionOwner(req,storeId,env=process.env){
 if(!['uki:arica','uki:serena'].includes(storeId)||
    env.VERCEL_ENV!=='preview'||
    env.VERCEL_GIT_COMMIT_REF!=='preparacion/enlaces-seguros-3-sucursales-20261124'||
    env.SEGUIMIENTO_QA_AISLAMIENTO_VERIFICADO!=='true'||
    env.SEGUIMIENTO_PERSONAL_QA_ENABLED!=='true'||
    req.query?.revision!=='1'||
    String(req.headers?.host||'').toLowerCase()!=='romos-sushi-panel-git-preparacion-enl-341d68-diannaleandra-7046.vercel.app')
  return null;
 const uid=String(env.SEGUIMIENTO_REVISION_UKI_OWNER_UID||'').trim();
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))return null;
 const token=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]{30,12000})$/)?.[1];
 if(!token||token.startsWith('UKIDEV1.'))return null;
 const identity=await import('./romo-identidad-servidor-qa.mjs');
 const p=await identity.verifyFirebaseGoogleToken(token);
 if(p.sub!==uid||p.email_verified!==true||p.firebase?.sign_in_provider!=='google.com')return null;
 return Object.freeze({storeId,userId:p.sub,role:'duenos',revisionOnly:true});
}
module.exports={authorized,ukiStaff,authorizedRevisionOwner};
