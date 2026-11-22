'use strict';
// Solo validación de datos normalizados por el servidor, no sustituye autenticación.
// items y products deben provenir del catálogo e inventario autorizado de la sucursal.
function buildValidation(){
const units={kg:'mass',g:'mass',l:'volume',ml:'volume',un:'count'};
const storeSet=new Set(['uki:arica','uki:serena','romo:serena']);
function key(v){return typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=180;}
function quantity(v){if(typeof v==='string'){if(!/^\d+(?:[.,]\d{1,6})?$/.test(v.trim()))return null;v=Number(v.trim().replace(',','.'));}return typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=100000000&&Math.abs(v*1e6-Math.round(v*1e6))<0.00001?v:null;}
function resolve(store,sku,items){const matches=items.filter(i=>i.store===store&&i.sku===sku&&i.archived!==true);return matches.length===1?matches[0]:null;}
function validatePrice(store,input,items){if(!storeSet.has(store)||!input||!key(input.sku))throw Error('Sucursal o ingrediente inválido');const item=resolve(store,input.sku,items),n=quantity(input.quantity);if(!item||!units[item.stock_unit]||units[input.unit]!==units[item.stock_unit]||n===null||!Number.isSafeInteger(input.price)||input.price<=0||input.price>1000000000)throw Error('Revisa ingrediente, cantidad, unidad y precio de compra.');return {store,sku:input.sku,unit:input.unit,quantity:n,price:input.price};}
function validateRecipe(store,input,items,products){if(!storeSet.has(store)||!input||!key(input.productSku)||!key(input.variantKey)||!products.some(p=>p.store===store&&p.sku===input.productSku&&p.archived!==true))throw Error('Producto o sucursal inválido');if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)throw Error('Registra los ingredientes de la receta.');const seen=new Set();const recipe=input.lines.map(line=>{if(!line||!key(line.sku)||seen.has(line.sku))throw Error('Ingrediente inválido o repetido.');seen.add(line.sku);const item=resolve(store,line.sku,items),n=quantity(line.quantity);if(!item||!units[item.stock_unit]||units[line.unit]!==units[item.stock_unit]||n===null)throw Error('Revisa las unidades y cantidades de los ingredientes.');return {sku:line.sku,quantity:n,unit:line.unit};});return {store,productSku:input.productSku,variantKey:input.variantKey,recipe,confirmed:false};}
return {validatePrice,validateRecipe};
}
module.exports=buildValidation();
