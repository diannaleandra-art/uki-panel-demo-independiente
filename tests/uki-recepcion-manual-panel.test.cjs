'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('../lib/uki-inventario-core-live.cjs');
const api=fs.readFileSync(require.resolve('../api/inventario-turno-live.js'),'utf8');
const sku='ingredient:vegetal-aceituna-amarga', origin='https://diannaleandra-art.github.io', romo='https://romos-sushi-panel.vercel.app';
function sim({shared=false}={}){
 let version=3,stock=1;
 const calls=[];
 const module={exports:null};
 const stockStub={listar:async()=>[{sku,kind:'ingredient',stock_unit:'kg',stock_qty:stock,version}],
  guardarMovimiento:async(_sql,branch,which,action,n,expected,worker,detalle)=>{
   calls.push({branch,which,action,n,expected,worker,detalle});stock+=n;return {sku,version:++version,stock_qty:stock,stock_unit:'kg'};
  }};
 vm.runInNewContext(api.replace(" const {createRemoteJWKSet,jwtVerify}=await import('jose');"," return bearer==='MOCK-GOOGLE'?'test-uid':null;\n const {createRemoteJWKSet,jwtVerify}=await import('jose');"),{module,
  process:{env:{UKI_BODEGA_SERENA_COMPARTIDA:shared?'true':'false'}},
  require:k=>({
   'node:crypto':{randomUUID:()=>{}},
   '@neondatabase/serverless':{neon:()=>({})},
   '../lib/uki-inventario-pin-live.cjs':{habilitado:()=>true,autorizar:()=>{throw Error('La entrada de panel no se autoriza por PIN');}},
   '../lib/uki-inventario-db-live.cjs':{url:()=> 'fake-db'},
   '../lib/uki-inventario-core-live.cjs':stockStub,
   '../lib/uki-inventario-unidades-live.cjs':require('../lib/uki-inventario-unidades-live.cjs')
  }[k]||{})});
 return {calls,submit:async({host=origin,branch='arica',token='MOCK-GOOGLE',...p}={})=>{
  const res={setHeader(){},status(n){this.code=n;return this;},json(x){this.body=x;return this;}};
  await module.exports({method:'POST',headers:{origin:host,authorization:token?'Bearer '+token:'','content-type':'application/json'},
   body:{action:'recibir-panel',branch,sku,cantidad:125,unidad:'g',expected_version:3,...p}},res);
  return res;
 }};
}
test('entrada manual suma 125 g al stock de kilos y rechaza una segunda escritura de la misma versión',async()=>{
 const {submit,calls}=sim();
 const saved=await submit();
 assert.equal(saved.code,200);
 assert.equal(saved.body.item.stock_qty,1.125);
 assert.equal(calls[0].action,'entrada');
 assert.equal(calls[0].n,0.125);
 assert.equal(calls[0].branch,'arica');
 assert.equal(calls[0].detalle.desdePanel,true);
 assert.equal((await submit()).code,409);
 assert.equal(calls.length,1);
});
test('entrada manual exige Google, local correcto, unidades compatibles y cantidad positiva',async()=>{
 const {submit,calls}=sim();
 assert.equal((await submit({token:'',codigo:'123456'})).code,403);
 assert.equal((await submit({token:'MAL'})).code,403);
 assert.equal((await submit({host:'https://uki-sushi-inventario.vercel.app'})).code,403);
 assert.equal((await submit({host:romo,branch:'serena'})).code,403);
 assert.equal((await submit({unidad:'un'})).code,400);
 assert.equal((await submit({cantidad:0})).code,400);
 assert.equal(calls.length,0);
 const shared=sim({shared:true});
 assert.equal((await shared.submit({host:romo,branch:'arica'})).code,403);
 assert.equal((await shared.submit({host:romo,branch:'serena',token:''})).code,403);
 assert.equal((await shared.submit({host:romo,branch:'serena'})).code,200);
 assert.equal(shared.calls.length,1);
 assert.equal(shared.calls[0].branch,'serena');
});
test('stock y auditoría se guardan juntos sin convertir la entrada en un conteo',async()=>{
 const sql={query:async(query,args)=>{
  assert.match(query,/stock_qty\+\$4::numeric/);
  assert.match(query,/version=\$8/);
  assert.match(query,/inventario:panel-google/);
  assert.match(query,/JOIN logged/);
  assert.equal(args[2],'entrada');
  assert.equal(args[3],0.125);
  return [{sku,stock_unit:'kg',stock_qty:1.125,version:4}];
 }};
 const updated=await core.guardarMovimiento(sql,'arica',sku,'entrada',0.125,3,'Administración Google',{cantidad:125,unidad:'g',desdePanel:true});
 assert.equal(updated.stock_qty,1.125);
 assert.equal(updated.ultimo_conteo,undefined);
});
