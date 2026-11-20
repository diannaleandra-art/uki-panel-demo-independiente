'use strict';
const {entornoPanelRomoAutorizado}=require('./romo-entorno-panel.cjs');

// QA sigue sin cambios. Producción tiene dos compuertas ADICIONALES:
// release exclusivo + activación global + autorización administrativa separada.
// No añade acceso público ni quita autenticación Google/dueños en los endpoints.
function entornoGestionRomoAutorizado(env={}){
 if(!entornoPanelRomoAutorizado(env))return false;
 if(env.VERCEL_ENV==='preview'&&
    env.VERCEL_GIT_COMMIT_REF==='qa/romos-panel-v816')return true;
 return env.VERCEL_ENV==='production'&&
  env.VERCEL_GIT_COMMIT_REF==='release/romos-panel-v816'&&
  env.ROMO_PANEL_PRODUCTION_ENABLED==='true'&&
  env.ROMO_ADMIN_PRODUCTION_ENABLED==='true';
}
function escrituraGestionRomoAutorizada(env={}){
 if(!entornoGestionRomoAutorizado(env))return false;
 return env.VERCEL_ENV==='preview'?
  env.ROMO_CARTA_ADMIN_ESCRITURA_QA_ENABLED==='true':
  env.ROMO_ADMIN_PRODUCTION_WRITE_ENABLED==='true';
}
module.exports={entornoGestionRomoAutorizado,escrituraGestionRomoAutorizada};
