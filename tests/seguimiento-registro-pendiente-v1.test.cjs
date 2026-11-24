'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../lib/seguimiento-qa-servidor-v1.cjs');
const secret='c'.repeat(64),id='621bd292-2153-4160-9e85-375978e10352';
const key='this_is_a_private_request_key_with_48_chars_1234',at=1795500000;
const stores=[['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']];
function database(storeId,branch,{existingOther=false}={}){
 const m=S.TABLES[storeId],state={estado:'pendiente',link:existingOther?{
  tokenHash:'a'.repeat(64),expiresAtSeconds:at+259200,storeId,
  orderId:id,status:'active',revokedAt:null}:null,changes:0,queries:[]};
 const db={query:async(q,params=[])=>{
  state.queries.push({q,params});
  if(q.startsWith('SELECT EXTRACT(EPOCH FROM s.creado_en)')){
   assert.deepEqual(params,m.uki?[id,key,branch]:[id,key,branch,storeId]);
   return [{issued_at:at}];
  }
  if(q.startsWith('SELECT request_key FROM '+m.source)){
   assert.deepEqual(params,m.uki?[id,branch]:[id,branch,storeId]);
   return [{request_key:key}];
  }
  if(q.startsWith('INSERT INTO '+m.link)){
   assert.match(q,/ON CONFLICT \(solicitud_id\) DO NOTHING/);
   assert.match(q,/request_key=\$7/);
   assert.equal(params[0],id);assert.equal(params[1],storeId);
   assert.equal(params[2],branch);assert.equal(params[6],key);
   if(state.link)return [];
   state.link={tokenHash:params[3],expiresAtSeconds:params[5],
    storeId,orderId:id,status:'active',revokedAt:null};
   state.changes++;return [{solicitud_id:id}];
  }
  if(q.startsWith('SELECT token_hash::text AS token_hash')){
   assert.deepEqual(params,[id,storeId,branch]);
   return state.link?[{token_hash:state.link.tokenHash,estado:state.link.status,
    expires_at:state.link.expiresAtSeconds,revocado_en:state.link.revokedAt}]:[];
  }
  if(q.includes(' FROM '+m.link+' WHERE')){
   assert.deepEqual(params,[id,storeId,branch]);
   return state.link?[{...state.link}]:[];
  }
  if(q.startsWith('SELECT id,branch,codigo_pedido')){
   assert.deepEqual(params,m.uki?[id,branch]:[id,branch,storeId]);
   return [{id,branch,store_id:m.uki?null:storeId,codigo_pedido:'QA-001',
    estado:state.estado,total_indicado:10000,datos:{medioPago:'transferencia'}}];
  }
  throw Error('Consulta no contemplada: '+q.slice(0,95));
 }};
 return {db,state};
}
for(const [storeId,branch] of stores){
 test(storeId+' · enlace inmediato y estable sin registrar un cobro',async()=>{
  const m=database(storeId,branch);
  const first=await S.issueForRegistered({db:m.db,storeId,orderId:id,requestKey:key,secret,nowSeconds:at});
  assert.equal(first.storeId,storeId);
  assert.equal(m.state.changes,1);
  const repeat=await S.issueForRegistered({db:m.db,storeId,orderId:id,requestKey:key,secret,nowSeconds:at+25});
  assert.equal(repeat.token,first.token,'El enlace no cambia en un reintento');
  assert.equal(m.state.changes,1,'No se inserta otra fila ni se cambia el hash');
  m.state.estado='aceptada';
  const staff=await S.issueAccepted({db:m.db,storeId,orderId:id,
   staff:{storeId,userId:'worker-authorized-qa',role:'agendador'},
   secret,nowSeconds:at+40});
  assert.equal(staff.token,first.token,'Aceptar no invalida el enlace del cliente');
  assert.equal(m.state.changes,1,'El panel no cambia el enlace ni la caja');
  const found=await S.verifyCustomer({db:m.db,token:first.token,secret,nowSeconds:at+25});
  assert.equal(found.order.estado,'pendiente');
  assert.equal(found.order.estadoTexto,'Esperando confirmación del local');
  assert.equal(S.TABLES[storeId].branch,branch);
 });
 test(storeId+' · no emitir sin clave fuerte de solicitud',async()=>{
  const m=database(storeId,branch);
  await assert.rejects(()=>S.issueForRegistered({db:m.db,storeId,orderId:id,
   requestKey:'12345',secret,nowSeconds:at}),/no verificable/);
  assert.equal(m.state.changes,0);
 });
 test(storeId+' · no reemplazar un enlace activo diferente',async()=>{
  const m=database(storeId,branch,{existingOther:true});
  await assert.rejects(()=>S.issueForRegistered({db:m.db,storeId,orderId:id,requestKey:key,secret,nowSeconds:at}),
   /ya tiene otro enlace/);
  assert.equal(m.state.link.tokenHash,'a'.repeat(64));
  assert.equal(m.state.changes,0);
 });
}
