'use strict';

// La publicación no activa operaciones por sí sola. Se mantienen además
// las banderas de cada servicio, identidad, origen y aislamiento de la BD.
function entornoPanelRomoAutorizado(env={}){
 if(env.VERCEL_ENV==='preview')
  return env.VERCEL_GIT_COMMIT_REF==='preparacion/uki-romo-sobre-main-20261114';
 return env.VERCEL_ENV==='production'&&
  env.VERCEL_GIT_COMMIT_REF==='main'&&
  env.ROMO_PANEL_PRODUCTION_ENABLED==='true'&&
  env.ROMO_PANEL_ALLOWED_ORIGIN==='https://uki-sushi-inventario.vercel.app';
}
module.exports={entornoPanelRomoAutorizado};
