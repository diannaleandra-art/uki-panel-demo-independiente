'use strict';
// Private ingestion of preparation facts only; does not write to inventory or cash.
const {validate,save}=require('../lib/inventario-ventas-live-v1.cjs');
const allowed=new Map([['https://diannaleandra-art.github.io',new Set(['uki:arica','uki:serena'])],['https://romos-sushi-panel.vercel.app',new Set(['romo:serena'])]]);
const hosts=new Set(['ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech','ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech']);
function config(e=process.env){
 if(e.VERCEL_ENV!=='production'||e.UKI_FIN_PRIVATE_ENABLED!=='true'||e.UKI_CONSUMO_VENTAS_LIVE_ENABLED!=='true')return null;
 try{const u=new URL(e.UKI_FIN_PRIVATE_DATABASE_URL||'');return ['postgres:','postgresql:'].includes(u.protocol)&&hosts.has(u.hostname)&&u.password?u.toString():null;}catch{return null;}
}
async function google(req,e=process.env){
 const token=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token||token.startsWith('UKIDEV1.'))return false;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(token,keys,{issuer:'https://securetoken.google.com/uki-panel-f4909',audience:'uki-panel-f4909',algorithms:['RS256']});
 const emails=String(e.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 return payload.firebase?.sign_in_provider==='google.com'&&payload.email_verified===true&&emails.includes(String(payload.email||'').toLowerCase());
}
module.exports=async(req,res)=>{
 const fail=(status,error)=>res.status(status).json({ok:false,error});
 res.setHeader('Cache-Control','private,no-store');res.setHeader('Vary','Origin');res.setHeader('X-Content-Type-Options','nosniff');
 const origin=String(req.headers?.origin||''),stores=allowed.get(origin),db=config();
 if(!db)return fail(404,'Sincronización de consumo no habilitada.');
 if(!stores)return fail(403,'Origen no autorizado.');
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST'||String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')return fail(405,'Solicitud no permitida.');
 const b=req.body;
 if(!b||Object.keys(b).sort().join('|')!=='capturedAt|facts|revision|start|store'||!stores.has(b.store)||JSON.stringify(b).length>400000)return fail(400,'Datos de sincronización inválidos.');
 if(!await google(req).catch(()=>false))return fail(403,'Acceso de panel no autorizado.');
 try{validate(b.store,b);}catch{return fail(400,'Datos de consumo inválidos.');}
 try{return res.status(200).json(await save(require('@neondatabase/serverless').neon(db),b.store,b));}
 catch{return fail(503,'No se confirmó la sincronización de consumo. No se modificó la caja.');}
};
module.exports._testing={config,allowed};