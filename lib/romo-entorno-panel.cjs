'use strict';

// La publicación no activa operaciones por sí sola. Se mantienen además
// las banderas de cada servicio, identidad, origen y aislamiento de la BD.
function entornoPanelRomoAutorizado(env={}){
 if(env.VERCEL_ENV==='preview')
  return env.VERCEL_GIT_COMMIT_REF==='preparacion/uki-romo-sobre-main-20261114';
 // La operación comercial de Romo nunca debe depender del proyecto
 // oficial Uki ni reutilizar su dominio. Requiere proyecto exclusivo,
 // dominio explícito y habilitación separada después de prueba manual.
 if(env.VERCEL_ENV!=='production'||
    // Un release de Romo separado: jamás usar main de Uki ni la rama QA.
    env.VERCEL_GIT_COMMIT_REF!=='release/romos-panel-v816'||
    env.ROMO_PANEL_PRODUCTION_ENABLED!=='true'||
    env.ROMO_PANEL_ISOLATED_PROJECT!=='romos-sushi-panel')
   return false;
 let own;
 try{own=new URL(String(env.ROMO_PANEL_ALLOWED_ORIGIN||''));}
 catch{return false;}
 if(own.protocol!=='https:'||own.username||own.password||
    own.pathname!=='/'||own.search||own.hash||own.port)
   return false;
 const host=own.hostname.toLowerCase();
 return /^(?:romo|romos)-[a-z0-9-]+(?:\.vercel\.app|\.[a-z0-9.-]+)$/.test(host)&&
    !host.includes('uki-sushi')&&!host.includes('inventario');
}
module.exports={entornoPanelRomoAutorizado};
