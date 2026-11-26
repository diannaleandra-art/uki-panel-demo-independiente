'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validatePrice,validateRecipe}=require('../lib/costeo-validacion-v1.cjs');
const {convert,calculate}=require('../lib/costeo-recetas-v1.cjs');
const {plan,compare}=require('../lib/costeo-consumo-pedido-v1.cjs');
const {baseline}=require('../lib/costeo-inicio-servicio-v1.cjs');
const {productsFor}=require('../lib/costeo-recetas-servicio-v1.cjs');
const store='uki:arica';
const inventory=[{store,sku:'pollo',name:'Pollo',stock_unit:'kg'},{store,sku:'arroz',name:'Arroz',stock_unit:'g'}];
const products=[{store,sku:'classic:36',name:'36 piezas',kind:'classic'}];
const lines=[{sku:'pollo',quantity:200,unit:'g'},{sku:'arroz',quantity:300,unit:'g'}];
const prices=[{store,sku:'pollo',unit:'kg',quantity:1,price:5000},{store,sku:'arroz',unit:'g',quantity:1000,price:2000}];
const order={id:12,suc:'Uki Regimiento Arica',fechaISO:'2026-11-22T12:00:00Z',pagado:true,estado:'Entregado',
 productos:[{skuCarta:'classic:36',nombre:'36 piezas',detalle:'pollo',cantidad:2,precioUnit:9500}]};
const orderKey='uki:arica|12|2026-11-22T12:00:00.000Z';
const recipe=[{store,product_sku:'classic:36',variant_key:'pollo',recipe_lines:lines,confirmed:true,revision:3}];
const assignments=[{index:0,store,orderKey,sku:'classic:36',name:'36 piezas',detail:'pollo',quantity:2,unitPrice:9500,verified:true,variant:'pollo',recipeRevision:3}];
const data={store,order,recipes:recipe,prices,assignments};
test('precio de compra valida inventario, unidades y sucursal',()=>{
 assert.equal(validatePrice(store,{sku:'pollo',unit:'g',quantity:200,price:1200},inventory).quantity,200);
 assert.throws(()=>validatePrice('uki:serena',{sku:'pollo',unit:'kg',quantity:2,price:1000},inventory));
 assert.throws(()=>validatePrice(store,{sku:'pollo',unit:'l',quantity:2,price:1000},inventory));
});
test('receta evita líneas repetidas, precios inventados y productos de otro local',()=>{
 const v=validateRecipe(store,{productSku:'classic:36',variantKey:'pollo',lines},inventory,products);
 assert.equal(v.confirmed,false);
 assert.throws(()=>validateRecipe(store,{productSku:'classic:36',variantKey:'pollo',lines:[lines[0],lines[0]]},inventory,products));
 assert.throws(()=>validateRecipe('uki:serena',{productSku:'classic:36',variantKey:'pollo',lines},inventory,products));
});
test('unidades son convertidas sin mezclar masas y líquidos',()=>{
 assert.equal(convert('0,5','kg','g'),500);
 assert.equal(convert(500,'g','kg'),0.5);
 assert.equal(convert(2,'l','kg'),null);
});
test('rentabilidad únicamente con todos los costos de la sucursal',()=>{
 const total=calculate({store,recipe:lines,prices,quantity:2,revenue:19000});
 assert.equal(total.complete,true);assert.equal(total.cost,3200);
 assert.equal(total.grossProfit,15800);
 const missing=calculate({store,recipe:lines,prices:[prices[0]],quantity:2,revenue:19000});
 assert.equal(missing.cost,null);assert.equal(missing.grossProfit,null);
});
test('pedido completo: proyección exacta sin movimientos de inventario',()=>{
 const p=plan(data);assert.equal(p.status,'ready');assert.equal(p.cost,3200);
 assert.equal(p.revenue,19000);assert.equal(p.grossProfit,15800);
 assert.deepEqual(p.consumption,[{sku:'arroz',unit:'g',quantity:600},{sku:'pollo',unit:'g',quantity:400}]);
});
test('no cuenta dos veces ni corrige stock silenciosamente',()=>{
 const p=plan(data);assert.equal(compare(p,p).status,'duplicate');
 assert.equal(compare(p,{...p,cost:3201}).status,'review');
 assert.deepEqual(compare(p,{...p,cost:3201}).changes,[]);
});
test('cancelaciones y pendientes nunca generan consumo',()=>{
 for(const changes of [{pagado:false},{estado:'Pendiente'},{estado:'Cancelado'}]){
  const p=plan({...data,order:{...order,...changes}});assert.deepEqual(p.consumption,[]);
  assert.equal(p.cost,null);
 }
});
test('cambios de detalle o receta desactualizada exigen revisión',()=>{
 assert.equal(plan({...data,order:{...order,productos:[{...order.productos[0],detalle:'camarón'}]}}).status,'review');
 assert.equal(plan({...data,assignments:[{...assignments[0],recipeRevision:2}]}).status,'review');
 const unpriced=plan({...data,prices:[]});assert.equal(unpriced.status,'ready');assert.equal(unpriced.cost,null);assert.equal(unpriced.costComplete,false);assert.deepEqual(unpriced.consumption,plan(data).consumption);
});
test('el pedido pertenece estrictamente al local confirmado',()=>{
 assert.throws(()=>plan({...data,store:'uki:serena'}));
});
test('punto inicial solo registra conteo validado y no habilita descuento',async()=>{
 const fake={query:async(query)=>{
  assert.doesNotMatch(query,/UPDATE\s+public\.uki_inventario/i);
  return [{snapshot:{items:[{sku:'pollo',quantity:2}]},token:'a'.repeat(32),existing:null}];
 }};
 const r=await baseline(fake,store,'owner',{action:'consultar-inicio'});
 assert.equal(r.automaticEnabled,false);
 const deny=await baseline(fake,store,'owner',{action:'confirmar-inicio',confirmar:true,token:'x',sinPendientes:true});
 assert.equal(deny.ok,false);
});
test('promociones de Romo usan SKU público y mantienen los borradores',async()=>{
 const romo='romo:serena',id='12345678-1234-1234-1234-1234567890ab';
 const mock={query:async q=>{
  if(q.includes('romo_catalogo_v1'))return [{store:romo,sku:'romo:promocion-24',name:'24 piezas',kind:'promo',source:'base'}];
  if(q.includes('romo_carta_admin_qa_v1'))return [{store:romo,sku:'monthly:romoq-'+id,name:'36 piezas',kind:'promo',source:'borrador'}];
  throw Error('Consulta no esperada');
 }};
 const p=await productsFor(mock,romo);
 assert.ok(p.some(x=>x.sku==='monthly:romoq-'+id&&x.source==='borrador'));
 assert.ok(p.some(x=>x.sku==='romo:promocion-24'));
});
test('Uki ofrece todos los insumos base aunque aún no tengan fila en Neon',async()=>{
 const {operate}=require('../lib/costeo-precios-servicio-v1.cjs');
 const fake={query:async q=>{
  if(q.includes('uki_inventario_items_live')||q.includes('uki_inventario_extras_live')||q.includes('costeo_precios_v1'))return [];
  throw Error('Consulta no esperada: '+q);
 }};
 const result=await operate(fake,store,'owner',{action:'listar'});
 assert.equal(result.ok,true);
 assert.ok(result.items.some(i=>i.sku.startsWith('ingredient:')&&i.store===store));
 assert.ok(result.items.every(i=>i.store===store));
});
