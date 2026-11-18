'use strict';
/**
 * Identidad OIDC temporal, exclusivamente entre Previews Romo.
 * Los proyectos destinatarios deben aprobar explícitamente el origen
 * en Trusted Sources. No copiar ni registrar el token, nunca prod.
 */
function headersOIDCRomoQA(env={}){
 if(env.VERCEL_ENV!=='preview'||
    env.VERCEL_GIT_COMMIT_REF!=='qa/romos-panel-v816'||
    env.ROMO_PANEL_ISOLATED_PROJECT!=='romos-sushi-panel')return {};
 const jwt=String(env.VERCEL_OIDC_TOKEN||'');
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))return {};
 return {'x-vercel-trusted-oidc-idp-token':jwt};
}
module.exports={headersOIDCRomoQA};
