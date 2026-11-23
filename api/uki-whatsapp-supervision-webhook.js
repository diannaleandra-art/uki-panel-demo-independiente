'use strict';
/* Receptor de Meta para supervisión. Solo recibe; nunca envía mensajes a WhatsApp.
   Desactivado hasta configurar y verificar coexistencia en un solo número. */
const {verifiedSignature,storeMap,extractMessages,classify,customerHash,seal}=require('../lib/uki-whatsapp-supervision.cjs');
function disabled(){return process.env.UKI_WA_SUPERVISION_ENABLED!=='true'||process.env.UKI_FIN_PRIVATE_ENABLED!=='true';}
function privateDatabase(){
 const d=process.env.UKI_FIN_PRIVATE_DATABASE_URL||'';
 try{
  const u=new URL(d);
  const hosts=['ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech',
   'ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech'];
  return ['postgres:','postgresql:'].includes(u.protocol)&&hosts.includes(u.hostname)?d:null;
 }catch{return null;}
}
async function rawBody(req,max=256000){
 // No recomponer JSON: la firma de Meta se verifica sobre los bytes originales.
 if(req.body!==undefined&&!Buffer.isBuffer(req.body))throw Error('RAW_BODY_UNAVAILABLE');
 let chunks=[],length=0;
 if(Buffer.isBuffer(req.body))return req.body.length<=max?req.body:Promise.reject(Error('BODY_TOO_LARGE'));
 for await(const chunk of req){length+=chunk.length;if(length>max)throw Error('BODY_TOO_LARGE');chunks.push(chunk);}
 return Buffer.concat(chunks);
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(disabled())return res.status(404).end();
 if(req.method==='GET'){
  const url=new URL(req.url,'https://example.invalid');
  const mode=url.searchParams.get('hub.mode')||'',token=url.searchParams.get('hub.verify_token')||'',
   challenge=url.searchParams.get('hub.challenge')||'';
  if(mode!=='subscribe'||!process.env.UKI_WA_VERIFY_TOKEN||
     token!==process.env.UKI_WA_VERIFY_TOKEN||!/^\d{1,250}$/.test(challenge))
    return res.status(403).end();
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  return res.status(200).send(challenge);
 }
 if(req.method!=='POST')return res.status(405).end();
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).end();
 const secret=process.env.UKI_WA_META_APP_SECRET;
 const cipherKey=process.env.UKI_WA_ENCRYPTION_KEY;
 const db=privateDatabase();
 if(!secret||!cipherKey||!db||!process.env.UKI_WA_PHONE_MAP_JSON)
  return res.status(503).end();
 let raw;
 try{raw=await rawBody(req);}catch{return res.status(413).end();}
 if(!verifiedSignature(raw,req.headers['x-hub-signature-256'],secret))return res.status(403).end();
 let messages;
 try{
  const data=JSON.parse(raw.toString('utf8'));
  messages=extractMessages(data,storeMap(process.env.UKI_WA_PHONE_MAP_JSON));
 }catch{return res.status(400).end();}
 if(messages.length>300)return res.status(413).end();
 try{
  const sql=require('@neondatabase/serverless').neon(db);
  for(const m of messages){
   const kind=m.direction==='cliente'?classify(m.body).kind:'general';
   await sql.query(`INSERT INTO public.wa_supervision_mensajes
   (sucursal,message_id,direccion,cliente_hash,cliente_ultimos4,fecha_mensaje,tipo,
    contenido_cifrado,clasificacion)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(sucursal,message_id) DO NOTHING`,[
    m.sucursal,m.id,m.direction,customerHash(m.customer,cipherKey),m.customer.slice(-4),
    m.timestamp,m.type,seal(m.body,cipherKey,m.sucursal+'|'+m.id),kind
   ]);
  }
  return res.status(200).json({ok:true});
 }catch{
  // Meta reintentará sin duplicar mensajes ya registrados.
  return res.status(503).json({ok:false,error:'No se pudo guardar el evento.'});
 }
};
// Para despliegues que admitan esta opción: no transformar el body antes de HMAC.
module.exports.config={api:{bodyParser:false}};
module.exports._testing={disabled,privateDatabase,rawBody};
