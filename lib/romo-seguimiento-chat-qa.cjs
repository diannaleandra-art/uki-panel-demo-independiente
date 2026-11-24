'use strict';
/* Cifrado autenticado del chat privado por pedido/sucursal. No registra pagos. */
const {randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function key(secret){
 if(typeof secret!=='string'||!/^[0-9a-f]{64}$/i.test(secret))return null;
 return Buffer.from(secret,'hex');
}
function acceptable({storeId,orderId,from,body}={}){
 return storeId==='romo:serena'&&typeof orderId==='string'&&UUID.test(orderId)&&
 ['cliente','agendador'].includes(from)&&typeof body==='string'&&
 body.trim().length>=1&&body.trim().length<=800&&body.length<=820;
}
function seal(params,secret){
 const k=key(secret);
 if(!k||!acceptable(params))return null;
 const nonce=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',k,nonce);
 cipher.setAAD(Buffer.from('romo-chat-v1:'+params.storeId+':'+params.orderId.toLowerCase()+':'+params.from));
 const packed=Buffer.concat([cipher.update(params.body.trim(),'utf8'),cipher.final(),cipher.getAuthTag()]);
 return {remitente:params.from,mensaje_cifrado:packed.toString('base64url'),nonce:nonce.toString('base64url')};
}
function unseal({storeId,orderId,from,ciphertext,nonce}={},secret){
 const k=key(secret);
 if(!k||storeId!=='romo:serena'||typeof orderId!=='string'||!UUID.test(orderId)||
  !['cliente','agendador'].includes(from)||typeof ciphertext!=='string'||ciphertext.length>5000||
  typeof nonce!=='string'||!/^[A-Za-z0-9_-]{16}$/.test(nonce))return null;
 try{
  const buf=Buffer.from(ciphertext,'base64url'),iv=Buffer.from(nonce,'base64url');
  if(buf.length<17||iv.length!==12)return null;
  const dec=createDecipheriv('aes-256-gcm',k,iv);
  dec.setAAD(Buffer.from('romo-chat-v1:'+storeId+':'+orderId.toLowerCase()+':'+from));
  dec.setAuthTag(buf.subarray(buf.length-16));
  const value=Buffer.concat([dec.update(buf.subarray(0,buf.length-16)),dec.final()]).toString('utf8');
  return value.length>0&&value.length<=800?value:null;
 }catch{return null;}
}
module.exports={key,acceptable,seal,unseal};
