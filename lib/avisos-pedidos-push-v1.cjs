'use strict';
const {createHash,ECDH}=require('node:crypto');
const STORES={
 'uki:arica':{name:'Uki Regimiento Arica',branch:'arica'},
 'uki:serena':{name:'Uki La Serena',branch:'serena'},
 'romo:serena':{name:'Romo La Serena',branch:'romo'}
};
const err=(status,message)=>Object.assign(Error(message),{status});
const digest=v=>createHash('sha256').update(v).digest('hex');
const base64=(v,len)=>typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v)&&Buffer.from(v,'base64url').length===len&&Buffer.from(v,'base64url').toString('base64url')===v;
function publicKey(v){if(!base64(v,65)||!v.startsWith('B'))return false;try{ECDH.convertKey(Buffer.from(v,'base64url'),'prime256v1');return true;}catch{return false;}}
function config(env=process.env){
 if(env.VERCEL_ENV!=='production'||env.AVISOS_PEDIDOS_PUSH_ENABLED!=='true'||!publicKey(env.AVISOS_PEDIDOS_PUSH_PUBLIC_KEY)||!base64(env.AVISOS_PEDIDOS_PUSH_PRIVATE_KEY,32))return null;
 return {publicKey:env.AVISOS_PEDIDOS_PUSH_PUBLIC_KEY,privateKey:env.AVISOS_PEDIDOS_PUSH_PRIVATE_KEY,subject:'https://romos-sushi-panel.vercel.app'};
}
function endpoint(raw){
 if(typeof raw!=='string'||raw.length>2000||raw.length<16||/[\x00-\x20]/.test(raw))throw err(400,'Dirección de avisos no válida.');
 let u;try{u=new URL(raw);}catch{throw err(400,'Dirección de avisos no válida.');}
 const h=u.hostname;
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||u.pathname==='/'||
 !(h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h==='push.services.mozilla.com'||
 h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com')||h==='wns.windows.com'||h.endsWith('.wns.windows.com')))
  throw err(400,'Este servicio de notificaciones no es compatible.');
 return u.href;
}
function subscription(raw){
 const e=endpoint(raw?.endpoint),p=raw?.keys?.p256dh,a=raw?.keys?.auth;
 if(!publicKey(p)||!base64(a,16))throw err(400,'Claves de notificaciones no válidas.');
 return {endpoint:e,keys:{p256dh:p,auth:a}};
}
function payload(store,id,isTest=false){
 const site=STORES[store];if(!site)throw err(400,'Local inválido.');
 return {title:isTest?'Prueba de avisos · '+site.name:'🍣 Nuevo pedido de la carta · '+site.name,
  body:isTest?'Ya puedes recibir los avisos de este local.':'Toca para revisar los pedidos pendientes del local.',
  branch:site.branch,tag:isTest?'pedido-prueba-'+site.branch:'pedido-'+digest(String(id)).slice(0,24)};
}
async function send(sub,msg,c,deliver){
 const service=deliver||require('web-push').sendNotification;
 return service(sub,JSON.stringify(msg),{vapidDetails:{subject:c.subject,publicKey:c.publicKey,privateKey:c.privateKey},
  TTL:600,urgency:'high',timeout:6000});
}
async function manage({db,store,principal,body,env=process.env,deliver}){
 const c=config(env);if(!c)throw err(503,'Los avisos de pedidos todavía no están habilitados.');
 if(!STORES[store]||typeof principal!=='string'||!principal||principal.length>220)throw err(403,'Tu sesión no puede activar estos avisos.');
 const owner=digest(principal),op=body?.operacion;
 if(op==='activar'){
  const sub=subscription(body.subscription),hash=digest(sub.endpoint);
  await db.query(`INSERT INTO public.pedidos_push_suscripciones_v1 (endpoint_hash,store_id,principal_hash,subscription)
   VALUES ($1,$2,$3,$4::jsonb)
   ON CONFLICT(endpoint_hash) DO UPDATE SET store_id=EXCLUDED.store_id,principal_hash=EXCLUDED.principal_hash,
    subscription=EXCLUDED.subscription,updated_at=now()`,[hash,store,owner,JSON.stringify(sub)]);
  return {ok:true};
 }
 if(op!=='desactivar'&&op!=='prueba')throw err(400,'Acción de avisos inválida.');
 const hash=digest(endpoint(body.endpoint));
 if(op==='desactivar'){
  await db.query('DELETE FROM public.pedidos_push_suscripciones_v1 WHERE endpoint_hash=$1 AND store_id=$2 AND principal_hash=$3',[hash,store,owner]);
  return {ok:true};
 }
 const [record]=await db.query(`UPDATE public.pedidos_push_suscripciones_v1 SET last_test_at=now()
  WHERE endpoint_hash=$1 AND store_id=$2 AND principal_hash=$3 AND
   (last_test_at IS NULL OR last_test_at<now()-interval '15 seconds') RETURNING subscription`,[hash,store,owner]);
 if(!record)throw err(429,'Activa los avisos en este equipo o espera 15 segundos antes de otra prueba.');
 try{await send(subscription(record.subscription),payload(store,'',true),c,deliver);}
 catch(e){
  if([404,410].includes(e?.statusCode)){
   await db.query('DELETE FROM public.pedidos_push_suscripciones_v1 WHERE endpoint_hash=$1 AND store_id=$2 AND principal_hash=$3',[hash,store,owner]);
   throw err(409,'Este aviso venció. Desactiva y vuelve a activar en este equipo.');
  }
  throw err(502,'El navegador no confirmó el aviso de prueba. Revisa los permisos y vuelve a intentar.');
 }
 return {ok:true};
}
async function dispatch({db,store,id,env=process.env,deliver}){
 const c=config(env);if(!c||!STORES[store]||!/^[a-f0-9-]{36}$/i.test(String(id)))return {sent:0};
 const rows=await db.query(`SELECT endpoint_hash,subscription FROM public.pedidos_push_suscripciones_v1
  WHERE store_id=$1 AND updated_at>now()-interval '60 days' ORDER BY updated_at DESC LIMIT 30`,[store]);
 const msg=payload(store,id);
 let sent=0;
 for(let i=0;i<rows.length;i+=10)await Promise.allSettled(rows.slice(i,i+10).map(async row=>{
  try{await send(subscription(row.subscription),msg,c,deliver);sent++;}
  catch(e){if([404,410].includes(e?.statusCode))await db.query(
   'DELETE FROM public.pedidos_push_suscripciones_v1 WHERE endpoint_hash=$1 AND store_id=$2 AND subscription=$3::jsonb',
   [row.endpoint_hash,store,JSON.stringify(row.subscription)]);}
 }));
 return {sent};
}
// Conecta sólo después de un INSERT confirmado. Un fallo de push no altera la respuesta al cliente.
function enqueue(args){
 if(!config(args.env))return;
 try{require('@vercel/functions').waitUntil(dispatch(args).catch(()=>console.warn('Avisos de pedidos: no se completó la entrega.')));}
 catch{console.warn('Avisos de pedidos: el proceso de entrega no se pudo programar.');}
}
module.exports={config,endpoint,subscription,payload,manage,dispatch,enqueue};
