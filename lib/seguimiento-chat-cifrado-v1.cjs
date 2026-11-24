'use strict';
/* AES-256-GCM: la clave y el texto original nunca van al navegador ni a SQL. */
const {randomBytes,createCipheriv,createDecipheriv,createHmac}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const STORES=new Set(['uki:arica','uki:serena','romo:serena']);
const SENDERS=new Set(['cliente','agendador']);
function key(secret,storeId){
 if(typeof secret!=='string'||!/^[a-f0-9]{64}$/i.test(secret)||!STORES.has(storeId))return null;
 return createHmac('sha256',Buffer.from(secret,'hex')).update('chat-sucursal-v1:'+storeId).digest();
}
function valid(m){
 return m&&STORES.has(m.storeId)&&typeof m.orderId==='string'&&UUID.test(m.orderId)&&
  SENDERS.has(m.from)&&typeof m.body==='string'&&m.body.trim().length>=1&&
  m.body.trim().length<=800&&m.body.length<=820;
}
function aad({storeId,orderId,from}){return Buffer.from('chat-v1:'+storeId+':'+orderId.toLowerCase()+':'+from);}
function seal(message,secret){
 if(!valid(message))return null;
 const k=key(secret,message.storeId);if(!k)return null;
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',k,iv);
 cipher.setAAD(aad(message));
 const ciphertext=Buffer.concat([cipher.update(message.body.trim(),'utf8'),cipher.final(),cipher.getAuthTag()]);
 return {remitente:message.from,mensaje_cifrado:ciphertext.toString('base64url'),nonce:iv.toString('base64url')};
}
function unseal({storeId,orderId,from,ciphertext,nonce}={},secret){
 const k=key(secret,storeId);
 if(!k||typeof orderId!=='string'||!UUID.test(orderId)||!SENDERS.has(from)||
    typeof ciphertext!=='string'||ciphertext.length>5000||
    typeof nonce!=='string'||!/^[A-Za-z0-9_-]{16}$/.test(nonce))return null;
 try{
  const iv=Buffer.from(nonce,'base64url'),packed=Buffer.from(ciphertext,'base64url');
  if(iv.length!==12||packed.length<=16)return null;
  const dec=createDecipheriv('aes-256-gcm',k,iv);
  dec.setAAD(aad({storeId,orderId,from}));
  dec.setAuthTag(packed.subarray(packed.length-16));
  const plain=Buffer.concat([dec.update(packed.subarray(0,packed.length-16)),dec.final()]).toString('utf8');
  return plain.length>=1&&plain.length<=800?plain:null;
 }catch{return null;}
}
module.exports={key,valid,seal,unseal};
