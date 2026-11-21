'use strict';
const {validIngredient}=require('./romo-carta-administracion-qa.cjs');
const TYPES=['classic','premium','monthly','handroll','burger','gohan','sauces'];
const GROUPS=['proteinas','vegetales','envolturas','proteinasExtra','salsas'];
const category=x=>({'Proteínas':'proteinas','Vegetales':'vegetales','Envolturas':'envolturas','Salsas':'salsas',salsa:'salsas',proteina:'proteinas',vegetal:'vegetales',envoltura:'envolturas'})[x];
const norm=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function validate(config){
 if(config==null)return null;
 if(typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!TYPES.includes(k)))throw Error('Configuración de ingredientes inválida');
 for(const [surface,g] of Object.entries(config)){
  if(!g||typeof g!=='object'||Object.keys(g).some(k=>!GROUPS.includes(k)))throw Error('Grupo de ingredientes inválido');
  for(const list of Object.values(g)){
   if(!Array.isArray(list)||list.length>150)throw Error('Demasiados ingredientes');
   const seen=new Set();
   for(const x of list){
    if(!x||typeof x.name!=='string'||x.name.trim().length<2||x.name.length>100||/[\r\n\u0000-\u001f*]/.test(x.name)||!Number.isSafeInteger(x.price)||x.price<0||x.price>50000||typeof x.available!=='boolean'||seen.has(norm(x.name)))throw Error('Ingrediente inválido o duplicado en '+surface);
    seen.add(norm(x.name));
   }
  }
 }
 return config;
}
function project(base,data){
 const out=Object.fromEntries(TYPES.map(x=>[x,Object.fromEntries(GROUPS.map(y=>[y,[]]))]));
 const original=new Map(base.ingredients.map(x=>[x.sku,x]));
 function add(surface,group,name,price,available){
  out[surface][group].push({name,price,available});
 }
 for(const [sku,patch] of Object.entries(data.ingredientOverrides||{})){
  const i=original.get(sku);if(!i||!patch||typeof patch!=='object')throw Error('Ingrediente original no identificado');
  const g=category(i.category);
  // The included-sauce counters are not yet dynamic. Reject, rather than
  // silently claiming to publish a sauce change that checkout cannot enforce.
  if(!g)throw Error('Los cambios de salsas todavía requieren el motor comercial de salsas');
  const c={...i.contexts,...(patch.contexts||{})},available=patch.available!==false;
  if(g==='salsas'){if(Object.values(c).some(v=>v!==0))throw Error('Las salsas incluidas no tienen recargo');add('sauces','salsas',i.name,0,available);continue;}
  const changed=(k)=>Object.hasOwn(patch.contexts||{},k)||!available;
  for(const [surface,context] of [['classic','clasicas'],['premium','premium']])
   if(Object.hasOwn(c,context)&&changed(context))add(surface,g,i.name,c[context],available);
  if(g==='vegetales'&&Object.hasOwn(c,'clasicas')&&changed('clasicas'))
   for(const surface of ['monthly','handroll','burger','gohan'])add(surface,g,i.name,c.clasicas,available);
  if(g==='proteinas'||g==='envolturas'){
   const monthlyContext=Object.hasOwn(c,'mensual_extra');
   const originalFree=g==='proteinas'?['Pollo','Kanicama','Berenjena crispy']:['Panko','Tempura','Sésamo','Ciboulette','Pepino','Nori','Mixta'];
   if(monthlyContext&&changed('mensual_extra')){
    for(const surface of ['monthly','handroll']){
     if(surface==='handroll'&&g==='envolturas')continue;
     add(surface,g,i.name,c.mensual_extra,available);
     if(g==='proteinas')add(surface,'proteinasExtra',i.name,c.mensual_extra,available);
    }
   }else if(!available&&originalFree.includes(i.name)){
    add('monthly',g,i.name,0,false);
    if(g==='proteinas'||['Panko','Tempura'].includes(i.name))add('handroll',g,i.name,0,false);
   }
  }
  if(g==='proteinas'&&Object.hasOwn(c,'burger_extra')&&changed('burger_extra')){
   add('burger','proteinasExtra',i.name,c.burger_extra,available);
   if(!available)add('burger','proteinas',i.name,0,false);
  }
 }
 for(const i of data.ingredients||[]){
  const item=Object.fromEntries(['name','category','surcharge','surfaces','available'].map(k=>[k,i[k]]));validIngredient(item);
  const g=category(i.category);
  // Distinct names across all of Romo, even when the approved option only
  // exists in premium. Expansion of an existing ingredient is a separate edit.
  if(base.ingredients.some(x=>category(x.category)===g&&norm(x.name)===norm(i.name)))throw Error('Ingrediente ya existe en el catálogo original');
  for(const surface of i.surfaces){add(surface,g,i.name,i.surcharge,i.available);
   if(g==='proteinas'&&['monthly','handroll','burger'].includes(surface))add(surface,'proteinasExtra',i.name,i.surcharge,i.available);
  }
 }
 const compact=Object.fromEntries(Object.entries(out).filter(([,g])=>Object.values(g).some(l=>l.length)));
 const sauces=new Map(base.ingredients.filter(x=>category(x.category)==='salsas').map(x=>[norm(x.name),true]));
 for(const s of compact.sauces?.salsas||[])sauces.set(norm(s.name),s.available);
 if(![...sauces.values()].some(Boolean))throw Error('Debe quedar al menos una salsa incluida disponible');
 return validate(compact);
}
module.exports={validate,project};
