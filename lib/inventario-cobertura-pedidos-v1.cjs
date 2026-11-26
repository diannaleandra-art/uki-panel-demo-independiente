'use strict';
// Clasifica cobertura física sin confundir ingresos con preparación.
function classify(order){
 if(!order||typeof order!=='object')return 'review';
 if(order.estado==='Cancelado')return 'review_cancelacion';
 if(order.estado!=='Entregado')return 'review_preparacion';
 if(!Array.isArray(order.productos)||!order.productos.length)return 'review_sin_detalle';
 if(order.esPremio===true)return 'review_canje';
 if(order.pagado!==true)return 'review_entregado_sin_pago';
 return 'eligible';
}
function coverage(orders){
 if(!Array.isArray(orders))throw Error('Pedidos inválidos');
 const counts={};for(const order of orders){const k=classify(order);counts[k]=(counts[k]||0)+1;}
 return {counts,total:orders.length,pending:orders.length-(counts.eligible||0)};
}
module.exports={classify,coverage};
