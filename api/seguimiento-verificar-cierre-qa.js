'use strict';
/* Verificación SOLO LECTURA de transferencia en rama QA. NO cierra pedidos. */
const ENV=require('../lib/seguimiento-qa-entorno-v1.cjs');
const AUTH=require('../lib/seguimiento-qa-personal-auth-v1.cjs');
const GUARD=require('../lib/seguimiento-verificar-cierre-qa.cjs');
const {TABLES}=require('../lib/seguimiento-qa-servidor-v1.cjs');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond=(res,code,payload)=>res.status(code).json({ok:code<400,...payload});
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=ENV.config();
 if(!cfg||process.env.SEGUIMIENTO_PERSONAL_QA_ENABLED!=='true')
  return respond(res,503,{permitido:false,error:'Verificación sólo disponible en QA'});
 if(!ENV.validOrigin(req,cfg))return respond(res,403,{permitido:false,error:'Origen no autorizado'});
 if(req.method!=='GET')return respond(res,405,{permitido:false,error:'Método no permitido'});
 const storeId=req.query?.storeId,orderId=req.query?.id;
 const transferFlag=req.query?.requiereTransferencia;
 if(transferFlag!==undefined&&!['0','1'].includes(transferFlag))
  return respond(res,400,{permitido:false,error:'Verificación de pago inválida'});
 if(typeof storeId!=='string'||!TABLES[storeId]||typeof orderId!=='string'||!UUID.test(orderId))
  return respond(res,400,{permitido:false,error:'Pedido y sucursal inválidos'});
 try{
  const db=ENV.makeDb(cfg,storeId);
  const actor=await AUTH.authorized(req,db,storeId).catch(()=>null);
  if(!actor)return respond(res,403,{permitido:false,error:'Personal sin permiso para esta sucursal'});
  const result=await GUARD.check({db,storeId,orderId,requiereTransferencia:transferFlag==='1'});
  return respond(res,200,{storeId,orderId,permitido:result.permitido,razon:result.razon,
   soloVerificacionQA:true,noRegistraPago:true,noCierraPedido:true});
 }catch(error){
  console.error('Guardia de cierre QA:',String(error?.code||error?.name||'error').slice(0,50));
  return respond(res,503,{permitido:false,error:'No se pudo verificar el abono. No cierres el pedido.'});
 }
};
