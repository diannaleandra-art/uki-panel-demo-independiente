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
 const d=administracion?.data||{};
 // Hasta incorporar el armado editable de ingredientes: bloquear el lote
 // si hay cambios que este motor original no puede reflejar.
 if((Array.isArray(d.ingredients)&&d.ingredients.length>0)||
    (d.ingredientOverrides&&Object.keys(d.ingredientOverrides).length>0))
   fail('Los ingredientes cambiaron; falta validar sus recargos en el armado antes de calcular');
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
 const subtotalBase=p.precioFinal*item.qty;
 const subtotalExtras=modelo.extrasModelo*item.qty;
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
  recargosArmado:modelo.extrasModelo,
  unitarioReferencia:p.precioFinal+modelo.extrasModelo,
  subtotalProductos:subtotal,subtotalBase,subtotalExtras,
  deliveryFee:null,totalComercial:null,
  advertencia:'Solo prueba del armado original de Romo: descuento aplicado a la base; extras sin descuento. No incluye delivery, pagos ni recepción de pedidos. Los ingredientes creados/editados se conectarán en una fase posterior.'
 });
}
module.exports={ensamblarArmadoRomoQA};
