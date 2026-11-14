
'use strict';
/* API inventario Romo: solo Google + rol en la DB separada; apagada por defecto.
 * El modo QA requiere su bandera propia y la rama y entorno exactos.
 */
function inventarioModoRomo(env={}){
 const branch='qa/integracion-panel-unico-romo-serena-20261112';
 if(env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF===branch&&
    env.ROMO_FIN_SYNC_QA_BRANCH===branch&&
    env.ROMO_OPERATIVO_QA_ENABLED==='true'&&
    env.ROMO_INVENTARIO_QA_ENABLED==='true')return 'qa';
 if(env.VERCEL_ENV==='production'&&
    env.ROMO_OPERATIVO_LIVE_ENABLED==='true'&&
    env.ROMO_INVENTARIO_LIVE_ENABLED==='true')return 'production';
 return null;
}
const fail=(r,n,e)=>r.status(n).json({ok:false,error:e});
module.exports=async function romoInventarioQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const env=process.env;
 const mode=inventarioModoRomo(env);
 if(!mode)return fail(res,503,'Inventario Romo todavía no autorizado');
 const origin=String(req.headers?.origin||'');
 const allowed=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(!/^https:\/\/[^\/\s?#@]+$/.test(allowed)||origin!==allowed)
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',allowed);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido');
 if(req.method==='POST'&&
   !String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
  return fail(res,415,'Se requiere JSON');
 const len=Number(req.headers?.['content-length']||0);
 if(!Number.isFinite(len)||len>15000)return fail(res,413,'Formulario excede límite');
 let core,identityModule,db;
 try{
  core=await import('../lib/romo-inventario-qa.mjs');
  const cfg=(await import('../lib/romo-estado-operativo-qa.mjs')).romoOperativoConfig(env);
  if(!cfg||cfg.qaOnly!==(mode==='qa'))throw Error('Romo no configurado para este entorno');
  db=require('@neondatabase/serverless').neon(cfg.url);
  identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
 }catch{return fail(res,503,'Base privada de Romo no disponible')}
 let identity;
 try{identity=await identityModule.resolveRomoIdentity({
  authorization:req.headers?.authorization,db,env,
  verifyToken:identityModule.verifyFirebaseGoogleToken
 })}catch{return fail(res,503,'No se comprobó Google')}
 if(!identity)return fail(res,403,'Google sin permiso Romo');
 if(req.method==='GET'){
  try{
   // Solo QA y dueños pueden consultar diferencias de ingredientes con la carta.
   // No se usa en producción ni se altera disponibilidad o precios.
   if(req.query?.diagnostico==='carta'){
    if(mode!=='qa')return fail(res,403,'Conciliación exclusiva de pruebas');
    const comparison=await (await import('../lib/romo-inventario-carta-qa.mjs'))
     .consultarConciliacionInventarioCartaRomoQA({db,identity});
    return res.status(200).json({ok:true,...comparison});
   }
   if(req.query?.diagnostico!==undefined)
    return fail(res,400,'Consulta de inventario no válida');
   const state=await core.readInventarioRomoQA({db,identity});
   return res.status(200).json({ok:true,...state});
  }catch(error){
   if(/permiso|identidad|rol/i.test(String(error?.message||'')))
    return fail(res,403,'Sin permiso');
   return fail(res,503,'No se pudo consultar inventario Romo');
  }
 }
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).sort().join('|')!=='action|args|expectedRevision')
  return fail(res,400,'Formulario no válido');
 try{
  const result=await core.guardarOperacionInventarioRomoQA({
   db,identity,expectedRevision:body.expectedRevision,
   action:body.action,args:body.args
  });
  return res.status(200).json({ok:true,...result});
 }catch(error){
  if(error?.code==='REVISION_CONFLICTO')
   return fail(res,409,'Otro equipo modificó inventario; actualiza');
  if(/permiso|identidad|rol/i.test(String(error?.message||'')))
   return fail(res,403,'Sin permiso');
  if(/inválid|obligatori|existe|archivado|límite|grande|cambios|cantidad|SKU|artículo|Nombre|Entrada/i.test(String(error?.message||'')))
   return fail(res,400,'Datos de inventario no válidos');
  return fail(res,503,'No se confirmó el movimiento de inventario');
 }
};

module.exports._testing={inventarioModoRomo};
