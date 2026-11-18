'use strict';
/**
 * Simulador de entrega/retiro/consumo PRIVADO. La tarifa de delivery es un
 * escenario de km, no una ruta real. No se piden direcciones ni datos personales.
 * Para delivery comercial es obligatorio calcular ruta por calles con /api/route.
 */
const {simularCarritoMixtoRomoQA}=require('./romo-carrito-mixto-qa.cjs');
const MODES=new Set(['delivery','retiro','consumo']);
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=message=>{const e=new Error(message);e.status=400;throw e;};
function tarifaEscenarioKm(km){
 if(typeof km!=='number'||!Number.isFinite(km)||km<0||km>15)
  fail('Distancia simulada inválida');
 if(km>8)return null;
 if(Math.abs(km-4.5)<1e-8)return 2750;
 const raw=km<=1?1000:km<=5?1000+(km-1)*500:3000+(km-5)*200;
 return Math.min(4000,Math.max(1000,Math.ceil((raw-0.000001)/100)*100));
}
function simularModalidadRomoQA(vista,input){
 if(!OBJ(vista)||vista.storeId!==STORE||vista.ok!==true||
    vista.publishable!==false||vista.draftOnly!==true||vista.readOnly!==true)
  fail('Carta Romo QA no validada');
 if(!OBJ(input)||Object.keys(input).some(x=>![
   'action','revisionComercial','revisionAdministracion',
   'mode','payment','items','kmEscenario'].includes(x))||
   input.action!=='simularModalidad'||!MODES.has(input.mode)||
   (input.mode!=='delivery'&&input.kmEscenario!==undefined))
  fail('Modalidad inválida para pruebas');
 const available=input.mode==='delivery'
  ?['efectivo','transferencia','edenred']
  :['efectivo','transferencia','debito','edenred'];
 if(!available.includes(input.payment))
  fail('Ese medio de pago no está habilitado por la carta original en esta modalidad');
 // La promoción Junaeb y cualquier medio no contemplado se mantiene fuera
 // del cotizador mixto hasta reproducir su flujo comercial específico.
 const quote=simularCarritoMixtoRomoQA(vista,{
  action:'simularMixto',
  revisionComercial:input.revisionComercial,
  revisionAdministracion:input.revisionAdministracion,
  payment:input.payment,items:input.items
 });
 const hasKm=input.kmEscenario!==undefined;
 const fee=input.mode!=='delivery'?0:
   hasKm?tarifaEscenarioKm(input.kmEscenario):null;
 const outside=input.mode==='delivery'&&hasKm&&fee===null;
 const totalReferencia=fee!==null?quote.subtotalProductos+fee:null;
 if(totalReferencia!==null&&(!Number.isSafeInteger(totalReferencia)||totalReferencia>3004000))
  fail('Total de escenario fuera del límite');
 return Object.freeze({
  ok:true,storeId:STORE,readOnly:true,draftOnly:true,simulacion:true,
  canSendOrder:false,canPay:false,countsAsSale:false,
  mode:input.mode,paymentValidated:input.payment,
  revisionComercial:quote.revisionComercial,
  revisionAdministracion:quote.revisionAdministracion,
  productos:quote.subtotalProductos,cantidad:quote.qtyTotal,
  kmEscenario:input.mode==='delivery'&&hasKm?input.kmEscenario:null,
  tarifaEscenario:fee,referenciaSinCobro:totalReferencia,
  requiresRealRoute:input.mode==='delivery',outsideRadius:outside,
  deliveryFee:null,totalComercial:null,
  aviso:input.mode==='delivery'
   ?'Distancia y tarifa SOLO SIMULADAS; no comprueba trayecto real. El delivery comercial exige una ruta verificada por calles. No cobra ni genera pedidos.'
   :'Solo prueba de retiro o consumo; no registra pago, mesa ni pedido.'
 });
}
module.exports={simularModalidadRomoQA,tarifaEscenarioKm};
