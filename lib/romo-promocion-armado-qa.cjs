'use strict';
/**
 * Simulación PRIVADA de promociones NUEVAS de Romo.
 * Valida el armado completo desde la proyección auditada de Neon; no
 * escribe pedidos, no habilita pagos ni publica promociones a clientes.
 */
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const INT=x=>Number.isSafeInteger(x);
const fail=message=>{const e=new Error(message);e.status=400;throw e;};
const cat=x=>({'proteina':'proteina','Proteínas':'proteina','vegetal':'vegetal','Vegetales':'vegetal',
  'envoltura':'envoltura','Envolturas':'envoltura','Salsas':'salsa'})[x]||null;
const key=(category,name)=>category+'|'+name;
const badNames=new Set(['Jamón serrano','Salmón ahumado','Salmón palta']);
function simularPromocionRomoQA(vista,input){
 if(!OBJ(vista)||vista.ok!==true||vista.storeId!==STORE||
    vista.draftOnly!==true||vista.publishable!==false||vista.readOnly!==true||
    !INT(vista.revisionComercial)||vista.revisionComercial<1||
    !INT(vista.revisionAdministracion)||vista.revisionAdministracion<0||
    !Array.isArray(vista.products)||vista.products.length<40||
    !Array.isArray(vista.ingredients)||vista.ingredients.length<20)fail('La carta Romo QA no está verificada');
 if(!OBJ(input)||Object.keys(input).some(x=>![
    'action','sku','qty','rolls','sauces','payment',
    'revisionComercial','revisionAdministracion'].includes(x))||
    input.action!=='simularPromocion'||input.revisionComercial!==vista.revisionComercial||
    input.revisionAdministracion!==vista.revisionAdministracion)
  fail('La revisión cambió; actualiza la carta antes de cotizar');
 if(typeof input.sku!=='string'||!/^promo:[a-z0-9-]{5,80}$/i.test(input.sku)||
    !INT(input.qty)||input.qty<1||input.qty>20||
    typeof input.payment!=='string'||input.payment.length>30)
  fail('Promoción de prueba inválida');
 const promo=vista.products.find(x=>x.sku===input.sku);
 if(!promo||promo.kind!=='monthly'||promo.draftOnly!==true||
    promo.promoType!=='sushi'||promo.available!==true)
  fail('Solo promociones de sushi creadas en Romo QA admiten este armado');
 if(!INT(promo.rollCount)||promo.rollCount<1||promo.rollCount>20||
    ![10,12].includes(promo.piecesPerRoll)||
    !INT(promo.sauceCount)||promo.sauceCount<0||promo.sauceCount>20||
    !INT(promo.korokes)||promo.korokes<0||promo.korokes>30||
    !Array.isArray(promo.payments)||!promo.payments.includes(input.payment)||
    !INT(promo.precioFinal)||promo.precioFinal<1)
  fail('Configuración o medio de pago no aprobado para la promoción');
 if(!Array.isArray(input.rolls)||input.rolls.length!==promo.rollCount||
    !Array.isArray(input.sauces)||input.sauces.length!==promo.sauceCount||
    input.rolls.length>20||JSON.stringify(input).length>15000)
  fail('Debes completar todos los rolls y las salsas incluidas');
 const ingredients=new Map();
 for(const entry of vista.ingredients){
  if(!OBJ(entry)||typeof entry.name!=='string'||entry.name.length>100||
     typeof entry.sku!=='string')fail('Ingrediente del catálogo inválido');
  const category=cat(entry.category);
  if(!category)continue;
  const k=key(category,entry.name);
  if(ingredients.has(k))fail('Ingrediente repetido en la carta de Romo');
  ingredients.set(k,entry);
 }
 function get(category,name,role){
  if(typeof name!=='string'||name.length<2||name.length>100)fail('Ingrediente no seleccionado');
  const product=ingredients.get(key(category,name));
  if(!product||product.available===false)fail('Ingrediente agotado o desconocido: '+name);
  if(product.draftOnly===true){
   if(!Array.isArray(product.surfaces)||!product.surfaces.includes('monthly')||
      !INT(product.surcharge)||product.surcharge<0||product.surcharge>50000)
    fail('Ingrediente no habilitado para promociones de Romo');
   return product.surcharge;
  }
  const contexts=product.contexts||{};
  const compatible=category==='vegetal'?Object.hasOwn(contexts,'clasicas'):
    category==='salsa'?Object.hasOwn(contexts,'salsas_incluidas'):
    Object.hasOwn(contexts,'clasicas')||Object.hasOwn(contexts,'mensual_extra');
  if(!compatible)fail('Ingrediente no disponible para esta preparación: '+name);
  const price=role==='mensual_extra'
    ?(contexts.mensual_extra??contexts.clasicas)
    :contexts.clasicas;
  if(!INT(price)||price<0||price>50000)fail('Recargo de ingrediente inválido');
  return price;
 }
 // Cada promoción nueva de sushi usa la estructura de rolls de la carta
 // original, pero no hereda beneficios de tamaños que no fueron aprobados.
 const lineas=[];
 let recargos=0;
 for(let i=0;i<input.rolls.length;i++){
  const roll=input.rolls[i];
  if(!OBJ(roll)||Object.keys(roll).some(x=>![
     'protein','vegetable','vegetable2','wrap','vegetariano','soloProteina','sinNori','sinQueso'].includes(x)))
    fail('Roll '+(i+1)+' contiene campos inválidos');
  for(const flag of ['vegetariano','soloProteina','sinNori','sinQueso'])
   if(roll[flag]!==undefined&&typeof roll[flag]!=='boolean')fail('Opción de roll inválida');
  const vegetariano=roll.vegetariano===true,solo=roll.soloProteina===true;
  if(vegetariano&&solo)fail('El roll vegetariano no puede ser solo proteína');
  if(vegetariano&&(roll.protein||roll.vegetable===roll.vegetable2||!roll.vegetable2))
   fail('El roll vegetariano requiere dos vegetales distintos y sin proteína');
  if(!vegetariano&&(!roll.protein||roll.vegetable2))fail('El roll clásico requiere una proteína y un vegetal');
  if(solo&&(roll.vegetable||roll.vegetable2))fail('Solo proteína no admite vegetales');
  if(!solo&&!roll.vegetable)fail('Selecciona los vegetales del roll');
  let extra=0;
  if(!vegetariano)extra+=get('proteina',roll.protein,'mensual_extra');
  if(roll.vegetable)extra+=get('vegetal',roll.vegetable,'clasicas');
  if(roll.vegetable2)extra+=get('vegetal',roll.vegetable2,'clasicas');
  if(vegetariano&&badNames.has(roll.wrap))fail('La envoltura elegida no es vegetariana');
  if(roll.sinNori===true&&roll.wrap==='Nori')fail('Sin nori no admite esa envoltura');
  extra+=get('envoltura',roll.wrap,'mensual_extra');
  recargos+=extra;
  lineas.push({roll:i+1,proteina:vegetariano?'Vegetariano':roll.protein,
   vegetales:solo?[]:[roll.vegetable,...(roll.vegetable2?[roll.vegetable2]:[])],
   envoltura:roll.wrap,recargo:extra,vegetariano,soloProteina:solo,
   sinNori:roll.sinNori===true,sinQueso:roll.sinQueso===true});
 }
 for(const sauce of input.sauces){
  if(!['Soya','Teriyaki'].includes(sauce))fail('Solo se admiten salsas de Romo aprobadas');
  get('salsa',sauce,'clasicas');
 }
 const unitario=promo.precioFinal+recargos;
 const subtotal=unitario*input.qty;
 if(!INT(recargos)||recargos<0||recargos>500000||
    !INT(subtotal)||subtotal<1||subtotal>3000000)fail('Subtotal de promoción fuera de rango');
 return Object.freeze({
  ok:true,storeId:STORE,readOnly:true,draftOnly:true,
  simulacion:true,status:'promo-personalizada-qa-sin-pedidos',
  countsAsSale:false,canSendOrder:false,canPay:false,
  revisionComercial:vista.revisionComercial,
  revisionAdministracion:vista.revisionAdministracion,
  sku:promo.sku,name:promo.name,cantidad:input.qty,
  piezas:promo.rollCount*promo.piecesPerRoll,
  korokes:promo.korokes,paymentValidated:input.payment,
  baseConDescuento:promo.precioFinal,
  recargosArmado:recargos,unitarioReferencia:unitario,
  subtotalProductos:subtotal,totalComercial:null,deliveryFee:null,
  rolls:lineas,salsas:input.sauces,
  aviso:'Promoción Romo de pruebas: se comprobaron rolls, recargos, salsas y medio de pago permitido. No envía ni cobra pedidos.'
 });
}
module.exports={simularPromocionRomoQA};
