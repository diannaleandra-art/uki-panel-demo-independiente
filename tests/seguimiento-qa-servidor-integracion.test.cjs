'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../lib/seguimiento-qa-servidor-v1.cjs');
const secret='a'.repeat(64),chatSecret='b'.repeat(64);
const id='621bd292-2153-4160-9e85-375978e10352',now=1795500000;
function mock(storeId){
 const m=S.TABLES[storeId],calls=[],staff={storeId,role:'agendador',userId:'worker-qa-123'};
 const data={id,branch:m.branch,store_id:storeId,estado:'aceptada',codigo_pedido:'SKU-42',
  total_indicado:18000,datos:{pagos:[{medio:'transferencia',monto:12000},{medio:'efectivo',monto:6000}]}};
 let link=null,payment=null;
 const messages=[];
 const db={query:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.startsWith('SELECT id,branch,codigo_pedido,estado,total_indicado,datos'))return [data];
  if(sql.includes('INSERT INTO '+m.link)){
   if(data.estado!=='aceptada')return [];
   link={tokenHash:args[3],status:'active',expiresAtSeconds:args[5],
    revokedAt:null,storeId,orderId:id};return [{solicitud_id:id}];
  }
  if(sql.includes('SELECT token_hash::text'))return link?[link]:[];
  if(sql.includes('SELECT estado_pago,monto_transferencia'))return payment?[{
   estado_pago:payment.status,monto_transferencia:payment.amount}]:[];
  if(sql.includes('INSERT INTO '+m.payment)){
   const amount=args[m.uki?3:2],staffConfirmation=sql.includes('confirmada_por=');
   payment={amount,status:staffConfirmation?'confirmada':'avisada'};
   return [{estado_pago:payment.status}];
  }
  if(sql.includes('SELECT COUNT(*)::integer AS n')&&sql.includes(m.messages))
   return [{n:messages.length}];
  if(sql.includes('INSERT INTO '+m.messages)){
   const at=m.uki?3:2;
   messages.push({remitente:args[at],mensaje_cifrado:args[at+1],nonce:args[at+2],creado_en:new Date()});
   return [{id:messages.length}];
  }
  if(sql.includes('SELECT remitente,mensaje_cifrado,nonce')&&sql.includes(m.messages))
   return [...messages].reverse();
  throw Error('SQL inesperada: '+sql.slice(0,80));
 }};
 const bank={storeId,verified:true,datos:{banco:'Santander QA',titular:'Cuenta de prueba',
  rut:'11.111.111-1',tipo:'Corriente',cuenta:'Cuenta de prueba',correo:'qa@example.com'}};
 return {db,data,staff,bank,calls,setState:v=>{data.estado=v}};
}
for(const storeId of Object.keys(S.TABLES)){
 test(storeId+' integra aceptación, enlace, chat y confirmación manual sin caja',async()=>{
  const f=mock(storeId);
  const issued=await S.issueAccepted({db:f.db,storeId,orderId:id,staff:f.staff,secret,nowSeconds:now});
  assert.equal(issued.storeId,storeId);
  assert.ok(issued.token);
  const checked=await S.verifyCustomer({db:f.db,token:issued.token,secret,nowSeconds:now+5});
  assert.equal(checked.order.storeId,storeId);
  assert.equal(checked.order.montoTransferencia,12000);
  const before=await S.snapshot({db:f.db,order:checked.order,bank:f.bank,chatSecret});
  assert.equal(before.estadoPago,'pendiente');
  await S.clientNotice({db:f.db,order:checked.order,bank:f.bank});
  assert.equal((await S.snapshot({db:f.db,order:checked.order,bank:f.bank,chatSecret})).estadoPago,'avisada');
  await S.sendMessage({db:f.db,order:checked.order,from:'cliente',body:'¿Está listo?',chatSecret});
  await S.sendMessage({db:f.db,order:checked.order,from:'agendador',body:'En preparación',staff:f.staff,chatSecret});
  const messages=await S.messages(f.db,checked.order,chatSecret);
  assert.deepEqual(messages.map(x=>x.texto),['¿Está listo?','En preparación']);
  assert.rejects(()=>S.staffConfirm({db:f.db,order:checked.order,staff:f.staff,bank:f.bank,
   seenBankCredit:false,receivedAmount:12000}),{code:409});
  assert.rejects(()=>S.staffConfirm({db:f.db,order:checked.order,staff:f.staff,bank:f.bank,
   seenBankCredit:true,receivedAmount:18000}),{code:409});
  const result=await S.staffConfirm({db:f.db,order:checked.order,staff:f.staff,bank:f.bank,
   seenBankCredit:true,receivedAmount:12000});
  assert.equal(result.status,'confirmada');
  const final=await S.snapshot({db:f.db,order:checked.order,bank:f.bank,chatSecret});
  assert.equal(final.estadoPago,'confirmada');
  assert.ok(f.calls.every(q=>!/INSERT INTO public\.(uki_caja|romo_caja)|UPDATE public\.(uki_caja|romo_caja)/i.test(q.sql)));
 });
}
test('enlace no se entrega antes de aceptación',async()=>{
 const f=mock('romo:serena');f.setState('pendiente');
 await assert.rejects(
  ()=>S.issueAccepted({db:f.db,storeId:'romo:serena',orderId:id,staff:f.staff,secret,nowSeconds:now}),
  {code:403});
});
test('una cuenta bancaria de otro local jamás habilita aviso de transferencia',async()=>{
 const f=mock('uki:arica');
 const o=await S.loadOne(f.db,'uki:arica',id);
 await assert.rejects(()=>S.clientNotice({db:f.db,order:o,bank:{...f.bank,storeId:'uki:serena'}}),{code:409});
});
