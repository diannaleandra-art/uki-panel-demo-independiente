'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../lib/seguimiento-qa-servidor-v1.cjs');
const OP=require('../lib/seguimiento-operacion-unificada-qa.cjs');
const id='621bd292-2153-4160-9e85-375978e10352';
const chatSecret='f'.repeat(64);
const stores=[['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']];
function fixture(storeId,branch,changed=false){
 const row={id,branch,store_id:storeId,estado:'aceptada',
  total_indicado:18000,codigo_pedido:'QA-203',
  datos:{pagos:[{medio:'transferencia',monto:12000},{medio:'efectivo',monto:6000}]}};
 const order=OP.normalizeOrder(storeId,row),statements=[];
 const db={query:async(sql,args=[])=>{
  statements.push({sql,args});
  if(sql.startsWith('SELECT estado_pago,monto_transferencia'))return [];
  if(sql.startsWith('SELECT COUNT(*)::integer AS n FROM'))return [{n:0}];
  if(sql.startsWith('INSERT INTO'))return changed?[]:
   [{id:1,estado_pago:sql.includes(",'confirmada',")?'confirmada':'avisada'}];
  throw new Error('Consulta no contemplada: '+sql.slice(0,110));
 }};
 const bank={storeId,verified:true,datos:{banco:'Banco DEMO'}};
 const staff={storeId,role:'agendador',userId:'worker-test-45'};
 return {order,db,bank,staff,statements};
}
for(const [storeId,branch] of stores){
 test(storeId+' · aviso comprueba estado, total y datos del pedido en la escritura',async()=>{
  const f=fixture(storeId,branch);
  await S.clientNotice({db:f.db,order:f.order,bank:f.bank});
  const {sql,args}=f.statements.at(-1);
  assert.match(sql,/INSERT INTO .* SELECT s\.id,/);
  assert.match(sql,/s\.estado IN \('pendiente','aceptada'\)/);
  assert.match(sql,/s\.total_indicado=\$\d+/);
  assert.match(sql,/s\.datos=\$\d+::jsonb/);
  assert.match(sql,/estado_pago='pendiente'/);
  assert.ok(sql.includes('s.branch='));
  if(storeId==='romo:serena')assert.match(sql,/s\.store_id=\$2/);
  else assert.match(sql,/s\.branch=\$3/);
  assert.equal(args.at(-2),18000);
  assert.deepEqual(JSON.parse(args.at(-1)),f.order?JSON.parse(f.order.snapshotDatos):null);
 });
 test(storeId+' · confirmacion no se registra si pedido cambia, no toca caja',async()=>{
  const f=fixture(storeId,branch,true);
  await assert.rejects(()=>S.staffConfirm({db:f.db,order:f.order,staff:f.staff,
   bank:f.bank,seenBankCredit:true,receivedAmount:12000}),{code:409});
  const {sql,args}=f.statements.at(-1);
  assert.match(sql,/INSERT INTO .* SELECT s\.id,/);
  assert.match(sql,/s\.estado='aceptada'/);
  assert.match(sql,/s\.total_indicado=\$\d+/);
  assert.match(sql,/s\.datos=\$\d+::jsonb/);
  assert.match(sql,/confirmada_por=\$\d+/);
  assert.ok(!/INSERT INTO .*caja|UPDATE .*caja/i.test(sql));
  assert.equal(args.at(-2),18000);
  assert.equal(args.at(-3),f.staff.userId);
 });
 test(storeId+' · chat no escribe si la solicitud dejó de estar aceptada',async()=>{
  const f=fixture(storeId,branch,true);
  await assert.rejects(()=>S.sendMessage({db:f.db,order:f.order,from:'cliente',
   body:'¿Está listo?',chatSecret}),{code:503});
  const {sql}=f.statements.at(-1);
  assert.match(sql,/INSERT INTO .* SELECT s\.id,/);
  assert.match(sql,/s\.estado='aceptada'/);
  assert.match(sql,/s\.branch=/);
  if(storeId==='romo:serena')assert.match(sql,/s\.store_id=\$2/);
  assert.ok(!/INSERT INTO .*caja|UPDATE .*caja/i.test(sql));
 });
}
