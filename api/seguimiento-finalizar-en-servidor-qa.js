'use strict';
/* REGISTRO QA en servidor, separado de snapshots y de caja comercial. */
const ENV=require('../lib/seguimiento-qa-entorno-v1.cjs');
const AUTH=require('../lib/seguimiento-qa-personal-auth-v1.cjs');
const TX=require('../lib/seguimiento-finalizacion-atomica-qa.cjs');
const fail=(r,c,m)=>r.status(c).json({ok:false,error:m});
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=ENV.config();
 if(!cfg||cfg.live||process.env.VERCEL_ENV!=='preview'||process.env.SEGUIMIENTO_CIERRE_ATOMICO_QA_ENABLED!=='true')
  return fail(res,503,'Finalización protegida sólo disponible en pruebas');
 if(!ENV.validOrigin(req,cfg))return fail(res,403,'Origen no autorizado');
 if(req.method!=='POST')return fail(res,405,'Método no permitido');
 if(!String(req.headers?.['content-type']||'').startsWith('application/json')||
  !req.body||typeof req.body!=='object'||Array.isArray(req.body)||
  JSON.stringify(req.body).length>2000000||
  !['action|id|restoPagoVerificado|storeId','action|expectedRevision|id|montoTransferencia|pedidoInterno|restoPagoVerificado|snapshot|storeId|total'].includes(Object.keys(req.body).sort().join('|')))
  return fail(res,400,'Datos del pedido inválidos');
 const {storeId,id,action,restoPagoVerificado}=req.body;
 const conjunto=Object.hasOwn(req.body,'snapshot');
 if(conjunto&&(storeId!=='romo:serena'||process.env.SEGUIMIENTO_ROMO_GUARDADO_CONJUNTO_QA_ENABLED!=='true'))
  return fail(res,503,'Guardado conjunto Romo aún no habilitado en QA');
 if(!TX.LEDGERS[storeId]||typeof id!=='string'||
  !['confirmar_cobro','entregar'].includes(action)||
  restoPagoVerificado!==true)
  return fail(res,400,'Falta la comprobación del pedido');
 try{
  const db=ENV.makeDb(cfg,storeId);
  const staff=await AUTH.authorized(req,db,storeId).catch(()=>null);
  if(!staff)return fail(res,403,'Personal sin permiso en esta sucursal');
  const result=conjunto?await require('../lib/seguimiento-romo-guardado-conjunto-qa.cjs').save({
   db,staff,orderId:id,action,expectedRevision:req.body.expectedRevision,snapshot:req.body.snapshot,
   pedidoInterno:req.body.pedidoInterno,total:req.body.total,montoTransferencia:req.body.montoTransferencia,restoPagoVerificado:true
  }):await TX.commit({db,storeId,orderId:id,action,staff,restoPagoVerificado:true});
  return res.status(200).json(result);
 }catch(error){
  const code=[400,403,409].includes(error?.status)?error.status:503;
  return fail(res,code,code===503?'No se confirmó el guardado. Actualiza antes de repetir.':
   String(error.message||'No disponible').slice(0,160));
 }
};
