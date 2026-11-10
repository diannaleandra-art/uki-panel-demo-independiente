'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const backend=require('../api/uki-duenos-cierres-auto-qa.js');
const moduleURL=pathToFileURL(path.resolve(__dirname,'../firebase/uki-duenos-cierre-publicador-qa.mjs')).href;
const base={suc:'Uki Regimiento Arica',fechaOperativa:'2026-11-09',
 fechaMs:1794259200123,venta:27000,pedidos:2,
 gastos:1000,delivery:2500,propinas:600,retiros:300,
 medios:{Efectivo:3500,Transferencia:23500},
 detalle:{clientes:[{nombre:'No transferir',telefono:'56911111111'}]}};
test('El puente solo funciona en Preview QA de la rama exacta',()=>{
 const e={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'qa/uki-duenos-cierres-auto-seguro-20261109',UKI_FIN_QA_ENABLED:'true'};
 assert.equal(backend._testing.enabled(e),false);
 e.VERCEL_ENV='preview';e.VERCEL_GIT_COMMIT_REF='main';assert.equal(backend._testing.enabled(e),false);
 e.VERCEL_GIT_COMMIT_REF='qa/uki-duenos-cierres-auto-seguro-20261109';assert.equal(backend._testing.enabled(e),true);
});
test('Rechaza database URL de producción incluso si Preview está habilitado',()=>{
 const e={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'qa/uki-duenos-cierres-auto-seguro-20261109',UKI_FIN_QA_ENABLED:'true',UKI_FIN_QA_DATABASE_URL:'postgres://user:pass@ep-jolly-paper-b5r8w6vu.c-7.us-east-2.aws.neon.tech/neondb'};
 assert.equal(backend._testing.databaseUrl(e),null);
 e.UKI_FIN_QA_DATABASE_URL='postgres://user:pass@ep-lingering-glade-b5m4hfhu.c-7.us-east-2.aws.neon.tech/neondb';
 assert.ok(backend._testing.databaseUrl(e));
});
test('Cierre final válido genera firma única estable y conserva jornada nocturna',async()=>{
 const {prepararCierreParaDuenos}=await import(moduleURL);
 const p=prepararCierreParaDuenos(base);
 assert.equal(p.branch,'arica');assert.equal(p.fecha_operativa,'2026-11-09');
 assert.equal(p.venta_total,27000);assert.equal(p.confirmado,true);
 assert.equal(p.gastos_cierre,1000);assert.equal(p.delivery_por_pagar,2500);
 assert.equal(p.propinas,600);assert.equal(p.retiros,300);
 assert.deepEqual(p.medios,{Efectivo:3500,Transferencia:23500});
 assert.ok(!JSON.stringify(p).includes('No transferir'));
 assert.ok(!JSON.stringify(p).includes('56911111111'));
 const server=backend._testing.validateClose(p,1794269200123);
 assert.ok(server);
 assert.equal(server.source_key.length,64);
 assert.equal(server.source_key,backend._testing.validateClose(p,1794269200123).source_key);
 assert.equal(server.turno_ref,'uki|arica|1794259200123');
});
test('Cierres distintos de sucursal o turno nunca comparten ID',()=>{
 const build=backend._testing.validateClose;
 const p={action:'registrar_cierre',confirmado:true,branch:'arica',fecha_operativa:'2026-11-09',
  fecha_cierre_ms:1794259200123,venta_total:20000,pedidos:2,
  gastos_cierre:1000,delivery_por_pagar:2500,propinas:600,retiros:300,
  medios:{Efectivo:20000}};
 const a=build(p,1794269200123),b=build({...p,branch:'serena'},1794269200123),
  c=build({...p,fecha_cierre_ms:p.fecha_cierre_ms+1},1794269200123);
 assert.ok(a&&b&&c);assert.notEqual(a.source_key,b.source_key);assert.notEqual(a.source_key,c.source_key);
});
test('No exporta cierres incoherentes, medios falsos, fechas inválidas ni totales negativos',async()=>{
 const {prepararCierreParaDuenos}=await import(moduleURL);
 assert.throws(()=>prepararCierreParaDuenos({...base,venta:28000}),/cuadran/);
 assert.throws(()=>prepararCierreParaDuenos({...base,suc:'Romo Sushi'}),/no apto/);
 assert.throws(()=>prepararCierreParaDuenos({...base,medios:{Efectivo:27000,Bitcoin:10}}),/inválidos/);
 const valid={action:'registrar_cierre',confirmado:true,branch:'serena',fecha_operativa:'2026-13-99',
 fecha_cierre_ms:1794259200123,venta_total:0,pedidos:0,
 gastos_cierre:0,delivery_por_pagar:0,propinas:0,retiros:0,medios:{Efectivo:0}};
 assert.equal(backend._testing.validateClose(valid,1794269200123),null);
 assert.equal(backend._testing.validateClose({...valid,fecha_operativa:'2026-11-09',confirmado:false},1794269200123),null);
});
test('Sincronizar cierres en QA reintenta solo claves distintas y no guarda credenciales',async()=>{
 const {conciliarCierresQA}=await import(moduleURL);
 let requests=0;
 const cfg={endpoint:'https://uki-sushi-inventario-git-qa-abc.vercel.app/api/uki-duenos-cierres-auto-qa',
  obtenerToken:async()=> 'qa-token',
  fetchImpl:async(url,o)=>{requests++;const p=JSON.parse(o.body);
   assert.equal(p.venta_total,27000);assert.equal(p.branch,'arica');
   assert.equal(p.gastos_cierre,1000);assert.equal(p.delivery_por_pagar,2500);
   return {ok:true,json:async()=>({ok:true,registrado:requests===1,duplicado:requests!==1,referencia:'ukitest'})}
  }};
 const out=await conciliarCierresQA([base,base,{...base,fechaMs:base.fechaMs+1}],cfg);
 assert.equal(requests,2);assert.equal(out.revisados,2);assert.equal(out.registrados,1);
 assert.equal(out.existentes,1);assert.equal(out.errores.length,0);
});

test('No inventa la fecha operativa ni deja fuera pagos y gastos',async()=>{
 const {prepararCierreParaDuenos}=await import(moduleURL);
 const nocturno={...base,fechaISO:'2026-11-10T01:15:00'};
 assert.equal(prepararCierreParaDuenos(nocturno).fecha_operativa,'2026-11-09');
 assert.throws(()=>prepararCierreParaDuenos({...base,fechaOperativa:undefined}),/no apto/);
 assert.throws(()=>prepararCierreParaDuenos({...base,fechaOperativa:'2026-02-30'}),/no apto/);
 for(const k of ['gastos','delivery','propinas','retiros']){
  assert.throws(()=>prepararCierreParaDuenos({...base,[k]:undefined}),/desglose/);
  assert.throws(()=>prepararCierreParaDuenos({...base,[k]:-1}),/desglose/);
 }
 const p=prepararCierreParaDuenos(base);
 assert.equal(backend._testing.validateClose({...p,propinas:undefined},1794269200123),null);
 assert.equal(backend._testing.validateClose({...p,gastos_cierre:-1},1794269200123),null);
 assert.equal(backend._testing.validateClose({...p,delivery_por_pagar:2500},1794269200123).venta_total,27000);
});
test('Conserva las validaciones de conflicto y prohíbe sumar cierres a movimientos manuales',()=>{
 const fs=require('node:fs');
 const api=fs.readFileSync(path.join(__dirname,'../api/uki-duenos-cierres-auto-qa.js'),'utf8');
 assert.match(api,/ON CONFLICT \(branch,source_key\) DO NOTHING/);
 assert.match(api,/prior\[0\]\[k\]/);
 assert.doesNotMatch(api,/INSERT INTO public\.fin_movimientos/);
});
