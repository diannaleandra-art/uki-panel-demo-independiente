'use strict';
/**
 * Cotizador PRIVADO de carrito de prueba sobre la proyección Romo QA.
 * No acepta precios de navegador, no calcula extras del armado, ni delivery,
 * ni pagos. Jamás crea pedidos. Sus importes NO son cotizaciones comerciales.
 */
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const INT=x=>Number.isSafeInteger(x);
const MONEY=x=>INT(x)&&x>=1&&x<=1000000;
class RomoCarritoBorradorError extends Error{
 constructor(message){super(message);this.status=400;}
}
const fail=x=>{throw new RomoCarritoBorradorError(x);};
function simularCarritoBorradorRomoQA(vista,input){
 if(!OBJ(vista)||vista.ok!==true||vista.storeId!==STORE||
    vista.readOnly!==true||vista.draftOnly!==true||
    vista.publishable!==false||!INT(vista.revisionComercial)||
    vista.revisionComercial<1||!INT(vista.revisionAdministracion)||
    vista.revisionAdministracion<0||!Array.isArray(vista.products)||
    vista.products.length<40||vista.products.length>180)
  fail('La carta Romo no está validada para simulación');
 if(!OBJ(input)||Object.keys(input).some(k=>!
    ['action','revisionComercial','revisionAdministracion','items'].includes(k))||
    input.action!=='simular'||input.revisionComercial!==vista.revisionComercial||
    input.revisionAdministracion!==vista.revisionAdministracion)
  fail('La carta cambió; actualiza antes de calcular el carrito');
 if(!Array.isArray(input.items)||input.items.length<1||input.items.length>35)
  fail('El carrito de pruebas debe tener entre 1 y 35 productos');
 const mapa=new Map();
 for(const product of vista.products){
  if(!OBJ(product)||typeof product.sku!=='string'||product.sku.length>100||
     mapa.has(product.sku)||!MONEY(product.precioOriginal)||
     !MONEY(product.precioFinal)||typeof product.available!=='boolean')
   fail('Un producto Romo de la vista previa es inválido');
  mapa.set(product.sku,product);
 }
 let subtotal=0,qtyTotal=0;
 const seen=new Set(),lines=[];
 for(const item of input.items){
  if(!OBJ(item)||Object.keys(item).sort().join('|')!=='qty|sku'||
     typeof item.sku!=='string'||item.sku.length>100||
     !INT(item.qty)||item.qty<1||item.qty>20||seen.has(item.sku))
    fail('Producto o cantidad duplicados o inválidos');
  seen.add(item.sku);
  const product=mapa.get(item.sku);
  if(!product)fail('Uno de los productos no pertenece a Romo');
  if(product.available!==true)fail('Hay productos agotados en el carrito');
  const line=product.precioFinal*item.qty;
  if(!INT(line)||line>3000000)fail('Importe de línea fuera de rango');
  subtotal+=line;qtyTotal+=item.qty;
  if(!INT(subtotal)||subtotal>3000000||qtyTotal>100)
    fail('El carrito supera los límites de la prueba');
  lines.push({
   sku:item.sku,name:product.name,kind:product.kind,
   categoriaSlug:product.categoriaSlug||'',
   qty:item.qty,precioOriginal:product.precioOriginal,
   descuentoPorcentaje:product.descuentoPorcentaje||0,
   unitario:product.precioFinal,importe:line,
   requiereArmado:['classic','premium','monthly'].includes(product.kind)
  });
 }
 return Object.freeze({
  ok:true,storeId:STORE,readOnly:true,draftOnly:true,simulacion:true,
  countsAsSale:false,canSendOrder:false,canPay:false,
  status:'qa-carrito-sin-pedidos',
  revisionComercial:vista.revisionComercial,
  revisionAdministracion:vista.revisionAdministracion,
  qtyTotal,subtotalProductos:subtotal,deliveryFee:null,totalComercial:null,
  lineas:lines,
  advertencia:'Subtotal de referencia de productos sin extras ni personalización. No incluye delivery, medios de pago, descuentos externos ni costos del armado. No se puede enviar ni cobrar un pedido.'
 });
}
module.exports={simularCarritoBorradorRomoQA,RomoCarritoBorradorError};