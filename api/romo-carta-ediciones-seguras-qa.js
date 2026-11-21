'use strict';
/**
 * PREPARADO, NO PUBLICADO. Edición mínima y auditada de la carta Romo.
 * Solo dueños Google+Neon y Preview, con bandera explícita apagada por defecto.
 * No toca la tabla incompleta romo_catalogo_v1 ni los precios de Uki.
 */
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
const STORE='romo:serena';
const fail=(r,s,e)=>r.status(s).json({ok:false,storeId:STORE,error:e});
const originOK=x=>/^https:\/\/[a-z0-9.-]+$/i.test(x)&&!String(x).includes('..');
function config(env){
  if(!entornoPanelRomoAutorizado(env)||
    env.ROMO_CARTA_EDICIONES_QA_ENABLED!=='true')return null;
  const panel=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
  const carta=String(env.ROMO_CARTA_CATALOGO_QA_ORIGIN||'');
  const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
  if(!originOK(panel)||!originOK(carta)||panel===carta||
     !/^[a-z0-9.-]+$/.test(host))return null;
  let db;
  try{db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''));}
  catch{return null;}
  if(!['postgres:','postgresql:'].includes(db.protocol)||
     db.hostname.toLowerCase()!==host||db.pathname!=='/romos_sushi'||
     db.username!=='romos_app_service'||!db.password||db.hash)return null;
  for(const other of ['UKI_INVENTARIO_LIVE_DATABASE_URL',
      'UKI_INVENTARIO_QA_DATABASE_URL','UKI_FIN_PRIVATE_DATABASE_URL',
      'UKI_FIN_QA_DATABASE_URL']){
    try{if(new URL(String(env[other]||'')).hostname.toLowerCase()===host)return null;}
    catch{}
  }
  return {panel,carta,database:db.toString(),
    write:env.ROMO_CARTA_EDICIONES_ESCRITURA_QA_ENABLED==='true',
    sharedRead:require('../lib/romo-origen-seguro-qa.cjs').origenUnificadoLecturaRomoQA(env)};
}
async function approvedCarta(conf){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
  try{
    const resp=await fetch(conf.carta+'/api/romo-catalogo-aprobado-qa',{
      method:'GET',headers:{Origin:conf.panel,Accept:'application/json',
        ...await require('../lib/romo-oidc-s2s-qa.cjs').headersOIDCRomoQA(process.env)},
      cache:'no-store',redirect:'error',signal:abort.signal
    });
    if(!resp.ok)throw Error('La carta aprobada no confirmó su catálogo');
    const raw=await resp.text();
    if(raw.length>200000)throw Error('Catálogo Romo demasiado grande');
    const json=JSON.parse(raw);
    if(!json||json.storeId!==STORE||json.source!=='carta-aprobada-en-codigo'||
      json.readOnly!==true||json.brand!=='romo'||json.branch!=='serena')
      throw Error('El catálogo no corresponde a Romo');
    return json;
  }finally{clearTimeout(timer);}
}
module.exports=async function romoCartaEdicionesSegurasQA(req,res){
  res.setHeader('Cache-Control','private,no-store,max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Origin');
  const conf=config(process.env);
  if(!conf)return fail(res,503,'Edición de carta Romo no habilitada');
  const method=String(req.method||'').toUpperCase();
  if(!['GET','POST','OPTIONS'].includes(method))
    return fail(res,405,'Sólo lectura y edición autorizada');
  const origin=String(req.headers?.origin||'');
  const {resolverOrigenLecturaUnificadaRomoQA}=require('../lib/romo-origen-seguro-qa.cjs');
  const acceso=resolverOrigenLecturaUnificadaRomoQA(req,conf.panel,conf.sharedRead);
  if(!acceso)return fail(res,403,'Origen no autorizado para Romo');
  if(origin)res.setHeader('Access-Control-Allow-Origin',acceso.origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  res.setHeader('Access-Control-Allow-Methods',acceso.compartido?'GET,OPTIONS':'GET,POST,OPTIONS');
  if(method==='OPTIONS')return res.status(204).end();
  // Consultar la carta NO habilita guardados ni su inicialización.
  // Requiere un segundo permiso explícito, distinto del permiso de lectura.
  if(method==='POST'&&acceso.compartido)return fail(res,403,'La consulta compartida no autoriza modificaciones');
  if(method==='POST'&&!conf.write)
    return fail(res,503,'Edición de productos Romo desactivada en Preview');
  if(method==='POST'&&
     !String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))
    return fail(res,415,'Se requiere JSON');
  if(method==='POST'&&
     (!req.body||typeof req.body!=='object'||Array.isArray(req.body)||
       JSON.stringify(req.body).length>4500))
    return fail(res,400,'Solicitud de edición inválida');
  if(method==='POST'){
    const keys=Object.keys(req.body).sort().join('|');
    const edition=['baseSha256','expectedRevision','motivo','patch','sku'].sort().join('|');
    const begin=['action','baseSha256','expectedRevision','motivo'].sort().join('|');
    const gestion=['action','baseSha256','expectedRevision','fields','motivo'].sort().join('|');
    if(keys!==edition&&keys!==begin&&keys!==gestion)
      return fail(res,400,'Campos adicionales no permitidos');
    if(keys===begin&&(req.body.action!=='initialize'||req.body.expectedRevision!==0))
      return fail(res,400,'Inicialización de Romo no autorizada');
  }
  try{
    const sql=require('@neondatabase/serverless').neon(conf.database);
    const db={query:(query,args)=>sql.query(query,args)};
    const auth=await import('../lib/romo-identidad-servidor-qa.mjs');
    const identity=await auth.resolveRomoIdentity({
      authorization:req.headers?.authorization,db,
      verifyToken:auth.verifyFirebaseGoogleToken
    });
    if(!identity||identity.brand!=='romo'||identity.role!=='duenos')
      return fail(res,403,'Se requiere acceso privado de dueños de Romo');
    const carta=await approvedCarta(conf);
    const lib=await import('../lib/romo-carta-ediciones-seguras-qa.mjs');
    if(method==='GET'){
      const result=await lib.leerEdicionesRomoQA({db,carta,identity});
      return res.status(200).json({...result,edicionHabilitada:conf.write});
    }
    if(req.body.action==='initialize'){
      const result=await lib.inicializarCatalogoRomoQA({
        db,carta,identity,baseSha256:req.body.baseSha256,motivo:req.body.motivo
      });
      return res.status(200).json(result);
    }
    if(req.body.fields&&req.body.action){
      return res.status(200).json(await lib.guardarGestionRomoQA({db,carta,identity,expectedRevision:req.body.expectedRevision,baseSha256:req.body.baseSha256,action:req.body.action,fields:req.body.fields,motivo:req.body.motivo}));
    }
    const result=await lib.guardarEdicionRomoQA({
      db,carta,identity,
      expectedRevision:req.body.expectedRevision,
      baseSha256:req.body.baseSha256,
      sku:req.body.sku,patch:req.body.patch,motivo:req.body.motivo
    });
    return res.status(200).json(result);
  }catch(e){
    if(e?.status===409)return fail(res,409,
      'Otra edición cambió la carta. Actualiza antes de guardar.');
    console.error('Edición Romo sin confirmar:',String(e?.message||e));
    return fail(res,503,'El guardado de la carta Romo no fue confirmado; actualiza y revisa el estado.');
  }
};
module.exports._internalQA={config};
