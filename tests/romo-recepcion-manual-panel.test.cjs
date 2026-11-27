'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('public/romo-panel-qa/uki-factura-inventario-admin-panel.js','utf8');
const sku='r_kg_arroz',sharedSku='ingredient:vegetal-arroz';
function mock(shared){
 const requests=[];
 const fetch=async(url,{method,body})=>{
  const data=body?JSON.parse(body):null;
  requests.push({url,method,data});
  const skuData={sku:shared?sharedSku:sku,name:'Arroz',stock_unit:'kg',stock_qty:1,version:2};
  const d=url==='/api/romo-inventario-qa'?(method==='GET'?
   {storeId:'romo:serena',bodegaCompartida:shared,revision:3,contenido:{items:[skuData]}}:
   {storeId:'romo:serena',revision:data.expectedRevision+1,change:{sku:data.args.sku,tipo:'entrada'}}):
   {branch:'serena',items:[skuData],item:{...skuData,version:3,stock_qty:1.125}};
  return {ok:true,json:async()=>({ok:true,...d})};
 };
 const window={ukiInventarioMontar(){},ukiInventarioToken:async()=> 'FAKE'};
 vm.runInNewContext(script.replace('window.ukiInventarioMontar=montar;','window.mockRomo=solicitarManualRomo;'),{window,
  S:{suc:'Romo’s Sushi La Serena'},fetch,document:{getElementById:()=>({value:'romo'})}});
 return {requests,run:window.mockRomo};
}
test('Romo independiente usa revisión y escribe solo en su bodega',async()=>{
 const {run,requests}=mock(false);
 const snapshot=await run(),payload={sku,cantidad:125,unidad:'g',expected_version:3};
 assert.equal(snapshot.perfil,'romo-independiente');
 const result=await run({snapshot,payload,base:0.125});
 assert.deepEqual(requests.map(x=>x.url),['/api/romo-inventario-qa','/api/romo-inventario-qa']);
 assert.deepEqual(requests[1].data,{action:'entrada',expectedRevision:3,args:{sku,cantidad:0.125}});
 assert.equal(result.item.stock_qty,1.125);
 assert.equal(result.item.version,4);
});
test('Romo compartido guarda en existencias La Serena, no en la bodega anterior',async()=>{
 const {run,requests}=mock(true);
 const snapshot=await run(),payload={sku:sharedSku,cantidad:125,unidad:'g',expected_version:2};
 assert.equal(snapshot.perfil,'romo-compartido');
 assert.equal((await run({snapshot,payload,base:0.125})).item.stock_qty,1.125);
 assert.equal(requests.filter(x=>x.url==='/api/romo-inventario-qa'&&x.method==='POST').length,0);
 assert.deepEqual(requests[2].data,{...payload,branch:'serena',action:'recibir-panel'});
});
