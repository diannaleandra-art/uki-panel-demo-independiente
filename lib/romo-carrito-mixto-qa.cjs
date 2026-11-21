'use strict';
/**
 * Carrito mixto de cotización PRIVADA Romo QA.
 * Cada promoción se recalcula por servidor en la misma revisión del catálogo.
 * No genera compras, recibos, cobros, órdenes ni conexiones a WhatsApp.
 */
const {simularCarritoBorradorRomoQA}=require('./romo-carrito-borrador-qa.cjs');
const {simularPromocionRomoQA}=require('./romo-promocion-armado-qa.cjs');
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const INT=x=>Number.isSafeInteger(x);
const fail=message=>{const e=new Error(message);e.status=400;throw e;};
const keys=(o,allow)=>OBJ(o)&&Object.keys(o).every(x=>allow.includes(x));
const ALLOWED_PAYMENT=['efectivo','transferencia','debito','credito','edenred','junaeb'];
function cotizarPromoSinArmadoRomoQA(vista,p,qty,payment,config){
 if(!p||p.draftOnly!==true||p.kind!=='monthly'||
    !['combo','gohan'].includes(p.promoType)||p.available!==true||
    !INT(p.rollCount)||p.rollCount!==0||
    !INT(p.sauceCount)||p.sauceCount<0||p.sauceCount>1||
    !INT(p.korokes)||p.korokes<0||p.korokes>30||
    !INT(p.precioFinal)||p.precioFinal<1||
    !Array.isArray(p.payments)||!p.payments.includes(payment))
  fail('La promoción de combo o gohan requiere una ficha sin rolls y un pago aprobado');
 const sauces=config.sauces??[];
 if(!keys(config,['sauces'])||!Array.isArray(sauces)||sauces.length!==p.sauceCount||sauces.some(name=>!['Soya','Teriyaki'].includes(name)||!vista.ingredients?.some(i=>i.category==='Salsas'&&i.name===name&&i.available!==false)))fail('Selecciona la salsa incluida y disponible de la promoción');
 const subtotal=p.precioFinal*qty;
 if(!INT(subtotal)||subtotal>3000000)fail('Importe de promoción fuera de rango');
 return {sku:p.sku,name:p.name,kind:'monthly',
   promoType:p.promoType,qty,unitario:p.precioFinal,
   importe:subtotal,recargos:0,korokes:p.korokes,
   requiereArmado:false,salsas:sauces,
   nota:'Oferta fija con las salsas incluidas seleccionadas. No sustituye recetas personalizables.'};
}
function simularCarritoMixtoRomoQA(vista,input){
 if(!OBJ(vista)||vista.ok!==true||vista.storeId!==STORE||
    vista.draftOnly!==true||vista.readOnly!==true||
    vista.publishable!==false||!INT(vista.revisionComercial)||
    vista.revisionComercial<1||!INT(vista.revisionAdministracion)||
    !Array.isArray(vista.products)||vista.products.length<40)fail('Catálogo de Romo no verificado');
 if(!keys(input,['action','revisionComercial','revisionAdministracion','payment','items'])||
    input.action!=='simularMixto'||input.revisionComercial!==vista.revisionComercial||
    input.revisionAdministracion!==vista.revisionAdministracion||
    !ALLOWED_PAYMENT.includes(input.payment)||!Array.isArray(input.items)||
    input.items.length<1||input.items.length>35||JSON.stringify(input).length>18000)
  fail('Carrito inválido o versión desactualizada');
 const map=new Map();
 for(const p of vista.products){
  if(!OBJ(p)||typeof p.sku!=='string'||map.has(p.sku))fail('Catálogo con identificadores duplicados');
  map.set(p.sku,p);
 }
 const lines=[],seen=new Set();
 let subtotal=0,qtyTotal=0,hasConfigured=false;
 for(const raw of input.items){
  if(!keys(raw,['sku','qty','config'])||typeof raw.sku!=='string'||
     raw.sku.length>100||!INT(raw.qty)||raw.qty<1||raw.qty>20)
   fail('Línea inválida en carrito mixto');
  const p=map.get(raw.sku);
  if(!p||p.available!==true)fail('Producto desconocido o agotado');
  if(seen.has(raw.sku))fail('Producto repetido: combina cantidades antes de calcular');
  seen.add(raw.sku);
  let line;
  if(p.kind==='monthly'&&p.draftOnly===true){
   if(!OBJ(raw.config))fail('Completa la configuración de la promoción nueva');
   if(p.promoType==='sushi'){
    if(!keys(raw.config,['rolls','sauces']))fail('Armado de promoción inválido');
    const q=simularPromocionRomoQA(vista,{
     action:'simularPromocion',sku:p.sku,qty:raw.qty,
     revisionComercial:vista.revisionComercial,
     revisionAdministracion:vista.revisionAdministracion,
     rolls:raw.config.rolls,sauces:raw.config.sauces,
     payment:input.payment
    });
    line={sku:p.sku,name:p.name,kind:'monthly',promoType:'sushi',
     qty:raw.qty,unitario:q.unitarioReferencia,importe:q.subtotalProductos,
     recargos:q.recargosArmado,piezas:q.piezas,korokes:q.korokes,
     requiereArmado:true,rolls:q.rolls,salsas:q.salsas};
   }else{
    line=cotizarPromoSinArmadoRomoQA(vista,p,raw.qty,input.payment,raw.config);
   }
   hasConfigured=true;
  }else{
   if(raw.config!==undefined)fail('La configuración no corresponde a este producto');
   if(['classic','premium','monthly'].includes(p.kind)||
      (p.kind==='dish'&&(/^dish:(gohan-|sushi-burger)/.test(p.sku))))
    fail('Este producto requiere el armado original; no se puede cotizar como producto simple');
   const q=simularCarritoBorradorRomoQA(vista,{
    action:'simular',revisionComercial:vista.revisionComercial,
    revisionAdministracion:vista.revisionAdministracion,
    items:[{sku:p.sku,qty:raw.qty}]
   });
   const base=q.lineas[0];
   line={sku:p.sku,name:p.name,kind:p.kind,qty:raw.qty,
    unitario:base.unitario,importe:base.importe,
    requiereArmado:false};
  }
  subtotal+=line.importe;qtyTotal+=raw.qty;
  if(!INT(subtotal)||subtotal>3000000||qtyTotal>100)
   fail('Carrito fuera de límites de la prueba');
  lines.push(line);
 }
 return Object.freeze({
  ok:true,storeId:STORE,readOnly:true,draftOnly:true,
  simulacion:true,status:'mixto-qa-sin-pedidos',
  countsAsSale:false,canSendOrder:false,canPay:false,
  canPublish:false,
  revisionComercial:vista.revisionComercial,
  revisionAdministracion:vista.revisionAdministracion,
  paymentValidated:input.payment,
  qtyTotal,subtotalProductos:subtotal,
  lineas:lines,promocionesConfiguradas:hasConfigured,
  deliveryFee:null,totalComercial:null,
  advertencia:'Carrito mixto exclusivo de dueños. Sin despacho, cobro, promociones públicas ni pedidos reales; los productos que necesitan el armado original deben cotizarse por separado.'
 });
}
module.exports={simularCarritoMixtoRomoQA};
