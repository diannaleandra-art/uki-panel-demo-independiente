'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const TX=require('../lib/seguimiento-finalizacion-atomica-qa.cjs');
const orderId='621bd292-2153-4160-9e85-375978e10352';
const shared=require('../lib/seguimiento-operacion-unificada-qa.cjs');
const stores=[['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']];
function fake(storeId,branch,{bankStatus='avisada',method='transferencia',storedTotal=18000}={}){
 const row={
  id:orderId,branch,store_id:storeId,estado:'aceptada',codigo_pedido:'TEST-QA-5',
  total_indicado:storedTotal,datos:{medioPago:method}
 };
 const calls=[];
 const db={query:async(query,args)=>{
  calls.push({query,args});
  if(query.startsWith('SELECT id,branch,estado,datos'))return [row];
  if(query.startsWith('WITH source_order AS')){
   assert.match(query,/s\.total_indicado=\$4::integer AND s\.datos=\$5::jsonb/);
   assert.match(query,/t\.estado_pago='confirmada'/);
   assert.match(query,/t\.confirmada_en IS NOT NULL AND t\.abono_verificado_en IS NOT NULL/);
   assert.match(query,/ON CONFLICT \(solicitud_id\) DO UPDATE/);
   assert.match(query,/prior\.estado='pagado'/);
   assert.match(query,/EXCLUDED\.estado='entregado'/);
   assert.match(query,/AND b\.verified/);
   assert.equal(args[1],storeId);
   assert.equal(args[2],branch);
   assert.equal(args[3],storedTotal);
   assert.equal(args[5],method==='transferencia'?storedTotal:0);
   if(method==='transferencia'&&bankStatus!=='confirmada')return [];
   if(args[6]==='entregar'){
    if(!paid)return [];
    return [{estado:'entregado',revision:2,solicitud_id:orderId}];
   }
   paid=true;return [{estado:'pagado',revision:1,solicitud_id:orderId}];
  }
  throw Error('Consulta inesperada');
 }};
 let paid=false;
 return {db,calls};
}
for(const [storeId,branch] of stores){
 test(storeId+' no registra cobro con aviso del cliente aunque personal pulse Confirmar',async()=>{
  const a=fake(storeId,branch);
  const staff={storeId,userId:'worker-qa-123',role:'agendador'};
  await assert.rejects(()=>TX.commit({db:a.db,storeId,orderId,action:'confirmar_cobro',
   staff,restoPagoVerificado:true}),/Transferencia sin comprobar/);
  assert.equal(a.calls.length,2);
  assert.ok(a.calls.every(x=>!/UPDATE public\..*caja|INSERT INTO public\..*caja/i.test(x.query)));
 });
 test(storeId+' confirma pago y después entrega únicamente con banco confirmado',async()=>{
  const a=fake(storeId,branch,{bankStatus:'confirmada'});
  const staff={storeId,userId:'worker-qa-123',role:'agendador'};
  await assert.rejects(()=>TX.commit({db:a.db,storeId,orderId,action:'entregar',
   staff,restoPagoVerificado:true}),/acción ya registrada|pedido modificado/);
  const paid=await TX.commit({db:a.db,storeId,orderId,action:'confirmar_cobro',
   staff,restoPagoVerificado:true});
  assert.equal(paid.estado,'pagado');
  const delivered=await TX.commit({db:a.db,storeId,orderId,action:'entregar',
   staff,restoPagoVerificado:true});
  assert.equal(delivered.estado,'entregado');
  assert.equal(delivered.revision,2);
  assert.equal(delivered.soloQA,true);
 });
 test(storeId+' efectivo conserva su flujo habitual sin verificación de banco',async()=>{
  const a=fake(storeId,branch,{method:'efectivo'});
  const staff={storeId,userId:'worker-qa-123',role:'agendador'};
  const paid=await TX.commit({db:a.db,storeId,orderId,action:'confirmar_cobro',
   staff,restoPagoVerificado:true});
  assert.equal(paid.estado,'pagado');
  assert.equal(a.calls[1].args[5],0);
 });
}
test('no se marca pagado si el actor es de otra sucursal o falta revisar otros medios',async()=>{
 const a=fake('uki:arica','arica',{bankStatus:'confirmada'});
 await assert.rejects(()=>TX.commit({db:a.db,storeId:'uki:arica',orderId,action:'confirmar_cobro',
  staff:{storeId:'uki:serena',role:'agendador',userId:'worker'},restoPagoVerificado:true}),/Personal sin permiso/);
 await assert.rejects(()=>TX.commit({db:a.db,storeId:'uki:arica',orderId,action:'confirmar_cobro',
  staff:{storeId:'uki:arica',role:'agendador',userId:'worker'},restoPagoVerificado:false}),/Revisa también/);
 assert.equal(a.calls.length,0);
});
test('un pedido sin información de pago validada no se registra ni se cierra',async()=>{
 const a=fake('uki:serena','serena');const row={
  id:orderId,branch:'serena',estado:'aceptada',store_id:'uki:serena',total_indicado:18000,
  datos:{pagoPreferido:'transferencia',pagoDeclaracion:'cliente_no_verificado'}
 };
 const db={query:async(q,args)=>q.startsWith('SELECT')?[row]:(()=>{throw Error('No debe guardar')})()};
 await assert.rejects(()=>TX.commit({db,storeId:'uki:serena',orderId,action:'confirmar_cobro',
  staff:{storeId:'uki:serena',role:'agendador',userId:'worker'},
  restoPagoVerificado:true}),/Medio o monto de pago no verificado/);
});
test('endpoints exigen sesión, branch QA y no contienen escrituras de caja',()=>{
 const fs=require('node:fs');
 const p=require('node:path');
 const src=fs.readFileSync(p.join(__dirname,'../api/seguimiento-finalizar-en-servidor-qa.js'),'utf8');
 assert.match(src,/ENV\.config\(\)/);
 assert.match(src,/AUTH\.authorized/);
 assert.match(src,/TX\.commit/);
 assert.match(src,/SEGUIMIENTO_CIERRE_ATOMICO_QA_ENABLED/);
 assert.doesNotMatch(src,/UPDATE public\..*caja|INSERT INTO public\..*caja/i);
});
