'use strict';
/*
 * Seguimiento unificado para Uki y Romo. Reglas puras; sin acceso a cuentas,
 * sin envío de WhatsApp ni escritura de caja. Los backends permanecen separados.
 */
const STORES=Object.freeze({
 'uki:arica':Object.freeze({name:'Uki Regimiento Arica',brand:'uki',branch:'arica'}),
 'uki:serena':Object.freeze({name:'Uki La Serena',brand:'uki',branch:'serena'}),
 'romo:serena':Object.freeze({name:'Romo Sushi La Serena',brand:'romo',branch:'serena'})
});
const METHODS=new Set(['transferencia','efectivo','debito','credito','edenred','junaeb','otro']);
const PAYMENT_STATES=new Set(['pendiente','avisada','confirmada']);
const ORDER_STATES=new Set(['pendiente','aceptada','rechazada','en_preparacion','lista','en_camino','entregada','cancelada']);
function store(id){return Object.prototype.hasOwnProperty.call(STORES,id)?STORES[id]:null}
function validMoney(v){return Number.isSafeInteger(v)&&v>=0&&v<=100000000}
function normalizeMethod(v){const x=String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return METHODS.has(x)?x:null}
function transferDue(payments,total){
 if(!validMoney(total)||!Array.isArray(payments)||payments.length===0||payments.length>8)return null;
 let sum=0,transfer=0;
 for(const p of payments){
  const method=normalizeMethod(p?.medio),amount=p?.monto;
  if(!method||!validMoney(amount)||amount<=0)return null;
  sum+=amount;if(method==='transferencia')transfer+=amount;
 }
 return sum===total?transfer:null;
}
function bankDetailsFor(storeId,verifiedByStore){
 if(!store(storeId)||!verifiedByStore||typeof verifiedByStore!=='object')return null;
 const b=verifiedByStore[storeId];
 if(!b||b.verificado!==true||b.sucursal!==storeId||typeof b.banco!=='string'||!b.banco.trim()||b.banco.length>80)return null;
 for(const field of ['titular','rut','tipo','cuenta','correo']){
  if(typeof b[field]!=='string'||b[field].trim().length<2||b[field].length>120)return null;
 }
 return {banco:b.banco,titular:b.titular,rut:b.rut,tipo:b.tipo,cuenta:b.cuenta,correo:b.correo};
}
function statusForClient({storeId,orderStatus,paymentStatus,payments,total}={}){
 if(!store(storeId)||!ORDER_STATES.has(orderStatus)||!PAYMENT_STATES.has(paymentStatus))return null;
 const transfer=transferDue(payments,total);
 if(transfer===null)return null;
 const orderLabels={pendiente:'Esperando confirmación del local',aceptada:'Pedido aceptado',
  rechazada:'Solicitud rechazada',en_preparacion:'En preparación',lista:'Listo para retirar',
  en_camino:'En camino',entregada:'Pedido entregado',cancelada:'Pedido cancelado'};
 const payment=transfer>0?(paymentStatus==='confirmada'?'Transferencia confirmada':
  paymentStatus==='avisada'?'Transferencia por verificar':'Transferencia pendiente'):'No requiere transferencia';
 return {storeId,local:store(storeId).name,pedido:orderLabels[orderStatus],pago:payment,
  montoTransferencia:transfer,confirmado:transfer>0&&paymentStatus==='confirmada'};
}
function clientTransferNotice(order,action){
 if(action!=='avisar_transferencia'||!order||!store(order.storeId)||!ORDER_STATES.has(order.estado))return false;
 const amount=transferDue(order.pagos,order.total);
 return amount!==null&&amount>0&&!['rechazada','cancelada'].includes(order.estado)&&order.estado!=='pendiente';
}
function canFinalize(order){
 if(!order||!store(order.storeId)||!validMoney(order.total)||!Array.isArray(order.pagos))return false;
 const due=transferDue(order.pagos,order.total);
 if(due===null||order.estado==='cancelada'||order.estado==='rechazada')return false;
 if(due>0&&order.estadoPagoTransferencia!=='confirmada')return false;
 // Aun con transferencia confirmada, el dinero completo debe haberse registrado y conciliado.
 return order.pagado===true&&order.cobroConfirmadoServidor===true;
}
function canConfirmTransfer({storeId,role,bankChecked,receivedAmount,due}={}){
 return !!store(storeId)&&['duenos','agendador'].includes(role)&&bankChecked===true&&
  validMoney(due)&&due>0&&validMoney(receivedAmount)&&receivedAmount===due;
}
function validateChatMessage({storeId,scope,body}={}){
 if(!store(storeId)||!['cliente','agendador'].includes(scope))return null;
 const text=typeof body==='string'?body.trim():'';
 return text.length>=1&&text.length<=800?{storeId,from:scope,body:text}:null;
}
module.exports={STORES,store,validMoney,normalizeMethod,transferDue,bankDetailsFor,statusForClient,
 clientTransferNotice,canFinalize,canConfirmTransfer,validateChatMessage};
