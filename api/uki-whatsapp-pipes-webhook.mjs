'use strict';
// Receptor exclusivo de PipesBot (API v2), solo lectura, desactivado por defecto.
// Web Request API conserva los bytes originales para comprobar la firma.
import pipes from '../lib/uki-whatsapp-pipes.cjs';
import core from '../lib/uki-whatsapp-supervision.cjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {neon}=require('@neondatabase/serverless');
function reply(status,data){
 return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function isolatedDb(){
 const v=process.env.UKI_FIN_PRIVATE_DATABASE_URL||'';
 try{
  const u=new URL(v);
  const okHosts=['ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech',
   'ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech'];
  return ['postgres:','postgresql:'].includes(u.protocol)&&okHosts.includes(u.hostname)?v:null;
 }catch{return null;}
}
export default {
 async fetch(request){
  if(process.env.UKI_WA_SUPERVISION_ENABLED!=='true'||
     process.env.UKI_WA_PIPES_ENABLED!=='true'||
     process.env.UKI_FIN_PRIVATE_ENABLED!=='true')
   return reply(404,{ok:false,error:'Receptor no habilitado'});
  if(request.method!=='POST')return reply(405,{ok:false});
  if(!String(request.headers.get('content-type')||'').startsWith('application/json'))
   return reply(415,{ok:false});
  const db=isolatedDb(),secret=process.env.UKI_WA_PIPES_WEBHOOK_SECRET,
   encryption=process.env.UKI_WA_ENCRYPTION_KEY,map=process.env.UKI_WA_PIPES_NUMBER_MAP_JSON;
  if(!db||!secret||!encryption||!map)return reply(503,{ok:false,error:'Configuración pendiente'});
  if(Number(request.headers.get('content-length')||0)>256000)return reply(413,{ok:false});
  let raw;
  try{raw=Buffer.from(await request.arrayBuffer())}catch{return reply(400,{ok:false});}
  if(raw.length>256000)return reply(413,{ok:false});
  const headers={
   'webhook-id':request.headers.get('webhook-id'),
   'webhook-timestamp':request.headers.get('webhook-timestamp'),
   'webhook-signature':request.headers.get('webhook-signature')
  };
  if(!pipes.verifyPipes(raw,headers,secret))return reply(403,{ok:false,error:'Firma inválida'});
  let normalized;
  try{
   normalized=pipes.parsePipesEnvelope(JSON.parse(raw.toString('utf8')),map);
  }catch{return reply(400,{ok:false,error:'Evento inválido'});}
  if(normalized.test||normalized.ignored)return reply(200,{ok:true,soloLectura:true});
  if(normalized.messages.length>250)return reply(413,{ok:false});
  try{
   const sql=neon(db);
   for(const m of normalized.messages){
    const kind=m.direction==='cliente'?core.classify(m.body).kind:'general';
    await sql.query('INSERT INTO public.wa_supervision_mensajes '+ 
     '(sucursal,message_id,direccion,cliente_hash,cliente_ultimos4,fecha_mensaje,tipo,contenido_cifrado,clasificacion) '+
     'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(sucursal,message_id) DO NOTHING',[
     m.sucursal,m.id,m.direction,core.customerHash(m.customer,encryption),m.customer.slice(-4),
     m.timestamp,m.type,core.seal(m.body,encryption,m.sucursal+'|'+m.id),kind
    ]);
   }
   return reply(200,{ok:true,soloLectura:true});
  }catch{
   // Se responde 503 para que el proveedor reintente; el índice evita duplicados.
   return reply(503,{ok:false,error:'No se pudo guardar evento'});
  }
 }
};
