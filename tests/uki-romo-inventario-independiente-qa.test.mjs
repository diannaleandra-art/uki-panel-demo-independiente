
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyRomoInventory,aplicarOperacionInventarioRomoQA,
 readInventarioRomoQA,guardarOperacionInventarioRomoQA,RomoInventarioRevisionConflicto}
 from '../lib/romo-inventario-qa.mjs';
const SUC='romo:serena',time=1794596800000;
const owner={userId:'owner-uid',brand:'romo',role:'duenos',branches:['serena']};
const worker={userId:'worker-uid',brand:'romo',role:'inventario',branches:['serena']};
const outsider={userId:'another',brand:'uki',role:'inventario',branches:['serena']};
const item={sku:'pollo_crispy',name:'Pollo crispy',kind:'ingrediente',stock_unit:'kg',
 stock_qty:2.5,min_stock_qty:1,available:true};
const mem=()=>{
 let state=null;
 return {async query(sql,p){
  assert.match(sql,/public\.romo_inventario_v1/);assert.equal(p[0],SUC);
  if(sql.startsWith('SELECT '))return state?[{revision:state.rev,contenido:state.data}]:[];
  if(sql.startsWith('INSERT ')){
   if(state&&state.rev!==p[4])return [];
   if(!state&&p[1]!==1)return [];
   state={rev:p[1],data:JSON.parse(p[2])};return [{revision:p[1]}];
  }
  throw Error('Unexpected SQL');
 },saved:()=>state};
};
test('inventario Romo vacío no consulta tablas Uki',async()=>{
 const db=mem(),d=await readInventarioRomoQA({db,identity:owner});
 assert.equal(d.revision,0);assert.deepEqual(d.contenido,emptyRomoInventory());
});
test('dueña da alta y trabajador cuenta, pero no modifica catálogo',()=>{
 const first=aplicarOperacionInventarioRomoQA(emptyRomoInventory(),{
  identity:owner,action:'alta',args:item,ahoraMs:time});
 assert.equal(first.state.items[0].stock_qty,2.5);
 const after=aplicarOperacionInventarioRomoQA(first.state,{
  identity:worker,action:'conteo',args:{sku:item.sku,stock_qty:1.75},ahoraMs:time+1000});
 assert.equal(after.state.items[0].stock_qty,1.75);
 assert.equal(first.state.items[0].stock_qty,2.5);
 assert.throws(()=>aplicarOperacionInventarioRomoQA(first.state,{
  identity:worker,action:'editar',args:{...item},ahoraMs:time+1000}),/permiso/);
 assert.throws(()=>aplicarOperacionInventarioRomoQA(first.state,{
  identity:outsider,action:'conteo',args:{sku:item.sku,stock_qty:2},ahoraMs:time+1000}));
});
test('entrada, disponibilidad y movimientos no son ventas',()=>{
 const a=aplicarOperacionInventarioRomoQA(emptyRomoInventory(),{
  identity:owner,action:'alta',args:item,ahoraMs:time}).state;
 const b=aplicarOperacionInventarioRomoQA(a,{
  identity:worker,action:'entrada',args:{sku:item.sku,cantidad:0.25},ahoraMs:time+1000}).state;
 assert.equal(b.items[0].stock_qty,2.75);
 const c=aplicarOperacionInventarioRomoQA(b,{
  identity:worker,action:'disponibilidad',args:{sku:item.sku,available:false},ahoraMs:time+2000}).state;
 assert.equal(c.items[0].available,false);
 assert.equal(c.pedidos,undefined);assert.equal(c.cierres,undefined);
 assert.equal(c.movimientos.length,3);
});
test('dos equipos no pueden sobrescribir misma revisión',async()=>{
 const db=mem();
 const first=await guardarOperacionInventarioRomoQA({
  db,identity:owner,expectedRevision:0,action:'alta',args:item,ahoraMs:time});
 assert.equal(first.revision,1);
 const second=await guardarOperacionInventarioRomoQA({
  db,identity:worker,expectedRevision:1,action:'conteo',
  args:{sku:item.sku,stock_qty:0.5},ahoraMs:time+1000});
 assert.equal(second.revision,2);
 await assert.rejects(guardarOperacionInventarioRomoQA({
  db,identity:worker,expectedRevision:1,action:'conteo',
  args:{sku:item.sku,stock_qty:6},ahoraMs:time+2000}),
  e=>e instanceof RomoInventarioRevisionConflicto);
 assert.equal(db.saved().data.items[0].stock_qty,0.5);
});
test('cantidades inválidas o coma se rechazan, no hay copia mutada',()=>{
 const before=aplicarOperacionInventarioRomoQA(emptyRomoInventory(),{
  identity:owner,action:'alta',args:item,ahoraMs:time}).state;
 for(const amount of [-1,'2,5',10000000]){
  const frozen=JSON.stringify(before);
  assert.throws(()=>aplicarOperacionInventarioRomoQA(before,{
   identity:worker,action:'conteo',args:{sku:item.sku,stock_qty:amount},ahoraMs:time+1000}));
  assert.equal(JSON.stringify(before),frozen);
 }
});
test('endpoint desactivado sin habilitación, sin afectar Uki',async()=>{
 const h=(await import('../api/romo-inventario-qa.js')).default;
 const prior=process.env.ROMO_INVENTARIO_LIVE_ENABLED;
 delete process.env.ROMO_INVENTARIO_LIVE_ENABLED;
 let status=0;
 const res={setHeader(){},status(x){status=x;return this},json(x){return x}};
 try{
  const v=await h({method:'GET',headers:{}},res);
  assert.equal(status,503);assert.equal(v.ok,false);
 }finally{
  if(prior===undefined)delete process.env.ROMO_INVENTARIO_LIVE_ENABLED;
  else process.env.ROMO_INVENTARIO_LIVE_ENABLED=prior;
 }
 const s=readFileSync(new URL('../api/romo-inventario-qa.js',import.meta.url),'utf8');
 assert.match(s,/ROMO_OPERATIVO_LIVE_ENABLED/);
 assert.doesNotMatch(s,/uki_inventario/);
});
