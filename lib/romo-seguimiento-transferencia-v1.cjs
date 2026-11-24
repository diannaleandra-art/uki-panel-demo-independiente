'use strict';
/* Contrato privado de seguimiento Romo. No procesa pagos ni envía WhatsApp. */
const crypto=require('node:crypto');
const STORE='romo:serena';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY=/^[a-zA-Z0-9_-]{12,100}$/;
function secretReady(secret){return typeof secret==='string'&&secret.length>=32;}
function issueToken(id,key,secret){
 if(!ID.test(id)||!KEY.test(key)||!secretReady(secret))throw Error('Seguimiento no configurado');
 const payload=id.toLowerCase()+'.'+key;
 const mac=crypto.createHmac('sha256',secret).update('romo-seguimiento-v1:'+payload).digest('base64url');
 return payload+'.'+mac;
}
function readToken(token,secret){
 if(typeof token!=='string'||token.length>260||!secretReady(secret))return null;
 const parts=token.split('.');
 if(parts.length!==3||!ID.test(parts[0])||!KEY.test(parts[1])||!/^[a-zA-Z0-9_-]{43}$/.test(parts[2]))return null;
 const expected=issueToken(parts[0],parts[1],secret);
 const a=Buffer.from(expected),b=Buffer.from(token);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 return {id:parts[0].toLowerCase(),key:parts[1]};
}
function normalizeMethod(method){
 const value=String(method||'').trim().toLowerCase();
 return ['transferencia','efectivo','debito','edenred','junaeb'].includes(value)?value:null;
}
function money(amount){return Number.isSafeInteger(amount)&&amount>=0&&amount<=100000000?amount:null}
function transferAmount({metodo,total,transferenciaMonto}={}){
 const amount=money(total);
 if(normalizeMethod(metodo)!=='transferencia'||amount===null)return null;
 // Pagos mixtos sólo si la fuente de la carta define un monto de transferencia validado.
 if(transferenciaMonto===undefined||transferenciaMonto===null)return amount;
 const partial=money(transferenciaMonto);
 return partial!==null&&partial>0&&partial<=amount?partial:null;
}
function paymentLabel(status){
 return status==='confirmada'?'Pago confirmado':status==='avisada'?'Transferencia por verificar':'Transferencia pendiente';
}
function customerStatus({orderStatus,transferStatus,method}={}){
 const accepted=orderStatus==='aceptada';
 return {order:orderStatus==='rechazada'?'Solicitud rechazada':accepted?'Pedido aceptado':'Esperando confirmación del local',
  payment:normalizeMethod(method)==='transferencia'?paymentLabel(transferStatus):'Pago por confirmar',
  paid:normalizeMethod(method)==='transferencia'&&transferStatus==='confirmada'};
}
function canFinalize(order,confirmed){
 // La regla solo permite finalizar una transferencia si también está registrado el cobro del pedido.
 if(!order||!order.pagado||order.estado==='Cancelado')return false;
 const method=String(order.medio||'').trim().toLowerCase();
 if(method==='transferencia'&&!confirmed)return false;
 return true;
}
module.exports={STORE,ID,KEY,secretReady,issueToken,readToken,normalizeMethod,money,transferAmount,paymentLabel,customerStatus,canFinalize};
