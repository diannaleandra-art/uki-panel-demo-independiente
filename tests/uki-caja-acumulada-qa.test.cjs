'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const api=require('../api/uki-caja-acumulada-qa.js')._testing;
test('caja acumulada: solo QA, y autorización de administración independiente de inventarios',()=>{
 assert.equal(api.qaEnabled({
  VERCEL_ENV:'preview',
  VERCEL_GIT_COMMIT_REF:'feature/uki-disponibilidad-manual-live-2026-11-06',
  UKI_INVENTARIO_QA_ENABLED:'true'
 }),true);
 for(const env of [{VERCEL_ENV:'production'}, {VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'main'}]){
  assert.equal(api.qaEnabled({...env,UKI_INVENTARIO_QA_ENABLED:'true'}),false);
 }
 assert.equal(api.amount(0),true);
 assert.equal(api.amount(100000000),true);
 assert.equal(api.amount(-1),false);
 assert.equal(api.amount(12.4),false);
 assert.equal(api.validDay('2026-11-07'),true);
 assert.equal(api.validDay('2026-02-30'),false);
 assert.equal(api.validUUID('11111111-1111-4111-8111-111111111111'),true);
 assert.equal(api.validUUID('1111'),false);
 const source=read('api/uki-caja-acumulada-qa.js');
 assert.match(source,/UKI_CAJA_ACUM_ADMIN_UIDS/);
 assert.match(source,/UKI_CAJA_ACUM_ADMIN_EMAILS/);
 assert.doesNotMatch(source,/UKI_INVENTARIO_LIVE_ALLOWED_UIDS/);
 assert.match(source,/uki_caja_acum_aplicar_qa/);
 assert.doesNotMatch(source,/uki_caja_acum_aplicar_live/);
 assert.ok(!source.includes('INSERT INTO public.uki_caja_acum_movimientos_live'));
});
test('migración atómica: aislamiento por sucursal, cierres idempotentes y saldo sin sobregiro',()=>{
 const s=read('migrations/2026-11-07-uki-caja-acumulada-qa.sql');
 for(const needle of ['FOR UPDATE','UNIQUE (branch,op_key)','PRIMARY KEY (branch,cierre_clave)',
  "IF a.balance+delta<0", "p_action='traspaso'", "delta=p_amount-close_row.monto_actual",
  "WHEN 'traspaso' THEN 'traspaso_salida'", 'traspaso_entrada',
  "if"]) {if(needle==='if')continue;assert.ok(s.includes(needle),needle);}
 assert.ok(s.includes('saldo_resultante'));
 assert.ok(s.includes('fecha_operativa'));
 assert.match(s,/initialized boolean NOT NULL DEFAULT false/);
 assert.doesNotMatch(s,/TRUNCATE|DROP TABLE|DELETE FROM/i);
});
test('el panel incorpora una pestaña Caja acumulada sin cambiar lógica de cierres',()=>{
 const html=read('firebase/uki-sushi-local.html');
 const ui=read('firebase/uki-caja-acumulada-admin.js');
 assert.match(html,/\["acumulada","Caja acumulada en efectivo"\]/);
 assert.match(html,/ukiCajaAcumuladaVista/);
 assert.match(html,/ukiCajaAcumuladaMontar/);
 assert.match(html,/uki-caja-acumulada-admin\.js/);
 assert.match(ui,/window\.UKI_CAJA_ACUM_QA_API\|\|''/);
 assert.match(ui,/SOLO PRUEBAS/);
 assert.match(ui,/No se registr.* nuevamente|NO se registra nuevamente/);
 assert.doesNotMatch(ui,/\bS\.cierres\s*=|\bS\.pedidos\s*=/);
 assert.match(ui,/crypto\.randomUUID/);
});
test('UI aislada calcula estado y registra gasto sin cambiar sucursal o duplicar retiro',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{
  url:'https://diannaleandra-art.github.io/uki-panel-demo-independiente/firebase/uki-sushi-local.html',
  runScripts:'outside-only'
 });
 const w=dom.window;w.UKI_CAJA_ACUM_QA_API='https://qa.test/api/uki-caja-acumulada-qa';
 w.eval("let S={suc:'Uki Regimiento Arica'};");
 w.ukiInventarioToken=async()=> 'simulado-qa-no-token-google';
 w.confirm=()=>true;w.crypto.randomUUID=()=> '99999999-9999-4999-8999-999999999999';
 const calls=[];
 w.fetch=async(url,options)=>{
  const payload=JSON.parse(options.body);calls.push(payload);
  const body=payload.action==='saldo'?
   {ok:true,cuenta:{initialized:true,balance:payload.branch==='arica'?57000:100000}}:
   payload.action==='movimientos'?
   {ok:true,movimientos:[{tipo:'retiro',monto:-18000,concepto:'Retiro de prueba',
    creado_en:'2026-11-07T16:00:00Z'}]}:
   {ok:true,saldo:payload.branch==='arica'?52000:95000,duplicate:false};
  return {ok:true,status:200,json:async()=>body};
 };
 w.eval(read('firebase/uki-caja-acumulada-admin.js'));
 const d=w.document;d.body.innerHTML=w.ukiCajaAcumuladaVista();
 w.ukiCajaAcumuladaMontar();
 const tick=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
 try{
  await tick();
  assert.equal(d.getElementById('ukiAcumBalance').textContent,'$57.000');
  assert.match(d.getElementById('ukiAcumHistory').textContent,/Retiro de prueba/);
  assert.equal(d.getElementById('ukiAcumInit').hidden,true);
  d.getElementById('ukiAcumType').value='gasto';
  d.getElementById('ukiAcumType').dispatchEvent(new w.Event('change'));
  d.getElementById('ukiAcumAmount').value='5000';
  d.getElementById('ukiAcumConcept').value='Compra de prueba';
  d.getElementById('ukiAcumSave').click();
  await tick();
  const gasto=calls.find(x=>x.action==='gasto');
  assert.ok(gasto);
  assert.equal(gasto.monto,5000);
  assert.equal(gasto.branch,'arica');
  assert.ok(gasto.op_key);
  d.getElementById('ukiAcumBranch').value='serena';
  d.getElementById('ukiAcumBranch').dispatchEvent(new w.Event('change'));
  await tick();
  assert.equal(d.getElementById('ukiAcumBalance').textContent,'$100.000');
  assert.equal(d.getElementById('ukiAcumSucursal').textContent,'La Serena');
  assert.ok(!calls.some(x=>x.action==='cierre'));
 }finally{dom.window.close();}
});
