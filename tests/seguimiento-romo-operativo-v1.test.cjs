'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ENV=require('../lib/seguimiento-qa-entorno-v1.cjs');
const config={
 VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'release/romos-panel-v816',
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',ROMO_PANEL_PRODUCTION_ENABLED:'true',
 ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel.vercel.app',
 ROMO_SOLICITUDES_LECTURA_QA_ENABLED:'true',ROMO_SEGUIMIENTO_OPERATIVO_ENABLED:'true',
 ROMO_PRIVATE_DATABASE_HOST:'ep-example-romo.neon.tech',
 ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:fake@ep-example-romo.neon.tech/romos_sushi',
 ROMO_SEGUIMIENTO_TOKEN_SECRET_HEX:'a'.repeat(64),
 ROMO_SEGUIMIENTO_CHAT_SECRET_HEX:'b'.repeat(64)
};
test('Romo sólo puede usar la conexión operativa de su release autorizado',()=>{
 const found=ENV.config(config);
 assert.ok(found?.live);
 assert.deepEqual(Object.keys(found.urls),['romo:serena']);
 assert.equal(ENV.makeDb(found,'uki:serena'),null);
 for(const env of [{...config,ROMO_SEGUIMIENTO_OPERATIVO_ENABLED:'false'},
  {...config,VERCEL_GIT_COMMIT_REF:'main'},
  {...config,ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:fake@ep-example-romo.neon.tech/neondb'},
  {...config,SEGUIMIENTO_ROMO_QA_DATABASE_URL:config.ROMO_PRIVATE_DATABASE_URL},
  {...config,UKI_MESAS_LIVE_DATABASE_URL:config.ROMO_PRIVATE_DATABASE_URL}])
  assert.equal(ENV.config(env),null);
});
test('el origen válido queda limitado al panel autorizado',()=>{
 const found=ENV.config(config);
 assert.equal(ENV.validOrigin({headers:{host:'romos-sushi-panel.vercel.app',origin:config.ROMO_PANEL_ALLOWED_ORIGIN}},found),true);
 assert.equal(ENV.validOrigin({headers:{host:'uki-sushi-panel.vercel.app'}},found),false);
 assert.equal(ENV.validOrigin({headers:{host:'romos-sushi-panel.vercel.app',origin:'https://otro.example'}},found),false);
});


test('pedido anterior sin enlace exige confirmación manual si se cobra transferencia',async()=>{
 const guard=require('../lib/seguimiento-verificar-cierre-qa.cjs');
 const storeId='romo:serena',branch='serena';
 const id='621bd292-2153-4160-9e85-375978e10352';
 let prior=true,method='transferencia',rowState='aceptada',queries=0;
 const db={query:async(sql,args)=>{
  if(sql.startsWith('SELECT id,branch,codigo_pedido,estado,total_indicado,datos,'))return [{id,store_id:storeId,branch,estado:rowState,total_indicado:16000,datos:{medioPago:method}}];
  if(sql.startsWith('SELECT s.id FROM')){
   queries++;assert.match(sql,/s\.creado_en<\$4::timestamptz/);
   assert.equal((sql.match(/NOT EXISTS/g)||[]).length,2);
   assert.deepEqual(args.slice(0,3),[id,storeId,branch]);
   return prior?[{id}]:[];
  }
  if(sql.startsWith('SELECT estado_pago,monto_transferencia'))return [];
  throw Error('consulta no prevista');
 }};
 const check=requiereTransferencia=>guard.check({db,storeId,orderId:id,requiereTransferencia,legacyBefore:'2020-01-01T00:00:00.000Z'});
 let r=await check(true);assert.equal(r.sinEnlaceAnterior,true);assert.equal(r.permitido,false);assert.equal(r.requiereConfirmacionManual,true);
 r=await check(false);assert.equal(r.permitido,false);assert.notEqual(r.sinEnlaceAnterior,true);
 method='efectivo';r=await check(false);assert.equal(r.permitido,true);assert.equal(r.sinEnlaceAnterior,true);
 prior=false;method='transferencia';r=await check(true);assert.equal(r.permitido,false);assert.notEqual(r.sinEnlaceAnterior,true);
 rowState='pendiente';prior=true;r=await check(true);assert.equal(r.permitido,false);assert.notEqual(r.sinEnlaceAnterior,true);
 assert.equal(queries,4);
});

test('Romo y Uki: reparto mixto exacto no registra dinero ni permite quitar transferencia',async()=>{
 const pay=require('../lib/seguimiento-confirmar-medio-pago-qa.cjs');
 for(const storeId of ['uki:arica','uki:serena','romo:serena']){
  const branch=storeId.split(':')[1],id='621bd292-2153-4160-9e85-375978e10352';
  const staff={storeId,role:'agendador',userId:'QA-actor-0001'};
  let saved=0,previous={origen:'carta-normal',medioPago:'transferencia'},canChange=true;
  const db={query:async(sql,args)=>{
   if(sql.startsWith('SELECT id,branch,codigo_pedido,estado,total_indicado,datos,'))return [{
    id,store_id:storeId,branch,estado:'aceptada',codigo_pedido:'QA-mixto',total_indicado:16000,datos:previous
   }];
   assert.match(sql,/UPDATE public\.(uki_carta_solicitudes_live|romo_solicitudes_carta_v1)/);
   assert.match(sql,/s\.datos=\$5::jsonb/);
   assert.match(sql,/l\.vence_en>now\(\)/);
   assert.match(sql,/NOT EXISTS \(SELECT 1 FROM public\.(uki_seguimiento_transferencias_qa_v1|romo_seguimiento_transferencia_v1)/);
   assert.doesNotMatch(sql,/caja|ventas/);
   if(!canChange)return [];
   saved++;previous={...previous,pagos:JSON.parse(args[5]),medioPago:args[6],
    medioPagoConfirmadoPor:args[7],medioPagoConfirmadoTotal:args[3],medioPagoConfirmadoEn:'2026-11-24T12:00:00Z'};
   return [{id}];
  }};
  const go=pagos=>pay.confirmDistribution({db,storeId,orderId:id,staff,pagos,totalValidado:16000});
  assert.equal(pay.normalizarDistribucion([{medio:'transferencia',monto:6000}],16000),null);
  const payments=[{medio:'transferencia',monto:6000},{medio:'efectivo',monto:10000}];
  assert.equal((await go(payments)).montoTransferencia,6000);
  assert.equal(saved,1);
  assert.equal((await go([...payments].reverse())).repeated,true);
  assert.equal(saved,1);
  await assert.rejects(()=>go([{medio:'efectivo',monto:16000}]),/eliminar una transferencia/);
  canChange=false;
  await assert.rejects(()=>go([{medio:'transferencia',monto:7000},{medio:'efectivo',monto:9000}]),/aviso\/abono/);
  assert.equal(saved,1);
 }
});
