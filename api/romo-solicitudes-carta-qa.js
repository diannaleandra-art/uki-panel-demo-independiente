'use strict';
/**
 * API única Romo para solicitudes iniciadas por WhatsApp y bandeja del MISMO
 * panel Uki. Esta ruta no crea venta, pago, timbre ni cierre.
 * Apagada hasta habilitación comercial expresa, SQL y autorización de roles.
 */
const fail=(res,code,error)=>res.status(code).json({ok:false,error});
module.exports=async function romoSolicitudesCartaQA(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const env=process.env,origin=String(req.headers?.origin||'');
 const publicOrigin=String(env.ROMO_CARTA_ALLOWED_ORIGIN||'');
 const staffOrigin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(env.VERCEL_ENV!=='production'||
    env.ROMO_CARTA_SOLICITUDES_LIVE_ENABLED!=='true')
  return fail(res,503,'La bandeja de Romo aún no está habilitada');
 const staff=req.method==='GET'||req.method==='PATCH'||req.method==='OPTIONS'&&
   ['GET','PATCH'].includes(String(req.headers?.['access-control-request-method']||'').toUpperCase());
 const expected=staff?staffOrigin:publicOrigin;
 if(!/^https:\/\/[^\/\s?#@]+$/.test(expected)||origin!==expected)
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',expected);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods',staff?'GET,PATCH,OPTIONS':'POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST','PATCH'].includes(req.method))return fail(res,405,'Método no permitido');
 if(req.method==='PATCH'&&env.ROMO_CARTA_SOLICITUDES_EDIT_LIVE_ENABLED!=='true')
  return fail(res,503,'Rechazos de Romo aún deshabilitados');
 if(req.method==='POST'||req.method==='PATCH'){
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
   return fail(res,415,'Se espera JSON');
  if(Number(req.headers?.['content-length']||0)>16000)
   return fail(res,413,'Solicitud Romo demasiado grande');
 }
 let mod,auth,reading,config,db;
 try{
  mod=await import('../lib/romo-solicitudes-carta-qa.mjs');
  reading=await import('../lib/romo-claves-lectura-servidor-qa.mjs');
  config=reading.romoPrivateReadConfig(env);
  if(!config||config.storeId!=='romo:serena')throw Error('Sin base Romo');
  const sql=require('@neondatabase/serverless').neon(config.url);
  if(typeof sql.query!=='function')throw Error('Neon Romo no disponible');
  db=Object.freeze({query:(statement,params)=>sql.query(statement,params)});
 }catch{return fail(res,503,'Base exclusiva de Romo no configurada')}
 try{
  if(req.method==='POST'){
   const salt=env.ROMO_SOLICITUDES_RATE_SALT;
   const ip=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
   let outcome;
   try{outcome=await mod.ingresarSolicitudRomoQA({db,request:req.body,ip,salt})}
   catch(e){
    if(e?.code==='ROMO_ORDER_DUPLICATE')return fail(res,409,'Código utilizado para otro pedido');
    if(e?.code==='ROMO_ORDER_RATE')return fail(res,429,'Demasiadas solicitudes; envía tu pedido por WhatsApp');
    if(/pedido|sucursal|formulario|solicitud|antispam|revisa/i.test(String(e?.message||'')))
     return fail(res,400,'Datos de la solicitud de Romo inválidos');
    throw e;
   }
   return res.status(outcome.repetido?200:201).json({ok:true,...outcome});
  }
  auth=await import('../lib/romo-identidad-servidor-qa.mjs');
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,
   verifyToken:auth.verifyFirebaseGoogleToken,env
  });
  if(!identity)return fail(res,403,'Cuenta Google sin acceso a la bandeja Romo');
  if(req.method==='PATCH'){
   const body=req.body;
   if(!body||typeof body!=='object'||Array.isArray(body)||
      body.storeId!=='romo:serena')
    return fail(res,400,'Solo solicitudes de Romo La Serena');
   // Solo aceptar con un comprobante FIRMADO por el servidor tras
   // guardar una revisión cifrada, nunca solo con un pedidoId del navegador.
   if(body.estado==='aceptada'){
    if(env.ROMO_CARTA_ACEPTACION_LIVE_ENABLED!=='true'||
       env.ROMO_COMPROBANTE_GUARDADO_LIVE_ENABLED!=='true'||
       typeof env.ROMO_COMPROBANTE_SECRET!=='string'||
       env.ROMO_COMPROBANTE_SECRET.length<32)
     return fail(res,503,'La aceptación de Romo aún no está habilitada');
    if(Object.keys(body).sort().join('|')!=='claimToken|comprobante|estado|id|pedidoId|storeId')
     return fail(res,400,'Faltan datos de reserva y comprobante');
    try{
     const proof=await import('../lib/romo-comprobante-guardado-qa.mjs');
     const answer=await proof.aceptarConComprobanteRomoQA({
      db,identity,requestId:body.id,claimToken:body.claimToken,
      pedidoId:body.pedidoId,comprobante:body.comprobante,
      secret:env.ROMO_COMPROBANTE_SECRET
     });
     return res.status(200).json({ok:true,...answer});
    }catch(error){
     if(error?.code==='ROMO_ACEPTACION_CONFLICT')
      return fail(res,409,'Solicitud atendida por otro teléfono');
     if(/inválido|no corresponde|no reconocido|sin firma|no legible|Falta comprobante/i.test(String(error?.message||'')))
      return fail(res,400,'Comprobante Romo inválido');
     if(/Identidad|permiso|pertenece|rol/i.test(String(error?.message||'')))
      return fail(res,403,'Sin permiso para aceptar en Romo');
     return fail(res,409,'No se comprobó el pedido guardado; solicitud sigue pendiente');
    }
   }
   const keys=Object.keys(body).sort().join('|');
   if(body.estado==='rechazada'){
    if(keys!=='estado|id|motivo|storeId')
     return fail(res,400,'Motivo de rechazo obligatorio');
   }else if(['reservar','liberar'].includes(body.estado)){
    if(keys!=='claimToken|estado|id|storeId')
     return fail(res,400,'Reserva de Romo incompleta');
   }else return fail(res,400,'Acción no permitida');
   try{
    const result=body.estado==='rechazada'?
     await mod.rechazarSolicitudRomoQA({db,identity,id:body.id,motivo:body.motivo}):
     await (await import('../lib/romo-reservas-carta-qa.mjs'))[
      body.estado==='reservar'?'reservarSolicitudRomoQA':'liberarSolicitudRomoQA'
     ]({db,identity,id:body.id,claimToken:body.claimToken});
    return res.status(200).json({ok:true,...result});
   }catch(error){
    if(error?.code==='ROMO_RESERVA_CONFLICT')return fail(res,409,'Solicitud reservada en otro teléfono');
    if(error?.code==='ROMO_DECISION_CONFLICT')return fail(res,409,'Solicitud procesada desde otro equipo');
    if(/motivo|identificador|inválid/i.test(String(error?.message||'')))
     return fail(res,400,'Identificador y motivo obligatorios');
    if(/permiso|identidad|sucursal|Romo/i.test(String(error?.message||'')))
     return fail(res,403,'Sin permiso para rechazar esta solicitud');
    throw error;
   }
  }
  const items=await mod.leerSolicitudesRomoQA({db,identity});
  return res.status(200).json({ok:true,...items});
 }catch{return fail(res,503,'No se pudo completar la consulta de Romo')}
};
