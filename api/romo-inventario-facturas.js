'use strict';
const {config}=require('./romo-inventario-qa.js')._internalQA;
const fail=(r,s,e)=>r.status(s).json({ok:false,storeId:'romo:serena',error:e});
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private,no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const conf=config(process.env);
 if(!conf||process.env.ROMO_FACTURAS_INVENTARIO_ENABLED!=='true')return fail(res,503,'Recepción de facturas de Romo aún no habilitada');
 if(req.method!=='POST'||req.headers?.origin!==conf.origin)return fail(res,403,'Origen de Romo no autorizado');
 if(!String(req.headers?.['content-type']||'').startsWith('application/json'))return fail(res,415,'Se requiere JSON');
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>20000||!['factura-consultar','factura-historial','factura-preparar-articulos','factura-recibir'].includes(body.action))return fail(res,400,'Solicitud de factura inválida');
 if(!['factura-consultar','factura-historial'].includes(body.action)&&process.env.ROMO_INVENTARIO_ESCRITURA_QA_ENABLED!=='true')return fail(res,503,'Inventario solo lectura');
 try{
  const sql=require('@neondatabase/serverless').neon(conf.read),db={query:(q,p)=>sql.query(q,p)};
  const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({authorization:req.headers?.authorization,db,verifyToken:auth.verifyFirebaseGoogleToken});
  if(identity?.brand!=='romo'||identity.role!=='duenos')return fail(res,403,'Solo dueños de Romo');
  const {facturaRomo}=await import('../lib/romo-inventario-facturas.mjs');
  return res.status(200).json(await facturaRomo({db,identity,action:body.action,body}));
 }catch(e){if(e?.code==='REVISION_CONFLICTO')return fail(res,409,'Inventario cambió; actualiza antes de repetir');if([400,409].includes(e?.status))return fail(res,e.status,e.message);return fail(res,503,'No se confirmó la recepción. Consulta el folio antes de repetir.');}
};
