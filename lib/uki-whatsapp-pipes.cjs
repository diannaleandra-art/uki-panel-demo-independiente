'use strict';
// Adaptador para PipesBot API v2. No contiene ninguna ruta para enviar WhatsApp.
const crypto=require('node:crypto');
const {storeMap,extractMessages}=require('./uki-whatsapp-supervision.cjs');
function verifyPipes(raw,headers,secret,nowSeconds=Math.floor(Date.now()/1000)){
 if(!Buffer.isBuffer(raw)||!secret?.startsWith('whsec_')||!headers)return false;
 const id=String(headers['webhook-id']||''),ts=String(headers['webhook-timestamp']||'');
 const signature=String(headers['webhook-signature']||'');
 if(!/^[A-Za-z0-9_.:-]{5,150}$/.test(id)||!/^[0-9]{10,11}$/.test(ts))return false;
 if(Math.abs(nowSeconds-Number(ts))>300)return false;
 const key=Buffer.from(secret.slice(6),'base64');
 if(key.length<16)return false;
 const expected=crypto.createHmac('sha256',key).update(id+'.'+ts+'.').update(raw).digest();
 return signature.split(/\s+/).some(value=>{
  if(!value.startsWith('v1,'))return false;
  const digest=Buffer.from(value.slice(3),'base64');
  return digest.length===expected.length&&crypto.timingSafeEqual(digest,expected);
 });
}
function parsePipesEnvelope(data,allowedMap,{pilot='romo:serena'}={}){
 if(data?.event==='test')return {test:true,messages:[]};
 if(typeof data?.event==='string'&&!data?.field)return {ignored:true,messages:[]};
 if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.field!=='string')
  throw Error('Evento PipesBot v2 inválido.');
 if(!['messages','smb_message_echoes'].includes(data.field))return {ignored:true,messages:[]};
 const id=String(data.pipes?.poolNumberId||'');
 const allowed=storeMap(allowedMap);
 if(!allowed[id])return {ignored:true,messages:[]};
 if(allowed[id]!==pilot)return {ignored:true,messages:[]};
 if(data.whatsapp?.messaging_product!=='whatsapp')throw Error('Producto WhatsApp no válido.');
 const payload={object:'whatsapp_business_account',entry:[{changes:[{
  field:data.field,
  value:{...data.whatsapp,metadata:{...data.whatsapp.metadata,phone_number_id:id}}
 }]}]};
 return {messages:extractMessages(payload,allowed),test:false,ignored:false};
}
module.exports={verifyPipes,parsePipesEnvelope};
