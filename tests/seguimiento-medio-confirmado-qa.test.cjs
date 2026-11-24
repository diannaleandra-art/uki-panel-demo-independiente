'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../lib/seguimiento-confirmar-medio-pago-qa.cjs');
const orderId='621bd292-2153-4160-9e85-375978e10352';
for(const [storeId,branch] of [['uki:arica','arica'],['uki:serena','serena'],['romo:serena','serena']]){
 const staff={storeId,role:'agendador',userId:'trabajador-qa-123'};
 function mock(changed=false){
  const calls=[],row={id:orderId,store_id:storeId,branch,estado:'aceptada',
   codigo_pedido:'QA-100',total_indicado:18000,
   datos:{pagoPreferido:'transferencia',pagoDeclaracion:'cliente_no_verificado'}};
  const db={query:async(sql,args)=>{
   calls.push({sql,args});
   if(sql.startsWith('SELECT id,branch,codigo_pedido,estado,total_indicado,datos'))return [row];
   if(sql.startsWith('UPDATE public.'))return changed?[]:[{id:orderId,branch,total_indicado:18000}];
   throw Error('SQL de prueba inesperada');
  }};
  return {db,calls,row};
 }
 test(storeId+' forma de pago: confirma preferencia sólo con validación de personal, sin marcar cobro',async()=>{
  const q=mock();
  const result=await P.confirmPreferred({db:q.db,storeId,orderId,staff,metodo:'transferencia'});
  assert.equal(result.ok,true);
  assert.equal(result.repeated,false);
  assert.equal(result.montoTransferencia,18000);
  assert.equal(q.calls.length,2);
  const {sql,args}=q.calls[1];
  assert.match(sql,/WHERE s\.id=\$1::uuid AND s\.branch=\$3/);
  assert.match(sql,/s\.estado='aceptada'/);
  assert.match(sql,/s\.total_indicado=\$4::integer/);
  assert.match(sql,/s\.datos=\$5::jsonb/);
  assert.match(sql,/s\.datos->>'pagoDeclaracion'='cliente_no_verificado'/);
  assert.match(sql,/NOT\(s\.datos \? 'medioPago'\)/);
  assert.match(sql,/NOT EXISTS \(SELECT 1/);
  assert.match(sql,/medioPagoConfirmadoPor/);
  assert.doesNotMatch(sql,/UPDATE public\..*(caja|ventas|timbres)/i);
  assert.equal(args[1],storeId);
  assert.equal(args[2],branch);
  assert.equal(args[3],18000);
  assert.equal(args[5],'transferencia');
  assert.equal(args[6],staff.userId);
 });
 test(storeId+' impide registrar forma de pago cuando cambió el pedido',async()=>{
  const f=mock(true);
  await assert.rejects(()=>P.confirmPreferred({db:f.db,storeId,orderId,staff,metodo:'transferencia'}),{status:409});
 });
 test(storeId+' impide guardar pago seleccionado distinto del declarado',async()=>{
  const f=mock();
  await assert.rejects(()=>P.confirmPreferred({db:f.db,storeId,orderId,staff,metodo:'efectivo'}),{status:409});
  assert.equal(f.calls.length,1);
 });
 test(storeId+' exige trabajador de la misma tienda',async()=>{
  const f=mock();
  await assert.rejects(()=>P.confirmPreferred({db:f.db,storeId,orderId,
   staff:{...staff,storeId:'otra'},metodo:'transferencia'}),{status:403});
  assert.equal(f.calls.length,0);
 });
}
test('endpoint se limita al panel autorizado en QA y no confirma abonos bancarios',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const c=fs.readFileSync(path.join(__dirname,'../api/seguimiento-personal-tres-qa.js'),'utf8');
 assert.match(c,/ENV\.config\(\)/);
 assert.match(c,/AUTH\.authorized/);
 assert.match(c,/action==='confirmar_medio_de_pago'/);
 assert.match(c,/PAY\.confirmPreferred/);
 assert.doesNotMatch(c,/confirmar_medio_de_pago[\s\S]*?estadoPago:'confirmada'/);
});
