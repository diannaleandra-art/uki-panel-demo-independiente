'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const api=require('../api/uki-duenos-cierres-live.js');
const finance=require('../api/mi-administracion-live.js');
const privateFinance='postgres://user:password@ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';
const wrong='postgres://user:password@ep-quiet-tree-prod.c-7.us-east-2.aws.neon.tech/neondb';
const enabled={VERCEL_ENV:'production',UKI_FIN_AUTO_LIVE_ENABLED:'true',UKI_FIN_PRIVATE_DATABASE_URL:privateFinance};
const financeEnv={VERCEL_ENV:'production',UKI_FIN_PRIVATE_ENABLED:'true',UKI_FIN_PRIVATE_DATABASE_URL:privateFinance};
const base={branch:'arica',fecha_operativa:'2026-11-10',fecha_cierre_ms:1794330780000,venta_total:27000,
 pedidos:3,medios:{Efectivo:12000,Transferencia:15000},gastos_cierre:1200,delivery_por_pagar:2500,
 propinas:700,retiros:0,confirmado:true};
test('Finanzas operan exclusivamente en producción, con base PRIVADA y no con caja',()=>{
 assert.equal(api._testing.enabled(enabled),true);
 assert.equal(api._testing.enabled({...enabled,VERCEL_ENV:'preview'}),false);
 assert.equal(api._testing.enabled({...enabled,UKI_FIN_AUTO_LIVE_ENABLED:'false'}),false);
 assert.ok(api._testing.databaseUrl(enabled));
 assert.equal(api._testing.databaseUrl({...enabled,UKI_FIN_PRIVATE_DATABASE_URL:wrong}),null);
 assert.equal(finance._testing.envOk(financeEnv),true);
 assert.equal(finance._testing.envOk({...financeEnv,VERCEL_ENV:'preview'}),false);
 assert.ok(finance._testing.dbUrl(financeEnv));
 assert.equal(finance._testing.dbUrl({...financeEnv,UKI_FIN_PRIVATE_DATABASE_URL:wrong}),null);
});
test('Dos sucursales, validación de pagos y cierre confirmado',()=>{
 const validate=api._testing.validateClose;
 const a=validate(base,1794331800000);
 assert.ok(a);assert.equal(a.branch,'arica');assert.equal(a.venta_total,27000);
 assert.equal(a.gastos_cierre,1200);assert.equal(a.delivery_por_pagar,2500);
 assert.equal(a.turno_ref,'uki|arica|1794330780000');
 assert.equal(a.source_key.length,64);
 assert.notEqual(a.source_key,validate({...base,branch:'serena'},1794331800000).source_key);
 assert.equal(validate({...base,confirmado:false},1794331800000),null);
 assert.equal(validate({...base,venta_total:27001},1794331800000),null);
 assert.equal(validate({...base,medios:{Efectivo:27000,Bitcoin:1}},1794331800000),null);
 assert.equal(validate({...base,delivery_por_pagar:-1},1794331800000),null);
});
test('El backend no mezcla pedidos o ventas manuales con cierres; duplicados se bloquean',()=>{
 const bridge=fs.readFileSync(path.resolve(__dirname,'../api/uki-duenos-cierres-live.js'),'utf8');
 const owners=fs.readFileSync(path.resolve(__dirname,'../api/mi-administracion-live.js'),'utf8');
 for(const file of [bridge,owners]){
  assert.match(file,/UKI_FIN_PRIVATE_DATABASE_URL/);
  assert.doesNotMatch(file,/UKI_INVENTARIO_LIVE_DATABASE_URL|UKI_FIN_QA_DATABASE_URL/);
  assert.match(file,/uki-panel-f4909/);
 }
 assert.match(bridge,/ON CONFLICT \(branch,source_key\) DO NOTHING/);
 assert.match(bridge,/fin_uki_cierres_live_v1/);
 assert.doesNotMatch(bridge,/INSERT INTO public\.fin_movimientos/);
 assert.match(owners,/X-Fin-Session/i);
 assert.match(owners,/if\(action==='listar_cierres'\)/);
 assert.match(owners,/fin_uki_cierres_live_v1/);
 assert.doesNotMatch(owners,/recibir_uki_auto/);
});
test('Dueños: iPhone, acceso Google y PIN, ventas de ambas sucursales sin doble conteo',async()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../public/mi-administracion-duenos.html'),'utf8');
 const m=await import(pathToFileURL(path.resolve(__dirname,'../public/uki-duenos-ventas-unificadas-qa.mjs')).href);
 const js=[...html.matchAll(/<script type="module">([\s\S]+?)<\/script>/g)];
 assert.equal(js.length,1);
 const out=cp.spawnSync(process.execPath,['--check','--input-type=module'],{input:js[0][1],encoding:'utf8'});
 assert.equal(out.status,0,out.stderr);
 for(const needle of ['id="google"','id="pin"','id="ukiGoTodasVentas"','data-owner-branch="arica"','data-owner-branch="serena"'])assert.ok(html.includes(needle),needle);
 assert.match(html,/api\/mi-administracion-live/);
 assert.doesNotMatch(html,/uki-sushi-inventario-q5gxm1ria|uki-sushi-inventario-cnr6rwj4v/);
 const close={branch:'arica',turno_ref:'uki|arica|1794330780000',fecha_operativa:'2026-11-10',venta_total:27000,medios:{Efectivo:27000}};
 const copy={id:'m1',tipo:'venta',fuente:'cierre',fecha:'2026-11-10',monto:27000,referencia:close.turno_ref,estado:'registrado'};
 const data=m.unirVentasDuenos({movimientos:[copy],cierres:[close,close]});
 assert.equal(data.cierresConfirmados,1);
 assert.equal(data.coincidencias,1);
 assert.equal(data.items.length,1);
});
