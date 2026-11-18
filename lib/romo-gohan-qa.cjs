'use strict';
/**
 * Validación previa de gohan Romo para usar el motor original de la carta.
 * No sustituye la cotización comercial ni autoriza pedidos.
 */
const ALLOWED=Object.freeze({
 'gohan-vegetariano':2,
 'gohan-pollo':1,
 'gohan-camaron':1,
 'gohan-salmon':1
});
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function fail(message){const e=new Error(message);e.status=400;throw e}
function validarGohanRomoQA(vista,item){
 if(!OBJ(vista)||vista.storeId!==STORE||vista.ok!==true||
    vista.readOnly!==true||vista.draftOnly!==true||
    vista.publishable!==false||!Array.isArray(vista.products)||
    !Array.isArray(vista.ingredients)||vista.ingredients.length<20)
  fail('Vista Romo no verificada');
 if(!OBJ(item)||Object.keys(item).some(k=>!
    ['kind','productId','qty','vegetables','sauce','sinQueso','note'].includes(k))||
    item.kind!=='dish'||!Object.hasOwn(ALLOWED,item.productId)||
    !Number.isSafeInteger(item.qty)||item.qty<1||item.qty>20||
    !Array.isArray(item.vegetables)||item.vegetables.length!==ALLOWED[item.productId]||
    new Set(item.vegetables).size!==item.vegetables.length||
    !['Soya','Teriyaki'].includes(item.sauce)||
    (item.sinQueso!==undefined&&typeof item.sinQueso!=='boolean')||
    (item.note!==undefined&&(typeof item.note!=='string'||item.note.length>350)))
  fail('Completa los vegetales distintos y la salsa del gohan');
 const p=vista.products.find(x=>x.sku==='dish:'+item.productId);
 if(!p||p.available!==true||p.draftOnly===true)
  fail('Gohan no disponible en esta carta de Romo');
 for(const name of item.vegetables){
  if(typeof name!=='string'||name.length>100||name==='Palta')
   fail('Palta ya está incluida; selecciona otro vegetal');
  const veg=vista.ingredients.find(x=>
   (x.category==='Vegetales'||x.category==='vegetal')&&
   x.name===name&&x.available!==false&&
   (x.draftOnly===true?x.surfaces?.includes('gohan'):
    Number.isSafeInteger(x.contexts?.clasicas)));
  if(!veg)fail('Vegetal no disponible para gohan: '+name);
 }
 const sauce=vista.ingredients.find(x=>
  (x.category==='Salsas'||x.category==='salsa')&&x.name===item.sauce&&
  x.available!==false&&Number.isSafeInteger(x.contexts?.salsas_incluidas));
 if(!sauce)fail('Salsa agotada o no incluida en Romo');
 return Object.freeze({ok:true,storeId:STORE,
  sku:'dish:'+item.productId,vegetales:item.vegetables.length,
  soloPrueba:true,canSendOrder:false,canPay:false});
}
module.exports={validarGohanRomoQA};
