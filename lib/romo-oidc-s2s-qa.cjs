'use strict';
/**
 * Identidad OIDC temporal, exclusivamente entre Previews Romo.
 * Los proyectos destinatarios deben aprobar explícitamente el origen
 * en Trusted Sources. No copiar ni registrar el token, nunca prod.
 */
async function headersOIDCRomoQA(env={}){
 if(env.VERCEL_ENV!=='preview'||
    env.VERCEL_GIT_COMMIT_REF!=='qa/romos-panel-v816'||
    env.ROMO_PANEL_ISOLATED_PROJECT!=='romos-sushi-panel')return {};
 let jwt='';
 // La librería oficial lee el OIDC desde el contexto de la petición.
 // Jamás registrar ni conservar tokens; no está disponible en producción.
 try{
  const mod=await import('@vercel/oidc');
  if(typeof mod.getVercelOidcToken==='function')
   jwt=String(await mod.getVercelOidcToken()||'');
 }catch{}
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
  jwt=String(env.VERCEL_OIDC_TOKEN||'');
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))return {};
 return {'x-vercel-trusted-oidc-idp-token':jwt};
}
module.exports={headersOIDCRomoQA};
