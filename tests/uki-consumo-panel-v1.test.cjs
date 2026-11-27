'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs');
const lib=require('../lib/uki-consumo-panel-v1.cjs');
const REQ='d2d17e74-cd09-4bd9-8c82-a3ff89dc0f15';
const local={tipo:'local',modo:'ninguno',monto:0,medio:'',direccion:''};
const roll={tipo:'roll-clasico',cantidad:1,proteina:'pollo',vegetal:'palta',envoltura:'panko',conQueso:true};
const input={request_id:REQ,motivo:'personal',persona:'Camila',nota:'',original:'',items:[roll],entrega:local};

test('colación se registra con nombre y sushi. Regalo, otro motivo y reposición se distinguen',()=>{
 assert.deepEqual(lib.validate(input).detalle.items,[roll]);
 assert.throws(()=>lib.validate({...input,persona:''}),/persona/);
 assert.throws(()=>lib.validate({...input,items:[{tipo:'otro-producto',cantidad:1,nombre:'Bebida'}]}),/tipo/);
 assert.equal(lib.validate({...input,motivo:'regalo',persona:''}).detalle.motivo,'regalo');
 assert.throws(()=>lib.validate({...input,motivo:'otro'}),/motivo/);
 assert.equal(lib.validate({...input,motivo:'reposicion',original:'#695'}).detalle.original,'#695');
 assert.throws(()=>lib.validate({...input,motivo:'reposicion'}),/referencia/);
});

test('los productos no suman precio; el delivery solo se guarda como cobrado si fue recibido',()=>{
 const shipping={tipo:'delivery',modo:'cliente',monto:1500,medio:'Transferencia',recibido:true,direccion:'Local'};
 const record=lib.validate({...input,motivo:'regalo',items:[{...roll,precio:4000}],entrega:shipping});
 assert.equal(record.detalle.entrega.monto,1500);
 assert.equal(record.detalle.items[0].precio,undefined);
 assert.throws(()=>lib.validate({...input,entrega:{...shipping,recibido:false}}),/recibiste/);
 assert.doesNotThrow(()=>lib.validate({...input,entrega:{...shipping,modo:'local',medio:''}}));
 assert.doesNotThrow(()=>lib.validate({...input,entrega:{...shipping,modo:'gratis',medio:'',monto:0}}));
 assert.throws(()=>lib.validate({...input,entrega:{...local,monto:1000}}),/no llevan/);
});

test('un cupón de salida se inserta una sola vez y no escribe existencias ni ventas',async()=>{
 const args=[],date='2026-11-27T14:00:00Z';
 const sql={query:async(q,params)=>{
  args.push(params);
  assert.doesNotMatch(q,/uki_inventario_items_live|uki_inventario_extras_live|fin_consumo_ventas|timbre/);
  if(q.startsWith('INSERT'))return args.length===1?[{creado_en:date}]:[];
  return [{igual:true,creado_en:date}];
 }};
 assert.deepEqual(await lib.save(sql,'uki:arica','cuenta',input),{ok:true,id:REQ,createdAt:date});
 assert.equal((await lib.save(sql,'uki:arica','cuenta',input)).repetido,true);
 assert.equal(args[0][0],'uki:arica');assert.equal(args[1][1],REQ);
});

test('aprovecha gramos preparados confirmados, no inventa panko ni palta y separa motivos',()=>{
 const rows=[
  {store_id:'uki:arica',detalle:{motivo:'personal',items:[roll]}},
  {store_id:'romo:serena',detalle:{motivo:'regalo',items:[{...roll,cantidad:2}]}},
  {store_id:'romo:serena',detalle:{motivo:'reposicion',items:[{tipo:'otro-sushi',cantidad:1,nombre:'Handroll'}]}}
 ];
 const recipes=[{sku:'roll-clasico',ambito:'todos',estado:'parcial',lineas:[
  {nombre:'Pollo',gramos:45,pendiente:false},{nombre:'Palta',gramos:25,pendiente:true},{nombre:'Queso crema',gramos:25,pendiente:false}
 ]}];
 const result=lib.estimatePreparations(rows,recipes);
 assert.deepEqual(result.amounts.filter(x=>x.ingredient==='pollo').map(x=>[x.store,x.motivo,x.grams]),
  [['uki:arica','personal',45],['romo:serena','regalo',90]]);
 assert.equal(result.amounts.filter(x=>['palta','panko'].includes(x.ingredient)).length,0);
 assert.equal(result.itemsPending,4);
});

test('uso de ventas y colaciones explica diferencia sin descontar otra vez; equivalencias faltantes no se adivinan',()=>{
 const sku='ingredient:proteina-pollo',item={sku,name:'Pollo',stock_unit:'kg',conteo_registrado:true};
 const rows=lib.physicalRows({items:[{...item,stock_qty:3}]},{items:[{...item,stock_qty:2}]},
  [{sku,tipo:'conteo',unit:'kg',after:2}], [item]);
 assert.equal(rows[0].outflow,1);
 const readings=[{store:'uki:serena',motivo:'venta',ingredient:'pollo',grams:900},
  {store:'romo:serena',motivo:'personal',ingredient:'pollo',grams:45}];
 const withNotes=rows.map(x=>({...x,justified:{staff:0,waste:0,transferIn:0,transferOut:0}}));
 assert.equal(lib.project(withNotes,readings,[],true)[0].expected,null);
 const result=lib.project(withNotes,readings,[{sku,store:'uki:serena',ingredient:'pollo',raw_g:1000,prepared_g:1000}],true)[0];
 assert.equal(result.final,2);assert.equal(result.sales,0.9);assert.equal(result.staff,0.045);
 assert.ok(Math.abs(result.expected-2.055)<1e-8);assert.ok(Math.abs(result.difference+0.055)<1e-8);
 assert.equal(rows[0].final,2);
});

test('el informe usa solo lecturas, agrupa la bodega de La Serena y no muestra nombres de la otra marca',async()=>{
 const date='2026-11-26T22:30:00Z', close='2026-11-27T04:02:54Z';
 const calls=[];
 const db={async query(q,args){
  assert.match(q,/^SELECT/);calls.push(args);
  if(q.includes(" AS today"))return [{start:'2026-11-26T03:00:00Z',end:'2026-11-27T03:00:00Z',today:'2026-11-27',now:close}];
  if(q.includes('uki_inventario_revisiones_live'))return [{created_at:close,day:'2026-11-26',items:[]}];
  if(q.includes('uki_salidas_sin_cobro_v1'))return [
   {store_id:'uki:serena',request_id:'uno',creado_en:date,detalle:{motivo:'personal',persona:'Otro local',items:[roll]}},
   {store_id:'romo:serena',request_id:'dos',creado_en:date,detalle:{motivo:'personal',persona:'Mi local',items:[roll]}}
  ];
  return [];
 }};
 const data=await lib.report(db,null,'serena','romo:serena','2026-11-26',[],{shared:true});
 assert.equal(data.hasClose,true);assert.equal(data.end,'2026-11-27T04:02:54.000Z');
 assert.deepEqual(data.sales.map(x=>x.store).sort(),['romo:serena','uki:serena']);
 assert.equal(data.sinCobro.length,1);
 assert.equal(data.sinCobro[0].detalle.persona,'Mi local');assert.ok(calls.length>=4);
});

test('el panel normal separa ingreso y consulta del inventario; no modifica el formulario de venta',()=>{
 const ui=fs.readFileSync('firebase/uki-consumo-panel-v1.js','utf8');
 assert.match(ui,/Registrar productos sin cobro/);
 assert.match(ui,/Colación del personal/);
 assert.match(ui,/view\(\)==='nuevo'/);
 assert.match(ui,/ukiInvCalendario/);
 assert.match(ui,/Ver consumo del día/);
 assert.doesNotMatch(ui,/ndGuardar\s*=|S\.pedidos|timbreEnviadoEn/);
});
