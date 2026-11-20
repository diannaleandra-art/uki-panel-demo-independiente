'use strict';
/**
 * Preflight PUBLICO de estado minimo del cierre Romo en el Preview QA.
 * Solo responde SI/NO, sin exponer URL, usuario, hostname, token ni snapshot.
 * Nunca consulta datos comerciales ni escribe Neon. La confirmacion real
 * permanece en POST /api/romo-cierre-definitivo-qa con Google, dueño y CAS.
 */
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
const {config:configCierre}=require('./romo-cierre-definitivo-qa.js')._internalQA;
function condiciones(env,host){
 if(env?.VERCEL_ENV!=='preview'||
    env?.VERCEL_GIT_COMMIT_REF!=='qa/romos-panel-v816'||
    env?.ROMO_PANEL_ISOLATED_PROJECT!=='romos-sushi-panel'||
    !entornoPanelRomoAutorizado(env))return null;
 let origin;
 try{origin=new URL(String(env.ROMO_PANEL_ALLOWED_ORIGIN||''));}
 catch{return null;}
 if(origin.protocol!=='https:'||
    String(host||'').trim().toLowerCase()!==origin.host.toLowerCase())
  return null;
 const configuracionSegura=Boolean(configCierre({...env,ROMO_CIERRE_QA_ENABLED:'true'}));
 const habilitado=env.ROMO_CIERRE_QA_ENABLED==='true';
 return Object.freeze({
  ok:true,storeId:'romo:serena',
  configuracionSegura,habilitado,
  disponible:configuracionSegura&&habilitado,
  modo:'solo_comprobacion'
 });
}
module.exports=async function prepararCierreRomoQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Host');
 if(req.method!=='GET')
  return res.status(405).json({ok:false,error:'Solo consulta GET'});
 const result=condiciones(process.env,req.headers?.host);
 if(!result)return res.status(404).json({ok:false,error:'Comprobacion no disponible'});
 return res.status(200).json(result);
};
module.exports._internalQA={condiciones};
