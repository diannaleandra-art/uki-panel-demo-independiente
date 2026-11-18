'use strict';
/**
 * Arma subtotal exclusivamente en Vista de Dueños Romo QA.
 * Complementa el resultado del MOTOR ORIGINAL de Romo en el proyecto Carta QA
 * con el precio base/descuento del borrador de Neon. Nada se vende.
 */
const STORE='romo:serena';
const INT=x=>Number.isSafeInteger(x);
const fail=message=>{const e=new Error(message);e.status=400;throw e;};
function ensamblarArmadoRomoQA(vista,administracion,entrada,modelo){
 if(!vista||vista.ok!==true||vista.storeId!==STORE||
    vista.draftOnly!==true||vista.publishable!==false||
    !INT(vista.revisionComercial)||!INT(vista.revisionAdministracion)||
    !Array.isArray(vista.products)||vista.products.length<40)
   fail('Vista privada Romo no válida');
 if(!entrada||typeof entrada!=='object'||Array.isArray(entrada)||
    Object.keys(entrada).some(x=>!['action','item','revisionComercial','revisionAdministracion'].includes(x))||
    entrada.action!=='simularArmado'||
    entrada.revisionComercial!==vista.revisionComercial||
    entrada.revisionAdministracion!==vista.revisionAdministracion||
    !entrada.item||typeof entrada.item!=='object'||Array.isArray(entrada.item))
   fail('La carta cambió. Actualiza para simular un armado');
 // El motor oficial calcula el armado inicial; el módulo puro aplica
 // los ingredientes de la misma revisión privada de Neon Romo.
 const item=entrada.item;
 if(!INT(item.qty)||item.qty<1||item.qty>20)
  fail('Cantidad de producto inválida');
 if(!modelo||modelo.ok!==true||modelo.storeId!==STORE||
    modelo.previewOnly!==true||modelo.canSendOrder!==false||
    modelo.countsAsSale!==false||
    !INT(modelo.unitarioModelo)||!INT(modelo.precioBaseAprobado)||
    !INT(modelo.extrasModelo)||modelo.extrasModelo<0||
    modelo.unitarioModelo!==modelo.precioBaseAprobado+modelo.extrasModelo||
    modelo.cantidad!==item.qty)
   fail('El motor de Romo no confirmó el armado');
 const k=item.kind||'classic';
 const sku=['classic','premium'].includes(k)?k+':'+item.size:k+':'+item.productId;
 if(sku!==modelo.sku)fail('El producto cotizado no coincide');
 const p=vista.products.find(x=>x.sku===sku);
 if(!p||p.draftOnly===true||p.available!==true||
    !INT(p.precioOriginal)||p.precioOriginal<1||
    !INT(p.precioFinal)||p.precioFinal<1||
    p.kind!==k||!INT(p.descuentoPorcentaje)||
    p.descuentoPorcentaje<0||p.descuentoPorcentaje>99)
   fail('Producto no aprobado, deshabilitado o no compatible con armado original');
 if(!INT(modelo.extrasModelo)||modelo.extrasModelo>500000)
   fail('Los extras requieren validación especial');
 const ingredientes=require('./romo-ingredientes-armado-qa.cjs');
 const costoIngredientes=ingredientes.calcularRecargosRomoQA(vista,item,modelo);
 const subtotalBase=p.precioFinal*item.qty;
 const subtotalExtras=costoIngredientes*item.qty;
 const subtotal=subtotalBase+subtotalExtras;
 if(!INT(subtotal)||subtotal>3000000)
   fail('El subtotal supera los límites de prueba');
 return Object.freeze({
  ok:true,storeId:STORE,readOnly:true,draftOnly:true,
  simulacion:true,canSendOrder:false,canPay:false,countsAsSale:false,
  revisionComercial:vista.revisionComercial,
  revisionAdministracion:vista.revisionAdministracion,
  sku,name:p.name,cantidad:item.qty,
  precioBaseOriginal:p.precioOriginal,
  precioBaseConDescuento:p.precioFinal,
  descuentoPorcentaje:p.descuentoPorcentaje,
  recargosArmado:costoIngredientes,
  variacionIngredientes:costoIngredientes-modelo.extrasModelo,
  unitarioReferencia:p.precioFinal+costoIngredientes,
  subtotalProductos:subtotal,subtotalBase,subtotalExtras,
  deliveryFee:null,totalComercial:null,
  advertencia:'Solo simulación privada de Romo QA. La base admite descuentos y los ingredientes aprobados/personalizados de Neon se calculan con reglas originales; no incluye delivery ni medios de pago. No recibe pedidos ni se cobra.'
 });
}
module.exports={ensamblarArmadoRomoQA};
