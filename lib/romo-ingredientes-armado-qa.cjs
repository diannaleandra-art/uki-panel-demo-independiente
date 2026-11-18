'use strict';
/*
 * Motor PURO y privado de ingredientes Romo QA.
 * Usa la receta/base del motor comercial existente; no muta sus listas.
 * Cambios de Neon se aplican únicamente a simulaciones de dueños.
 */
const STORE='romo:serena';
const KIND=['classic','premium','monthly','dish','topping','extra'];
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const INT=x=>Number.isSafeInteger(x);
const fail=msg=>{const e=new Error(msg);e.status=400;throw e;};
const names={proteina:'Proteínas',vegetal:'Vegetales',envoltura:'Envolturas',salsa:'Salsas'};
const surfaces={classic:'classic',premium:'premium',monthly:'monthly',handroll:'handroll',
 burger:'burger',gohan:'gohan',dish:'dish',topping:'topping',extra:'extra'};
const key=(cat,name)=>cat+'|'+name;
function category(raw){
 if(['Proteínas','proteina'].includes(raw))return 'Proteínas';
 if(['Vegetales','vegetal'].includes(raw))return 'Vegetales';
 if(['Envolturas','envoltura'].includes(raw))return 'Envolturas';
 if(['Salsas','salsa'].includes(raw))return 'Salsas';
 return null;
}
function index(vista){
 if(!Array.isArray(vista?.ingredients)||vista.ingredients.length<20)
  return null; // Compatibilidad con tests antiguos; en QA real siempre llega.
 const by=new Map();
 for(const raw of vista.ingredients){
  if(!OBJ(raw)||typeof raw.name!=='string'||!raw.name.trim()||
     raw.name.length>100||typeof raw.sku!=='string')fail('Lista de ingredientes Romo inválida');
  const cat=category(raw.category);
  if(!cat||by.has(key(cat,raw.name)))fail('Ingrediente duplicado o inválido');
  if(raw.draftOnly===true){
   if(cat==='Salsas'||!INT(raw.surcharge)||raw.surcharge<0||raw.surcharge>50000||
      !Array.isArray(raw.surfaces)||raw.surfaces.length<1)
    fail('Ingrediente personalizado incompleto');
  }else{
   if(!OBJ(raw.contexts)||Object.values(raw.contexts).some(x=>!INT(x)||x<0||x>50000))
    fail('Recargos aprobados inválidos');
  }
  by.set(key(cat,raw.name),raw);
 }
 return by;
}
function surfaceFor(item){
 const k=item.kind||'classic';
 if(k==='monthly'&&item.productId==='handroll-individual')return 'handroll';
 if(k==='dish'&&['sushi-burger','sushi-burger-promo'].includes(item.productId))return 'burger';
 if(k==='dish'&&String(item.productId||'').startsWith('gohan-'))return 'gohan';
 return k;
}
function active(base,surface,cat,mode){
 if(base.draftOnly===true){
  return base.surfaces.includes(surface);
 }
 if(cat==='Salsas')return Object.hasOwn(base.contexts,'salsas_incluidas');
 if(surface==='premium')return Object.hasOwn(base.contexts,'premium');
 if(surface==='classic')return Object.hasOwn(base.contexts,'clasicas');
 if(cat==='Vegetales')return Object.hasOwn(base.contexts,'clasicas');
 if(surface==='burger'&&cat==='Proteínas'){
  return Object.hasOwn(base.contexts,'clasicas')||Object.hasOwn(base.contexts,'burger_extra');
 }
 if(surface==='monthly'||surface==='handroll'){
  if(cat==='Proteínas')return Object.hasOwn(base.contexts,'clasicas')||
   Object.hasOwn(base.contexts,'mensual_extra');
  if(cat==='Envolturas')return Object.hasOwn(base.contexts,'clasicas')||
   Object.hasOwn(base.contexts,'mensual_extra');
 }
 return Object.hasOwn(base.contexts,'clasicas');
}
function lookup(by,cat,name,surface){
 if(!name)return null;
 if(typeof name!=='string'||name.length>100)fail('Nombre de ingrediente inválido');
 const p=by.get(key(cat,name));
 if(!p||!active(p,surface,cat))fail('Ingrediente no incluido en este armado de Romo: '+name);
 if(p.available===false)fail('Ingrediente agotado: '+name);
 return p;
}
function aliasFor(cat,n){
 if(cat==='Proteínas')return 'Pollo';
 if(cat==='Envolturas')return 'Panko';
 const fallback=['Cebollín','Pepino','Tomate','Choclo','Cilantro','Pimentón','Champiñón'];
 return fallback[n%fallback.length];
}
function prepararIngredientesRomoQA(vista,item){
 if(!OBJ(vista)||vista.storeId!==STORE||!OBJ(item)||
    JSON.stringify(item).length>18000||!KIND.includes(item.kind||'classic'))
  fail('Solicitud de armado Romo inválida');
 const by=index(vista);
 const surface=surfaceFor(item),adapted=structuredClone(item);
 if(!by)return {normalizado:adapted,active:false,surface};
 if(!surfaces[surface])fail('Preparación no soportada');
 if(['dish','topping','extra'].includes(surface)&&(
   item.protein||item.wrap||(Array.isArray(item.rolls)&&item.rolls.length)||
   (Array.isArray(item.vegetables)&&item.vegetables.length)||
   (Array.isArray(item.extraProteins)&&item.extraProteins.length)||
   (Array.isArray(item.extraVegetables)&&item.extraVegetables.length)))
   fail('El producto sencillo no admite ingredientes personalizados');
 let vegetableCounter=0,custom=false;
 function process(cat,name){
  if(!name)return name;
  const p=lookup(by,cat,name,surface);
  if(p?.draftOnly===true){custom=true;return aliasFor(cat,vegetableCounter++);}
  return name;
 }
 function eachRoll(roll){
  if(!OBJ(roll))fail('Roll incompleto');
  if(roll.protein)roll.protein=process('Proteínas',roll.protein);
  if(roll.extraProtein){
   const p=lookup(by,'Proteínas',roll.extraProtein,surface);
   if(surface==='classic'&&p?.draftOnly===true)
    fail('La proteína adicional personalizada aún no admite bonificación clásica');
   roll.extraProtein=p?.draftOnly===true
    ? 'Cerdo':process('Proteínas',roll.extraProtein);
   if(p?.draftOnly===true)custom=true;
  }
  if(roll.vegetable)roll.vegetable=process('Vegetales',roll.vegetable);
  if(roll.vegetable2)roll.vegetable2=process('Vegetales',roll.vegetable2);
  if(Array.isArray(roll.vegetables))
   roll.vegetables=roll.vegetables.map(x=>process('Vegetales',x));
  if(roll.wrap)roll.wrap=process('Envolturas',roll.wrap);
 }
 if(['classic','premium','monthly'].includes(surface)||surface==='handroll'){
  if(!Array.isArray(adapted.rolls)||adapted.rolls.length>20)fail('Rolls inválidos');
  adapted.rolls.forEach(eachRoll);
  if(Array.isArray(adapted.sauces))adapted.sauces.forEach(x=>lookup(by,'Salsas',x,surface));
  if(Array.isArray(adapted.extraSauces))
   adapted.extraSauces.forEach(x=>{
    if(OBJ(x)&&Number(x.qty)>0&&['Soya','Teriyaki'].includes(x.name))
     lookup(by,'Salsas',x.name,surface);
   });
 }
 if(surface==='burger'||surface==='gohan'){
  if(adapted.protein)adapted.protein=process('Proteínas',adapted.protein);
  if(Array.isArray(adapted.vegetables))
   adapted.vegetables=adapted.vegetables.map(x=>process('Vegetales',x));
  if(Array.isArray(adapted.extraProteins))
   adapted.extraProteins=adapted.extraProteins.map(x=>({...x,name:process('Proteínas',x.name)}));
  if(Array.isArray(adapted.extraVegetables))
   adapted.extraVegetables=adapted.extraVegetables.map(x=>({...x,name:process('Vegetales',x.name)}));
  if(adapted.sauce)lookup(by,'Salsas',adapted.sauce,surface);
 }
 return {normalizado:adapted,active:true,surface,custom};
}
function costs(indexed,cat,name,surface,context,defaultCost=0){
 if(!name)return 0;
 const ingredient=lookup(indexed,cat,name,surface);
 if(ingredient.draftOnly===true)return ingredient.surcharge;
 const v=ingredient.contexts?.[context];
 if(v===undefined)return defaultCost;
 if(!INT(v)||v<0||v>50000)fail('Recargo de ingrediente inválido');
 return v;
}
function calcularRecargosRomoQA(vista,item,modelo){
 const by=index(vista);
 if(!by)return modelo.extrasModelo;
 if(!OBJ(modelo)||!OBJ(modelo.componentesModelo))fail('Falta detalle del motor original');
 const detail=modelo.componentesModelo;
 for(const field of ['surcharge','sauceExtra','toppingExtra']){
  if(!INT(detail[field])||detail[field]<0||detail[field]>500000)
   fail('El motor no confirmó los recargos del armado');
 }
 if(detail.surcharge+detail.sauceExtra+detail.toppingExtra!==modelo.extrasModelo)
  fail('Los recargos del motor original no coinciden');
 const surface=surfaceFor(item),rolls=item.rolls||[];
 let surcharge=0;
 if(surface==='classic'||surface==='premium'){
  if(!Array.isArray(detail.rolls)||detail.rolls.length!==rolls.length)
   fail('No se pudo comparar el detalle de los rolls');
  const context=surface==='classic'?'clasicas':'premium';
  for(let i=0;i<rolls.length;i++){
   const r=rolls[i],q=detail.rolls[i];
   if(!OBJ(r)||!OBJ(q)||typeof q.wrapFree!=='boolean'||
      typeof q.extraProteinFree!=='boolean'||
      !INT(q.surcharge)||q.surcharge<0||q.surcharge>50000)
    fail('Detalle de roll inválido');
   const protein=costs(by,'Proteínas',r.protein,surface,context);
   const extra=costs(by,'Proteínas',r.extraProtein,surface,context);
   const wrap=costs(by,'Envolturas',r.wrap,surface,context);
   let p=protein+(q.extraProteinFree?0:Math.max(0,extra-protein))+
     (q.wrapFree?0:wrap);
   const vegetables=surface==='premium'?r.vegetables||[]:[r.vegetable,r.vegetable2].filter(Boolean);
   for(const name of vegetables)p+=costs(by,'Vegetales',name,surface,context);
   surcharge+=p;
  }
 }else if(surface==='monthly'||surface==='handroll'){
  if(!Array.isArray(rolls)||rolls.length>20)fail('La promo no tiene rolls válidos');
  for(const r of rolls){
   const p=costs(by,'Proteínas',r.protein,surface,'mensual_extra');
   const extra=costs(by,'Proteínas',r.extraProtein,surface,'mensual_extra');
   const wrap=costs(by,'Envolturas',r.wrap,surface,'mensual_extra');
   const vegetable=costs(by,'Vegetales',r.vegetable,surface,'clasicas')+
      costs(by,'Vegetales',r.vegetable2,surface,'clasicas');
   surcharge+=p+extra+wrap+vegetable;
  }
 }else if(surface==='burger'){
  const main=({
   Pollo:0,Kanicama:0,'Berenjena crispy':0,Cerdo:800,
   'Camarón':1000,Carne:1800,'Salmón':2500
  });
  const first=lookup(by,'Proteínas',item.protein,'burger');
  if(first){
   surcharge+=first.draftOnly===true?first.surcharge:(main[item.protein]??0);
  }
  for(const p of item.extraProteins||[]){
   if(!INT(p.qty)||p.qty<0||p.qty>20)fail('Proteína extra inválida');
   surcharge+=costs(by,'Proteínas',p.name,'burger','burger_extra')*p.qty;
  }
  for(const v of item.vegetables||[])
   surcharge+=costs(by,'Vegetales',v,'burger','clasicas');
  for(const v of item.extraVegetables||[]){
   if(!INT(v.qty)||v.qty<0||v.qty>20)fail('Vegetal extra inválido');
   const increment=costs(by,'Vegetales',v.name,'burger','clasicas');
   surcharge+=(500+increment)*v.qty;
  }
 }else if(surface==='gohan'){
  for(const name of item.vegetables||[])
   surcharge+=costs(by,'Vegetales',name,'gohan','clasicas');
 }else{
  // Los platos sin armado y otros extras mantienen la cotización original.
  surcharge=detail.surcharge;
 }
 if(!INT(surcharge)||surcharge<0||surcharge>500000)
  fail('Recargos de ingredientes fuera de rango');
 const merged=surcharge+detail.sauceExtra+detail.toppingExtra;
 if(!INT(merged)||merged>500000)fail('Recargo total de prueba inválido');
 return merged;
}
module.exports={prepararIngredientesRomoQA,calcularRecargosRomoQA};
