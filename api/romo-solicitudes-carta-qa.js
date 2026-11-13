'use strict';
// Mismo panel Uki: entrada Romo a la bandeja independiente; CERRADA por defecto.
// No activa ventas ni modifica sucursales Uki.
const {createHash}=require('node:crypto');
const fail=(res,code,message)=>res.status(code).json({ok:false,error:message});
module.exports=async function romoSolicitudesCartaQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 let core;
 try{core=await import('../lib/romo-solicitudes-carta-qa.mjs')}
 catch{return fail(res,503,'Bandeja Romo no preparada')}
 const config=core.romoSolicitudesConfig(process.env);
 if(!config)return fail(res,503,'Recepción Romo todavía no activada');
 const method=String(req.method||''),origin=String(req.headers?.origin||'');
 if(!['GET','POST','PATCH','OPTIONS'].includes(method))return fail(res,405,'Método no permitido');
 const allowed=method==='POST'?config.cartaOrigin:method==='OPTIONS'?
  [config.cartaOrigin,config.panelOrigin].includes(origin):origin===config.panelOrigin;
 if(!allowed||!origin)return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
 if(method==='OPTIONS')return res.status(204).end();
 if((method==='POST'||method==='PATCH')&&
   !String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
  return fail(res,415,'Se requiere JSON');
 const size=Number(req.headers?.['content-length']||0);
 if(!Number.isFinite(size)||size<0||size>2750000)return fail(res,413,'Solicitud demasiado grande');
 let db;
 try{db=require('@neondatabase/serverless').neon(config.url)}
 catch{return fail(res,503,'Base independiente Romo no disponible')}
 try{
  if(method==='POST'){
   const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].slice(0,80);
   const ipHash=createHash('sha256').update('romo-carta:'+config.rateSalt+':'+ip).digest('hex');
   const result=await core.registrarSolicitudRomo({db,body:req.body,ipHash});
   return res.status(result.repetido?200:201).json(result);
  }
  let auth;
  try{auth=await import('../lib/romo-identidad-servidor-qa.mjs')}
  catch{return fail(res,503,'Acceso de personal no disponible')}
  const identity=await auth.resolveRomoIdentity({
   authorization:req.headers?.authorization,db,verifyToken:auth.verifyFirebaseGoogleToken,
   env:process.env
  });
  if(!identity)return fail(res,403,'Personal Romo no autorizado');
  if(method==='GET'){
   const result=await core.listarSolicitudesRomo({db,identity});
   return res.status(200).json(result);
  }
  const body=req.body,action=body?.estado;
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof action!=='string')
   return fail(res,400,'Acción inválida');
  const allowedFields=action==='aceptada'?
   ['claimToken','estado','expectedRevision','id','pedidoId','snapshot']:
   action==='rechazada'?['estado','id','motivo']:
   action==='reservar'||action==='liberar'?['claimToken','estado','id']:[];
  if(!allowedFields.length||Object.keys(body).sort().join('|')!==allowedFields.sort().join('|'))
   return fail(res,400,'Acción no permitida');
  const args={db,identity,...body};
  const result=action==='reservar'?await core.reservarSolicitudRomo(args):
   action==='liberar'?await core.liberarSolicitudRomo(args):
   action==='rechazada'?await core.rechazarSolicitudRomo(args):
   await core.aceptarYGuardarSolicitudRomo(args);
  return res.status(200).json(result);
 }catch(error){
  const status=[400,403,409,429,503].includes(error?.status)?error.status:503;
  return fail(res,status,status===503?'No se pudo confirmar la solicitud; no repitas sin revisar':String(error.message).slice(0,220));
 }
};
