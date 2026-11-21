'use strict';
/**
 * Composición de lectura de la carta aprobada + borradores de administración.
 * SOLO para la vista privada de dueños en Preview, nunca para vender.
 * No modifica los 40 productos ni el guardado auditado.
 */
const {read}=require('./romo-carta-administracion-qa.cjs');
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const MONEY=x=>Number.isSafeInteger(x)&&x>=1&&x<=1000000;
function proyectarVistaAdminRomoQA(carta,row,photos=[]){
 if(!OBJ(carta)||carta.storeId!==STORE||carta.readOnly!==true||
    !Number.isSafeInteger(carta.revision)||carta.revision<1||
    !Array.isArray(carta.products)||carta.products.length<40||carta.products.length>110||carta.products.filter(p=>p.custom!==true).length!==40||
    !Array.isArray(carta.categories)||carta.categories.length<5||
    !Array.isArray(carta.ingredients)||carta.ingredients.length<20)
  throw Error('La carta oficial aprobada no está disponible para vista previa');
 const state=read(row),data=state.data;
 if(!Array.isArray(photos)||photos.length>250)throw Error('Fotografías de prueba inválidas');
 const photosMap=new Map();
 for(const item of photos){
  if(!OBJ(item)||typeof item.sku!=='string'||item.sku.length>100||
     !Number.isSafeInteger(Number(item.version))||Number(item.version)<1||
     photosMap.has(item.sku))throw Error('Estado de fotografía inválido');
  photosMap.set(item.sku,Number(item.version));
 }
 const hidden=new Set(data.categoryHidden),slugs=new Set();
 const categories=[...carta.categories,...data.categories]
  .filter(c=>!hidden.has(c.slug))
  .map(c=>({slug:c.slug,nombre:data.categoryNames[c.slug]||c.nombre}));
 for(const c of categories){
  if(!c.slug||!c.nombre||slugs.has(c.slug))throw Error('Categorías duplicadas');
  slugs.add(c.slug);
 }
 const skuSet=new Set();
 function product(raw,draft,type){
  if(!OBJ(raw)||typeof raw.sku!=='string'||skuSet.has(raw.sku)||
     !MONEY(raw.price))throw Error('Producto inválido o duplicado');
  skuSet.add(raw.sku);
  const category=(data.assignments[raw.sku]??raw.categoriaSlug??
   (type==='monthly'?'mensual':''))||'';
  const categoriaSlug=slugs.has(category)?category:'';
  const hasDraftDiscount=Object.hasOwn(data.discounts,raw.sku);
  const originalPrice=MONEY(raw.originalPrice)&&raw.originalPrice>raw.price?raw.originalPrice:raw.price;
  const percentage=Number(data.discounts[raw.sku]||0);
  if(!Number.isSafeInteger(percentage)||percentage<0||percentage>99)
   throw Error('Descuento de prueba inválido');
  const pendingChanges=draft||Boolean(data.baseProductOverrides[raw.sku])||
    Object.hasOwn(data.assignments,raw.sku)||
    percentage>0||photosMap.has(raw.sku);
  return {
   sku:raw.sku,kind:type||raw.kind,name:raw.name,
   description:raw.description||'',price:raw.price,
   precioOriginal:hasDraftDiscount?raw.price:originalPrice,descuentoPorcentaje:percentage,
   precioFinal:percentage?Math.max(1,Math.round(raw.price*(100-percentage)/100)):raw.price,
   categoriaSlug,available:raw.available!==false,
   draftOnly:draft,pendingChanges,
   source:pendingChanges?'borrador-admin-romo':'carta-aprobada',
   photoVersion:photosMap.get(raw.sku)||0,
   ...((type||raw.kind)==='monthly'?{
    promoType:raw.promoType||'sushi',rollCount:raw.rollCount,
    piecesPerRoll:raw.piecesPerRoll??12,sauceCount:raw.sauceCount,
    korokes:raw.korokes,payments:raw.payments
   }:{})
  };
 }
 const approved=carta.products.map(p=>product({
   ...p,...(data.baseProductOverrides[p.sku]||{})
 },false));
 const custom=data.products.map(p=>product(p,true,'dish'));
 const promotionsDraft=data.promotions.map(p=>product(p,true,'monthly'));
 const products=[...approved,...custom,...promotionsDraft];
 if(products.length!==carta.products.length+data.products.length+data.promotions.length)
  throw Error('Productos perdidos al formar la vista previa');
 const approvedIngredients=carta.ingredients.map(item=>{
  const x=data.ingredientOverrides[item.sku]||{};
  return {...item,contexts:{...item.contexts,...(x.contexts||{})},
   available:(x.available??item.available)!==false,draftOnly:false};
 });
 const customIngredients=data.ingredients.map(x=>({...x,draftOnly:true}));
 const promotions=products.filter(p=>p.kind==='monthly'&&
   !p.sku.endsWith(':handroll-individual')||
   p.categoriaSlug==='mensual'&&p.kind!=='monthly');
 return Object.freeze({
  ok:true,storeId:STORE,revisionComercial:carta.revision,
  revisionAdministracion:state.revision,draftOnly:true,readOnly:true,
  publishable:false,status:'vista-privada-no-publica-cotizador',
  customIngredientRulesPending:data.ingredients.length>0||
   Object.keys(data.ingredientOverrides).length>0,
  aviso:'Los borradores no cambian la carta pública ni los pedidos.',
  categories,products,ingredients:[...approvedIngredients,...customIngredients],
  promotions,
  summary:{
   baseProducts:40,newProducts:custom.length,commercialCustomProducts:carta.products.length-40,newPromotions:promotionsDraft.length,
   totalProducts:products.length,ingredients:approvedIngredients.length+customIngredients.length,
   categories:categories.length,
   discounts:products.filter(p=>p.descuentoPorcentaje>0).length,
   photos:photosMap.size
  }
 });
}
module.exports={proyectarVistaAdminRomoQA};
