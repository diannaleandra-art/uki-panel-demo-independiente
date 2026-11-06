'use strict';
// Catálogo Uki v1: utilidades PURAS, sin conexión a BD ni efectos sobre caja/QR.
const BRANCHES=new Set(['arica','serena']);
const PRODUCT_KINDS=new Set(['classic','premium','monthly','pizza','dish','topping','extra']);
const UNITS=new Set(['un','kg','g','l','ml','porciones']);
function branchOK(branch){return BRANCHES.has(branch);}
function slug(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);}
function skuFor(kind,id){return String(kind)+':'+slug(id);}
function item({kind,id,name,price=null,description='',group='',unit='un',available=true,custom=false}){
 const sku=skuFor(kind,id);
 return {sku,kind,name,description,group_key:group,price,available,stock_qty:0,stock_unit:unit,min_stock_qty:0,custom,version:0};
}
async function baseItems(branch){
 if(!branchOK(branch))throw Error('Sucursal no permitida');
 const [{prices,premiumPrices,proteins,premiumProteins,vegetables,premiumVegetables,
   wraps,premiumWraps,pizzas,sauceNames,extraSauceNames},
  {monthlyPromos,monthlyExtraProteins,monthlyExtraWraps},
  {dishes,toppings,burgerExtraProteins}]=await Promise.all([
  import('../public/candidata/model.mjs'),
  import('../public/candidata/monthly.mjs'),
  import('../public/candidata/catalog.mjs')
 ]);
 const base=[];
 for(const [pieces,price] of Object.entries(prices))
  base.push(item({kind:'classic',id:pieces,name:'Sushi clásico '+pieces+' piezas',price,group:'promos'}));
 for(const [pieces,price] of Object.entries(premiumPrices))
  base.push(item({kind:'premium',id:pieces,name:'Sushi premium '+pieces+' piezas',price,group:'promos'}));
 for(const p of monthlyPromos)
  base.push(item({kind:'monthly',id:p.id,name:p.name,price:p.price,description:p.description||'',group:'mensual'}));
 if(branch==='arica')for(const p of pizzas)
  base.push(item({kind:'pizza',id:p.id,name:p.name,price:p.price,description:p.ingredients,group:'pizzas'}));
 for(const p of dishes)
  base.push(item({kind:'dish',id:p.id,name:p.name,price:p.price,description:p.description||'',group:p.group||'entradas'}));
 for(const p of toppings)
  base.push(item({kind:'topping',id:p.id,name:p.name,price:p.price,group:'fusion'}));
 for(const name of extraSauceNames)
  base.push(item({kind:'extra',id:name,name:name+' adicional',price:600,group:'salsas'}));
 // El control de ingredientes es por sucursal. El inventario NUNCA cambia available.
 const ingredientes=[
  ...proteins.map(x=>['Proteína',x[0]]),
  ...premiumProteins.map(x=>['Proteína',x[0]]),
  ...monthlyExtraProteins.map(x=>['Proteína',x[0]]),
  ...burgerExtraProteins.map(x=>['Proteína',x[0]]),
  ...vegetables.map(x=>['Vegetal',x]),
  ...premiumVegetables.map(x=>['Vegetal',x]),
  ...wraps.map(x=>['Envoltura',x[0]]),
  ...premiumWraps.map(x=>['Envoltura',x[0]]),
  ...monthlyExtraWraps.map(x=>['Envoltura',x[0]]),
  ...extraSauceNames.map(x=>['Salsa',x])
 ];
 const seen=new Set();
 for(const [group,name] of ingredientes){
  const sku=skuFor('ingredient',group+'-'+name);
  if(seen.has(sku))continue;
  seen.add(sku);
  base.push({...item({kind:'ingredient',id:group+'-'+name,name,group,unit:'un'}),sku});
 }
 return base;
}
function mergeItems(base,overrides){
 const bySku=new Map(base.map(x=>[x.sku,{...x}]));
 for(const row of overrides||[]){
  if(!row||!row.sku||!row.kind)continue;
  const old=bySku.get(row.sku);
  if(!old&&!row.custom)continue;
  if(old&&old.kind!==row.kind)continue;
  if(old&&old.custom)continue;
  if(row.custom&&!(row.kind==='dish'&&row.group_key==='entradas'))continue;
  const resolved={
   ...(old||{}),sku:row.sku,kind:row.kind,
   name:String(row.name??old?.name??''),description:String(row.description??old?.description??''),
   group_key:String(row.group_key??old?.group_key??''),
   price:row.price===null?old?.price??null:Number(row.price),
   available:row.available===true,stock_qty:Number(row.stock_qty)||0,
   stock_unit:String(row.stock_unit||old?.stock_unit||'un'),min_stock_qty:Number(row.min_stock_qty)||0,custom:!!row.custom,
   version:Number(row.version)||0
  };
  if(!resolved.name.trim())continue;
  bySku.set(row.sku,resolved);
 }
 return [...bySku.values()];
}
function normalizePatch(current,patch){
 if(!current||!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Cambios no válidos');
 const allowed=new Set(['available','stock_qty','stock_unit','min_stock_qty','name','price','description']);
 if(!Object.keys(patch).length||Object.keys(patch).some(k=>!allowed.has(k)))throw Error('Campo no permitido');
 const out={...current};
 if(Object.hasOwn(patch,'available')){
  if(typeof patch.available!=='boolean')throw Error('Disponibilidad debe ser manual: sí o no');
  out.available=patch.available;
 }
 if(Object.hasOwn(patch,'stock_qty')){
  const value=Number(patch.stock_qty);
  if(patch.stock_qty===''||!Number.isFinite(value)||value<0||value>10000000||Math.abs(Math.round(value*1000)-value*1000)>1e-7)
   throw Error('Cantidad de inventario inválida');
  out.stock_qty=value;
  // No modificar «available» aquí: agotado/disponible es manual.
 }
 if(Object.hasOwn(patch,'min_stock_qty')){
  const min=Number(patch.min_stock_qty);
  if(patch.min_stock_qty===''||!Number.isFinite(min)||min<0||min>10000000||Math.abs(Math.round(min*1000)-min*1000)>1e-7)
   throw Error('Mínimo de reposición inválido');
  out.min_stock_qty=min;
  // Configurar el mínimo nunca marca el producto como agotado.
 }
 if(Object.hasOwn(patch,'stock_unit')){
  if(!UNITS.has(patch.stock_unit))throw Error('Unidad de inventario no válida');
  out.stock_unit=patch.stock_unit;
 }
 if(['name','description','price'].some(k=>Object.hasOwn(patch,k))){
  if(!PRODUCT_KINDS.has(current.kind))throw Error('Ingredientes: cambia disponibilidad e inventario; no precio aquí');
  if(Object.hasOwn(patch,'name')){
   const name=String(patch.name||'').trim();
   if(name.length<2||name.length>100)throw Error('Nombre debe tener entre 2 y 100 caracteres');
   out.name=name;
  }
  if(Object.hasOwn(patch,'description')){
   const description=String(patch.description||'').trim();
   if(description.length>500)throw Error('Descripción demasiado larga');
   out.description=description;
  }
  if(Object.hasOwn(patch,'price')){
   if(!Number.isSafeInteger(patch.price)||patch.price<0||patch.price>1000000)
    throw Error('Precio debe ser un valor entero entre 0 y 1.000.000');
   out.price=patch.price;
  }
 }
 return out;
}
function newSimpleProduct(data,uuid){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Producto no válido');
 if(typeof uuid!=='string'||!/^[a-f0-9-]{8,64}$/i.test(uuid))throw Error('Identificador no válido');
 const name=String(data.name||'').trim(),description=String(data.description||'').trim();
 if(name.length<2||name.length>100||description.length>500)throw Error('Revisa nombre o descripción');
 if(!Number.isSafeInteger(data.price)||data.price<1||data.price>1000000)throw Error('Precio no válido');
 const unit=data.stock_unit||'un';if(!UNITS.has(unit))throw Error('Unidad no válida');
 const value=Number(data.stock_qty??0);
 if(!Number.isFinite(value)||value<0||value>10000000||Math.abs(Math.round(value*1000)-value*1000)>1e-7)
  throw Error('Cantidad no válida');
 if(Object.hasOwn(data,'available')&&typeof data.available!=='boolean')throw Error('Disponibilidad no válida');
 return {sku:'dish:custom-'+uuid,kind:'dish',group_key:'entradas',custom:true,
   name,description,price:data.price,available:data.available!==false,
   stock_qty:value,stock_unit:unit,min_stock_qty:0,version:1};
}
function publicItems(items){return items.map(({stock_qty,stock_unit,min_stock_qty,custom,group_key,...x})=>
 ({...x,custom,group_key}));}
module.exports={branchOK,slug,skuFor,item,baseItems,mergeItems,normalizePatch,newSimpleProduct,publicItems,PRODUCT_KINDS};
