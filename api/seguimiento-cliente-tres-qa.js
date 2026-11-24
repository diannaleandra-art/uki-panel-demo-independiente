'use strict';
/* Interfaz QA de cliente: token privado en cabecera, NO en query ni cookies. */
const ENV=require('../lib/seguimiento-qa-entorno-v1.cjs');
const LINKS=require('../lib/seguimiento-enlaces-seguros-v1.cjs');
const S=require('../lib/seguimiento-qa-servidor-v1.cjs');
function done(res,status,body){return res.status(status).json({ok:status<400,...body});}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=ENV.config();
 if(!cfg)return done(res,503,{error:'Seguimiento todavía no habilitado'});
 if(!ENV.validOrigin(req,cfg))return done(res,403,{error:'Sitio de pruebas no autorizado'});
 if(!['GET','POST'].includes(req.method))return done(res,405,{error:'Acción no permitida'});
 const raw=String(req.headers?.['x-seguimiento-pedido']||'');
 const verified=LINKS.verifyLink(raw,cfg.tokenSecret);
 if(!verified)return done(res,403,{error:'Enlace inválido o vencido'});
 if(req.method==='POST'&&(
  !String(req.headers['content-type']||'').startsWith('application/json')||
  !req.body||typeof req.body!=='object'||Array.isArray(req.body)||
  JSON.stringify(req.body).length>1100||
  !['avisar_transferencia','enviar_mensaje'].includes(req.body.action)))
  return done(res,400,{error:'Acción inválida'});
 try{
  const db=ENV.makeDb(cfg,verified.storeId);
  if(!db)return done(res,503,{error:'Sucursal no disponible'});
  const {order}=await S.verifyCustomer({db,token:raw,secret:cfg.tokenSecret});
  if(req.method==='POST'){
   if(req.body.action==='avisar_transferencia'){
    if(Object.keys(req.body).length!==1)return done(res,400,{error:'Aviso inválido'});
    await S.clientNotice({db,order,bank:cfg.banks[order.storeId]});
   }else{
    if(Object.keys(req.body).sort().join('|')!=='action|texto')
     return done(res,400,{error:'Mensaje inválido'});
    await S.sendMessage({db,order,from:'cliente',body:req.body.texto,chatSecret:cfg.chatSecret});
   }
  }
  const result=await S.snapshot({db,order,bank:cfg.banks[order.storeId],chatSecret:cfg.chatSecret});
  return done(res,200,result);
 }catch(error){
  const status=[400,403,404,409,429].includes(error?.code)?error.code:503;
  return done(res,status,{error:status===503?'No se actualizó el seguimiento. Revisa antes de repetir.':
   String(error.message||'Pedido no disponible').slice(0,180)});
 }
};
