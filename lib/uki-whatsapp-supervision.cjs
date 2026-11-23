'use strict';
/* Supervisión WhatsApp Uki/Romo. Solo lectura: este módulo NO contiene envíos. */
const crypto=require('node:crypto');
const STORES=new Set(['uki:arica','uki:serena','romo:serena']);
const MAX_TEXT=1800;
function verifiedSignature(raw,signature,secret){
 if(!Buffer.isBuffer(raw)||!secret||typeof signature!=='string')return false;
 const expected='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
 const a=Buffer.from(expected),b=Buffer.from(signature.trim());
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function phone(value){
 const str=String(value??'').trim();
 if(/^\+?[0-9]{8,16}$/.test(str))return str.replace(/[^0-9]/g,'');
 // Meta puede entregar identificadores de usuario en lugar de números.
 // Preservarlos sin convertirlos en números potencialmente equivocados.
 if(/^[A-Z]{2}\.[A-Za-z0-9_-]{8,60}$/.test(str))return str;
 return null;
}
function storeMap(json){
 const data=typeof json==='string'?JSON.parse(json):json;
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Mapa de números no configurado.');
 const result={};
 for(const [id,store] of Object.entries(data)){
  if(!(/^[0-9]{5,24}$/.test(id)||/^pn_[a-zA-Z0-9_-]{3,65}$/.test(id))||!STORES.has(store))throw Error('Número/sucursal no permitido.');
  result[id]=store;
 }
 if(!Object.keys(result).length)throw Error('Faltan números WhatsApp.');
 return result;
}
function bodyOf(m){
 if(m.type==='text')return String(m.text?.body||'').slice(0,MAX_TEXT);
 if(m.type==='button')return String(m.button?.text||'').slice(0,MAX_TEXT);
 if(m.type==='interactive')return String(m.interactive?.button_reply?.title||m.interactive?.list_reply?.title||'').slice(0,MAX_TEXT);
 // Nunca descargar audios, fotos, documentos ni ubicaciones de clientes.
 return '';
}
function extractMessages(payload,allowed){
 if(payload?.object!=='whatsapp_business_account'||!Array.isArray(payload.entry))return [];
 const result=[];
 for(const entry of payload.entry.slice(0,40))for(const change of (entry.changes||[]).slice(0,40)){
  const value=change.value||{},id=String(value.metadata?.phone_number_id||'');
  const store=allowed[id];
  if(!STORES.has(store)||value.messaging_product!=='whatsapp')continue;
  const list=change.field==='messages'?value.messages:
   change.field==='smb_message_echoes'?value.message_echoes:null;
  if(!Array.isArray(list))continue;
  for(const m of list.slice(0,300)){
   if(!m||typeof m!=='object'||typeof m.id!=='string'||m.id.length<4||m.id.length>250)continue;
   const direction=change.field==='messages'?'cliente':'agendadora';
   const customer=phone(direction==='cliente'?m.from:m.to);
   if(!customer)continue;
   const ts=Number(m.timestamp);
   if(!Number.isSafeInteger(ts)||ts<946684800||ts>4102444800)continue;
   const type=String(m.type||'desconocido').slice(0,35);
   result.push({id:m.id,sucursal:store,direction,customer,timestamp:new Date(ts*1000).toISOString(),
    type,body:bodyOf(m)});
  }
 }
 return result;
}
function classify(body){
 const s=String(body||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(reclamo|equivocad[oa]|falt[oóa]|no llego|mal hecho|devolucion|me cobraron)\b/.test(s))
  return {kind:'posible_reclamo',label:'Revisar posible reclamo'};
 if(/\b(cambiar|cambio|cancelar|cancelacion|en vez de|modificar|agregar|quitar)\b/.test(s))
  return {kind:'posible_cambio',label:'Revisar posible cambio de pedido'};
 if(/\b(pedido|piezas|pzas|roll|handroll|delivery|retiro|llevar)\b/.test(s))
  return {kind:'posible_pedido',label:'Comprobar si hay pedido asociado'};
 return {kind:'general',label:'Sin alerta automática'};
}
function pieces(text){
 const m=String(text||'').toLowerCase().match(/\b(12|24|36|48|60|72|84|96|108)\s*(?:piezas?|pzas?)\b/);
 return m?Number(m[1]):null;
}
function comparePieces(text,linkedOrder){
 // Sólo comparar cuando un sistema fiable haya relacionado chat + pedido + sucursal.
 if(!linkedOrder||linkedOrder.vinculo_verificado!==true||!Number.isSafeInteger(linkedOrder.piezas))
  return {status:'sin_vinculo',label:'Falta asociar un pedido para comparar'};
 const requested=pieces(text);
 if(requested===null)return {status:'sin_dato',label:'No se identificó cantidad de piezas'};
 if(requested!==linkedOrder.piezas)return {status:'revisar',label:'Posible diferencia de piezas',solicitadas:requested,registradas:linkedOrder.piezas};
 return {status:'coincide',label:'La cantidad de piezas coincide'};
}
function secretKey(key){
 const b=Buffer.from(String(key||''),'base64');
 if(b.length!==32)throw Error('Clave de cifrado privada inválida.');
 return b;
}
function customerHash(customer,key){
 return crypto.createHmac('sha256',secretKey(key)).update('wa-customer-v1:'+customer).digest('hex');
}
function seal(text,key,aad){
 const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',secretKey(key),iv);
 c.setAAD(Buffer.from(String(aad)));
 const ct=Buffer.concat([c.update(String(text),'utf8'),c.final()]);
 return [iv.toString('base64'),c.getAuthTag().toString('base64'),ct.toString('base64')].join('.');
}
function unseal(value,key,aad){
 const x=String(value||'').split('.');
 if(x.length!==3)throw Error('Registro cifrado inválido.');
 const d=crypto.createDecipheriv('aes-256-gcm',secretKey(key),Buffer.from(x[0],'base64'));
 d.setAAD(Buffer.from(String(aad)));d.setAuthTag(Buffer.from(x[1],'base64'));
 return Buffer.concat([d.update(Buffer.from(x[2],'base64')),d.final()]).toString('utf8');
}
module.exports={STORES,verifiedSignature,phone,storeMap,extractMessages,classify,pieces,comparePieces,customerHash,seal,unseal};
