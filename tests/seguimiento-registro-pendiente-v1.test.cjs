'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../lib/seguimiento-qa-servidor-v1.cjs');
const secret='c'.repeat(64),id='621bd292-2153-4160-9e85-375978e10352';
const key='this_is_a_private_request_key_with_48_chars_1234',at=1795500000;
const cases=[['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']];
function database(storeId,branch){
 const meta=S.TABLES[storeId];
 const state={link:null,changes:0,queries:[]};
 const db={query:async(q,params=[])=>{
  state.queries.push({q,params});
  if(q.startsWith('INSERT INTO '+meta.link)){
   assert.match(q,/request_key=\$7/);
   assert.match(q,/s\.estado IN \('pendiente','aceptada'\)/);
   assert.equal(params[0],id);assert.equal(params[1],storeId);
   assert.equal(params[2],branch);assert.equal(params[6],key);
   state.link={tokenHash:params[3],expiresAtSeconds:params[5],storeId,
    orderId:id,status:'active',revokedAt:null};
   state.changes++;return [{solicitud_id:id}];
  }
  if(q.includes(' FROM '+meta.link+' WHERE')){
   assert.deepEqual(params,[id,storeId,branch]);
   return state.link?[state.link]:[];
  }
  if(q.startsWith('SELECT id,branch,codigo_pedido')){
   const expected=meta.uki?[id,branch]:[id,branch,storeId];
   assert.deepEqual(params,expected);
   return [{id,branch,store_id:meta.uki?null:storeId,codigo_pedido:'QA-001',
    estado:'pendiente',total_indicado:10000,datos:{medioPago:'transferencia'}}];
  }
  throw Error('Consulta de prueba no contemplada: '+q.slice(0,80));
 }};
 return {db,state};
}
for(const [storeId,branch] of cases){
 test(storeId+' · seguimiento visible antes de aceptar, sin cobrar ni avisar',async()=>{
  const m=database(storeId,branch);
  const created=await S.issueForRegistered({db:m.db,storeId,orderId:id,requestKey:key,secret,nowSeconds:at});
  assert.equal(created.storeId,storeId);
  assert.equal(m.state.changes,1);
  const found=await S.verifyCustomer({db:m.db,token:created.token,secret,nowSeconds:at+1});
  assert.equal(found.order.estado,'pendiente');
  assert.equal(found.order.estadoTexto,'Esperando confirmación del local');
  assert.equal(S.TABLES[storeId].branch,branch);
  assert.equal(m.state.changes,1);
 });
 test(storeId+' · no emitir enlace sin clave original fuerte',async()=>{
  const m=database(storeId,branch);
  await assert.rejects(()=>S.issueForRegistered({db:m.db,storeId,orderId:id,
   requestKey:'12345',secret,nowSeconds:at}),/no verificable/);
  assert.equal(m.state.changes,0);
 });
}
