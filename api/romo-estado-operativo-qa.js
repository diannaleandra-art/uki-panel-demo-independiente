'use strict';
/**
 * MISMO PANEL / Romo La Serena: API privada del estado TOTAL cifrado.
 *
 * Bloqueado por defecto. No se publicará ni operará hasta completar
 * permisos Google, contraseña existente, pruebas y autorización expresa.
 * El API jamás recibe contraseñas, clientes o pedidos en texto abierto.
 */
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
module.exports=async function romoEstadoOperativoQA(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const env=process.env;
 const requestedArea=req.query?.area;
 const area=requestedArea===undefined?'operativo':requestedArea;
 if(typeof area!=='string'||!['operativo','catalog','inventory'].includes(area)||
    (req.query&&Object.keys(req.query).some(key=>key!=='area')))
  return fail(res,400,'Área de Romo no reconocida');
 // Lectura segura independiente de las ventas: requiere un interruptor propio.
 // Nunca permite POST, ni siquiera con el lector de catálogo autorizado.
 const readonlyArea=area==='catalog'||area==='inventory';
 const readonlyRequest=readonlyArea&&['GET','OPTIONS'].includes(req.method)&&
    env.ROMO_PANEL_LECTURA_SOLA_ENABLED==='true';
 const normalOperation=env.ROMO_OPERATIVO_LIVE_ENABLED==='true'&&
    (area==='operativo'||env.ROMO_PANEL_AREAS_LIVE_ENABLED==='true');
 if(env.VERCEL_ENV!=='production'||(!readonlyRequest&&!normalOperation))
  return fail(res,503,'Esta sección de Romo todavía no está habilitada');
 if(readonlyArea&&req.method==='POST'&&
    env.ROMO_PANEL_AREAS_WRITE_LIVE_ENABLED!=='true')
  return fail(res,503,'Edición de Romo aún no habilitada');
 const actualOrigin=String(req.headers?.origin||'');
 const expectedOrigin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 if(!/^https:\/\/[^\/\s?#@]+$/.test(expectedOrigin)||
    actualOrigin!==expectedOrigin)
  return fail(res,403,'Origen no autorizado');
 res.setHeader('Access-Control-Allow-Origin',expectedOrigin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods',readonlyRequest&&!normalOperation?'GET,OPTIONS':'GET,POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido');
 if(req.method==='POST'&&
    !String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
  return fail(res,415,'Se requiere JSON cifrado');
 const size=Number(req.headers?.['content-length']||0);
 if(!Number.isFinite(size)||size>2800000)
  return fail(res,413,'El respaldo cifrado supera el tamaño permitido');

 let store,config;
 try{
  store=await import('../lib/romo-estado-operativo-qa.mjs');
  // El lector solo utiliza SELECT con identidad Google validada por servidor.
  // La configuración normal exige además ventas habilitadas.
  if(readonlyRequest&&!normalOperation){
   const lectura=await import('../lib/romo-claves-lectura-servidor-qa.mjs');
   config=lectura.romoPrivateReadConfig(env);
  }else config=store.romoOperativoConfig(env);
 }catch{return fail(res,503,'Módulo Romo no preparado')}
 if(!config)return fail(res,503,'Base exclusiva Romo no configurada');

 let db,identityModule;
 try{
  db=require('@neondatabase/serverless').neon(config.url);
  identityModule=await import('../lib/romo-identidad-servidor-qa.mjs');
 }catch{return fail(res,503,'El servicio privado de Romo no está disponible')}

 let identity;
 try{
  identity=await identityModule.resolveRomoIdentity({
   authorization:req.headers?.authorization,
   db,
   verifyToken:identityModule.verifyFirebaseGoogleToken,
   env
  });
 }catch{return fail(res,503,'No se pudo comprobar el acceso Romo')}
 if(!identity)return fail(res,403,'Sin autorización para Romo La Serena');

 // Misma API, misma sesión verificada: catálogo e inventario propios de Romo.
 // Nunca usar endpoints ni almacenes Uki como alternativa.
 if(area==='catalog'||area==='inventory'){
  if(req.method==='POST'&&readonlyRequest)
   return fail(res,503,'El lector nunca permite guardar');
  if(req.method==='POST'&&String(req.headers?.['content-type']||'').split(';')[0].trim()!=='application/json')
   return fail(res,415,'Formulario JSON requerido');
  try{
   const panel=await import('../lib/romo-panel-http-qa.mjs');
   const result=await panel.procesarAreaPanelRomoQA({area,method:req.method,body:req.body,db,identity});
   return res.status(200).json({ok:true,...result});
  }catch(error){
   const msg=String(error?.message||'');
   if(error?.code==='ROMO_INVENTORY_CONFLICT'||/otro teléfono|otro dispositivo|cambió|desactualizada|actualiza antes de guardar/i.test(msg))
    return fail(res,409,'Otro equipo modificó Romo; recarga antes de guardar');
   if(/permiso|autorizaci[oó]n|identidad|rol|dueños/i.test(msg))
    return fail(res,403,'Sin permiso para modificar esta área de Romo');
   if(/no reconocido|inválid|obligatori|fuera de|incorrect|debe|no permitid|formulario|sección|sucursal|otro local|no pertenece/i.test(msg))
    return fail(res,400,'Formulario o local de Romo inválido');
   return fail(res,503,'No se confirmó la operación de Romo; datos sin cambio confirmado');
  }
 }

 if(req.method==='GET'){
  try{
   const state=await store.readRomoOperativeState({db,identity});
   return res.status(200).json({ok:true,...state});
  }catch(error){
   if(/no tiene permiso|identidad|La identidad|Sin permiso/.test(String(error?.message||'')))
    return fail(res,403,'Sin permiso para consultar Romo');
   return fail(res,503,'No se pudo consultar el estado de Romo');
  }
 }
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join('|')!=='expectedRevision|snapshot')
  return fail(res,400,'Formato de respaldo no válido');
 try{
  const result=await store.saveRomoOperativeState({
   db,identity,expectedRevision:body.expectedRevision,snapshot:body.snapshot
  });
  return res.status(200).json({ok:true,...result});
 }catch(error){
  if(error?.code==='REVISION_CONFLICTO')
   return fail(res,409,'Romo cambió desde otro equipo. Recarga antes de guardar');
  if(/no es válido|no pertenece|no autorizadas|límite|revisión operativa|supera|El cifrado/.test(String(error?.message||'')))
   return fail(res,400,'El respaldo cifrado de Romo no es válido');
  if(/no tiene permiso|identidad|La identidad|Sin permiso/.test(String(error?.message||'')))
   return fail(res,403,'Sin permiso para guardar Romo');
  return fail(res,503,'No se pudo guardar. Los cambios de Romo no están confirmados');
 }
};
