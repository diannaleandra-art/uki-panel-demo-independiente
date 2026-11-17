'use strict';
/**
 * Vercel GET from same-origin Safari often has no Origin header.
 * An absent Origin is permitted ONLY for GET when the request Host
 * exactly matches the configured authorized origin. All writes require
 * the explicit configured Origin. JWT and Romo roles remain mandatory.
 */
function esOrigenAutorizadoRomoQA(req,expected){
 if(typeof expected!=='string'||!/^https:\/\/[^\/\s?#@]+$/.test(expected))return false;
 const origin=req?.headers?.origin;
 if(typeof origin==='string'&&origin.length>0)return origin===expected;
 if(req?.method!=='GET')return false;
 const host=String(req?.headers?.host||'').trim().toLowerCase();
 if(!host||host.includes('@')||host.includes('/')||host.includes(','))return false;
 try{return host===new URL(expected).host.toLowerCase()}catch{return false}
}

/**
 * Un único panel visual en Preview de Uki puede CONSULTAR Romo en la
 * API del proyecto Romo, sin copiar ni compartir sus bases. El segundo
 * origen es exacto, configurable y NUNCA recibe permisos de escritura.
 * No se habilita en producción ni en el proyecto Uki.
 */
function origenUnificadoLecturaRomoQA(env={}){
 if(env.VERCEL_ENV!=='preview'||
    env.VERCEL_GIT_COMMIT_REF!=='qa/romos-panel-v816'||
    env.ROMO_PANEL_ISOLATED_PROJECT!=='romos-sushi-panel')return null;
 const candidate=String(env.ROMO_PANEL_UNIFICADO_LECTURA_ORIGIN||'');
 if(!/^https:\/\/uki-sushi-inventario-git-qa-romos-panel-v816-[a-z0-9-]+\.vercel\.app$/.test(candidate))
  return null;
 return candidate;
}
function resolverOrigenLecturaUnificadaRomoQA(req,principal,unificado=null){
 if(esOrigenAutorizadoRomoQA(req,principal))
  return Object.freeze({origin:principal,compartido:false});
 const method=String(req?.method||'').toUpperCase();
 const origin=String(req?.headers?.origin||'');
 if(!unificado||origin!==unificado)return null;
 // OPTIONS sólo puede solicitar el método GET. POST/PATCH y sus preflights
 // siguen rechazados, incluso con banderas de escritura de Romo activadas.
 if(method==='GET'||(method==='OPTIONS'&&
  String(req?.headers?.['access-control-request-method']||'').toUpperCase()==='GET'))
  return Object.freeze({origin:unificado,compartido:true});
 return null;
}

module.exports={esOrigenAutorizadoRomoQA,origenUnificadoLecturaRomoQA,resolverOrigenLecturaUnificadaRomoQA};
