'use strict';
/*
 * Enlaces privados de seguimiento para las tres sucursales.
 * No publica cartas, cobra, lee bancos ni escribe caja.
 * El servidor debe guardar el pedido y la huella del token antes de responder.
 */
const {randomBytes,createHmac,createHash,timingSafeEqual}=require('node:crypto');
const STORES=Object.freeze({'uki:arica':'ua','uki:serena':'us','romo:serena':'rs'});
const STORE_BY_CODE=Object.freeze(Object.fromEntries(Object.entries(STORES).map(([s,c])=>[c,s])));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_KEY=/^[0-9a-f]{64}$/i;
const HASH=/^[0-9a-f]{64}$/i;
const B64URL=/^[A-Za-z0-9_-]+$/;
const MAX_SECONDS=7*24*60*60;
const DEFAULT_SECONDS=3*24*60*60;
function keyFromSecret(secret){return typeof secret==='string'&&HEX_KEY.test(secret)?Buffer.from(secret,'hex'):null;}
function nowSeconds(value){
 const n=value===undefined?Math.floor(Date.now()/1000):value;
 return Number.isSafeInteger(n)&&n>=1700000000&&n<=4000000000?n:null;
}
function deriveStoreKey(secret,storeId){return createHmac('sha256',secret).update('seguimiento/clave/v1/'+storeId).digest();}
function sign(payload,secret,storeId){
 return createHmac('sha256',deriveStoreKey(secret,storeId)).update('seguimiento/enlace/v1/'+payload).digest();
}
function fingerprint(token){return createHash('sha256').update(token).digest('hex');}
function issueLink({storeId,orderId,issuedAtSeconds,ttlSeconds=DEFAULT_SECONDS}={},secret){
 const k=keyFromSecret(secret),issued=nowSeconds(issuedAtSeconds);
 if(!k||!STORES[storeId]||typeof orderId!=='string'||!UUID.test(orderId)||
    issued===null||!Number.isSafeInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>MAX_SECONDS)
   throw new Error('Enlace de seguimiento no configurado');
 const expiry=issued+ttlSeconds,nonce=randomBytes(18).toString('base64url');
 const payload=['st1',STORES[storeId],orderId.toLowerCase(),issued.toString(36),expiry.toString(36),nonce].join('.');
 const token=payload+'.'+sign(payload,k,storeId).toString('base64url');
 return Object.freeze({token,tokenHash:fingerprint(token),storeId,orderId:orderId.toLowerCase(),
  issuedAtSeconds:issued,expiresAtSeconds:expiry});
}
function verifyLink(token,secret,{atSeconds}={}){
 const k=keyFromSecret(secret),now=nowSeconds(atSeconds);
 if(!k||now===null||typeof token!=='string'||token.length>320)return null;
 const parts=token.split('.');
 if(parts.length!==7||parts[0]!=='st1')return null;
 const [version,code,id,issued36,expiry36,nonce,signature]=parts;
 const storeId=STORE_BY_CODE[code];
 if(!storeId||!UUID.test(id)||id!==id.toLowerCase()||
    !/^[a-z0-9]{1,10}$/.test(issued36)||!/^[a-z0-9]{1,10}$/.test(expiry36)||
    !B64URL.test(nonce)||nonce.length!==24||
    !B64URL.test(signature)||signature.length!==43)return null;
 const issued=parseInt(issued36,36),expiry=parseInt(expiry36,36);
 if(!Number.isSafeInteger(issued)||!Number.isSafeInteger(expiry)||
    issued.toString(36)!==issued36||expiry.toString(36)!==expiry36||
    issued>now+60||expiry<=now||expiry-issued<60||expiry-issued>MAX_SECONDS)return null;
 const payload=parts.slice(0,6).join('.'),expected=sign(payload,k,storeId);
 const got=Buffer.from(signature,'base64url');
 if(got.length!==expected.length||!timingSafeEqual(expected,got))return null;
 return Object.freeze({storeId,orderId:id,issuedAtSeconds:issued,expiresAtSeconds:expiry,tokenHash:fingerprint(token)});
}
/* Verificar la huella contra la fila privada de SU sucursal en cada consulta. */
function matchesPersistedLink(link,row,{atSeconds}={}){
 const now=nowSeconds(atSeconds);
 if(now===null||!link||!row||!STORES[link.storeId]||
    row.storeId!==link.storeId||row.orderId!==link.orderId||
    row.status!=='active'||row.revokedAt!=null||
    row.expiresAtSeconds!==link.expiresAtSeconds||now>=link.expiresAtSeconds||
    typeof link.tokenHash!=='string'||!HASH.test(link.tokenHash)||
    typeof row.tokenHash!=='string'||!HASH.test(row.tokenHash))return false;
 return timingSafeEqual(Buffer.from(link.tokenHash,'hex'),Buffer.from(row.tokenHash,'hex'));
}
module.exports={STORES,MAX_SECONDS,issueLink,verifyLink,matchesPersistedLink};
