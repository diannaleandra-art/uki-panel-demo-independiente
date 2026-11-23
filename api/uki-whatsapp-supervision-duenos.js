'use strict';
/* Consulta privada de supervisión WhatsApp. Solo Google + PIN de dueños.
   No permite enviar mensajes, modificar pedidos ni ver datos de otras bases. */
const crypto=require('node:crypto');
const {unseal,STORES}=require('../lib/uki-whatsapp-supervision.cjs');
function privateDatabase(){
 const d=process.env.UKI_FIN_PRIVATE_DATABASE_URL||'';
 try{
  const u=new URL(d);
  return ['postgres:','postgresql:'].includes(u.protocol)&&
  ['ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech',
   'ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech'].includes(u.hostname)?d:null;
 }catch{return null;}
}
async function googleOwner(req){
 const token=String(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token)return null;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(token,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',
  audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com'||!payload.email_verified)return null;
 const emails=String(process.env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'')
  .split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);
 if(!emails.includes(String(payload.email||'').toLowerCase()))return null;
 return String(payload.sub);
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 const origin=String(req.headers.origin||''),self='https://'+String(req.headers.host||'');
 const allowed=['https://diannaleandra-art.github.io','https://romos-sushi-panel.vercel.app',self].includes(origin);
 if(allowed){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Fin-Session');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 }
 if(req.method==='OPTIONS')return res.status(allowed?204:403).end();
 if(req.method!=='POST'||!allowed)return res.status(403).json({ok:false,error:'Origen no permitido.'});
 if(process.env.UKI_WA_SUPERVISION_ENABLED!=='true'||process.env.UKI_FIN_PRIVATE_ENABLED!=='true')
  return res.status(404).json({ok:false,error:'Supervisión aún no conectada.'});
 const db=privateDatabase(),key=process.env.UKI_WA_ENCRYPTION_KEY;
 if(!db||!key)return res.status(503).json({ok:false,error:'Servicio privado no configurado.'});
 const uid=await googleOwner(req).catch(()=>null);
 if(!uid)return res.status(403).json({ok:false,error:'Acceso Google no autorizado.'});
 const session=String(req.headers['x-fin-session']||'');
 if(!/^[0-9a-f]{64}$/i.test(session))return res.status(401).json({ok:false,error:'Falta el PIN privado.'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))
  return res.status(415).json({ok:false,error:'Solo JSON.'});
 const body=req.body||{};
 if(body.action!=='listar'||JSON.stringify(body).length>3000)
  return res.status(400).json({ok:false,error:'Consulta no permitida.'});
 const branch=String(body.sucursal||'');
 if(branch&&!STORES.has(branch))
  return res.status(400).json({ok:false,error:'Sucursal no permitida.'});
 try{
  const sql=require('@neondatabase/serverless').neon(db);
  const sha=crypto.createHash('sha256').update(session).digest('hex');
  const access=await sql.query('SELECT 1 FROM public.fin_sesiones WHERE token_hash=$1 AND usuario_uid=$2 AND expira_en>now() LIMIT 1',[sha,uid]);
  if(!access.length)return res.status(401).json({ok:false,error:'Tu sesión privada venció.'});
  const rows=await sql.query(`SELECT sucursal,message_id,direccion,cliente_ultimos4,cliente_hash,
    fecha_mensaje,tipo,contenido_cifrado,clasificacion FROM public.wa_supervision_mensajes
    WHERE ($1::text='' OR sucursal=$1) AND recibido_en>=now()-interval '35 days'
    ORDER BY fecha_mensaje DESC LIMIT 80`,[branch]);
  const mensajes=rows.map(r=>({
   sucursal:r.sucursal,direccion:r.direccion,cliente:'••••'+r.cliente_ultimos4,
   fecha:r.fecha_mensaje,tipo:r.tipo,clasificacion:r.clasificacion,
   texto:unseal(r.contenido_cifrado,key,r.sucursal+'|'+r.message_id)
  }));
  return res.status(200).json({ok:true,mensajes,soloLectura:true,completitud:'parcial'});
 }catch{return res.status(503).json({ok:false,error:'No fue posible consultar supervisión.'});}
};
