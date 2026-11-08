'use strict';
// Normalización SOLO LECTURA de cierres operativos para el panel privado.
// No abre sesiones, no registra dinero ni toca el cierre. Un importador futuro
// tendrá que comprobar autenticación de dueños, procedencia y asignación jurídica.
const {createHash}=require('node:crypto');
const MAP=new Map([
 ['Uki Regimiento Arica','arica'],['Uki La Serena','serena'],
 ['Regimiento Arica','arica'],['La Serena','serena']
]);
const MEDIOS=new Map([
 ['Efectivo','efectivo'],['Transferencia','transferencia'],
 ['Débito','debito'],['Crédito','credito'],['Edenred','edenred'],
 ['Otros','otros'],['Uber Eats','uber_eats'],
 ['PedidosYa','pedidosya'],['Rappi','rappi']
]);
const validMoney=v=>Number.isSafeInteger(v)&&v>=0&&v<=1e9;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&
 !Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
function normalize(cierre){
 if(!cierre||typeof cierre!=='object'||Array.isArray(cierre))throw Error('Cierre inválido');
 const branch=MAP.get(cierre.suc);
 if(!branch)throw Error('Sucursal no reconocida');
 const date=cierre.fechaOperativa;
 if(!validDate(date))throw Error('Día operativo inválido');
 const closedAt=Number(cierre.fechaMs)||Date.parse(cierre.fechaISO||'');
 if(!Number.isSafeInteger(closedAt)||closedAt<1600000000000)throw Error('Cierre sin hora de confirmación');
 const medios=cierre.medios||{};
 if(!medios||typeof medios!=='object'||Array.isArray(medios))throw Error('Medios de pago inválidos');
 const payments={};
 for(const [k,val]of Object.entries(medios)){
  const key=MEDIOS.get(k);if(!key||!validMoney(val))throw Error('Medio o valor de pago inválido');
  payments[key]=val;
 }
 const sale=Number(cierre.venta);
 if(!validMoney(sale)||Object.values(payments).reduce((a,b)=>a+b,0)!==sale)
  throw Error('La venta no cuadra con los pagos del cierre');
 const orders=Number(cierre.pedidos),expenses=Number(cierre.gastos),cash=Number(cierre.efectivo);
 if(!Number.isSafeInteger(orders)||orders<0||!validMoney(expenses)||!validMoney(cash))
  throw Error('Totales del cierre inválidos');
 const sourceId=createHash('sha256').update(['uki-cierre-v1',branch,date,String(closedAt)].join('|')).digest('hex');
 // NO sumar delivery manual: es deuda/pago al repartidor, NO dinero recibido.
 return Object.freeze({
  source:'uki-cierre',sourceId,branch,day:date,closedAt,
  sale,orders,payments,expenses,cash,
  deliveryManualPayable:validMoney(Number(cierre.enviosManuales||0))?Number(cierre.enviosManuales||0):0,
  // El desglose es informativo; jamás lo sumamos a ventas o efectivo.
  sourceRef:branch+':'+date+':'+closedAt
 });
}
function planConciliacion(snapshot,existing=[]){
 if(!snapshot||snapshot.source!=='uki-cierre'||!Array.isArray(existing))
  throw Error('Conciliación inválida');
 const same=existing.filter(m=>m&&m.branch===snapshot.branch&&m.day===snapshot.day&&!m.annulled);
 if(same.some(m=>m.sourceId===snapshot.sourceId))
  return Object.freeze({status:'ya_importado',requiresConfirmation:false});
 const suspects=same.filter(m=>m.source==='manual'||m.source==='cierre')
  .filter(m=>m.sale===snapshot.sale||m.sourceRef===snapshot.sourceRef);
 if(suspects.length)return Object.freeze({status:'revisar_posible_duplicado',requiresConfirmation:true,count:suspects.length});
 return Object.freeze({status:'nuevo_pendiente_de_verificacion',requiresConfirmation:true});
}
module.exports={normalize,planConciliacion};
