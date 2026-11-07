'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const src=p=>fs.readFileSync(path.join(root,p),'utf8');
const live=require('../api/uki-caja-acumulada-live.js');
test('endpoint de caja acumulada: solo producción y origen del panel habitual',async()=>{
 const testHelpers=live._testing;
 assert.equal(testHelpers.liveEnabled({VERCEL_ENV:'production',UKI_INVENTARIO_LIVE_ENABLED:'true'}),true);
 assert.equal(testHelpers.liveEnabled({VERCEL_ENV:'preview',UKI_INVENTARIO_LIVE_ENABLED:'true'}),false);
 assert.ok(testHelpers.allowedOrigins.has('https://diannaleandra-art.github.io'));
 assert.ok(!testHelpers.allowedOrigins.has('https://sitio-falso.com'));
 assert.equal(testHelpers.amount(-1),false);
 assert.equal(testHelpers.validDay('2026-11-07'),true);
 assert.equal(testHelpers.validDay('2026-11-32'),false);
 const api=src('api/uki-caja-acumulada-live.js');
 assert.ok(api.includes('UKI_INVENTARIO_LIVE_ALLOWED_EMAILS'));
 assert.ok(api.includes('UKI_INVENTARIO_LIVE_ALLOWED_UIDS'));
 assert.doesNotMatch(api,/UKI_CAJA_ACUM_ADMIN/);
 assert.doesNotMatch(api,/_qa\b/);
 assert.match(api,/body\.efectivo_contado!==body\.monto/);
 assert.match(api,/body\.diferencia_efectivo!==0/);
 assert.match(api,/body\.saldo_inicial_contado!==true/);
 assert.match(api,/uki_caja_acum_sincronizar_cierre_live/);
 assert.doesNotMatch(api,/writeActions=new Set\(\[[^\]]*'cierre'/);
});
test('reporte caja: PDF y CSV sin fórmulas de Excel, archivos locales',()=>{
 const exp=require('../firebase/uki-caja-acumulada-exportar.js');
 const report={branch:'arica',balance:77000,generated_at:'2026-11-07T15:00:00.000Z',
  history:[{tipo:'retiro',monto:-5000,saldo_resultante:77000,
   concepto:'=SUM(1,2)',responsable:'Agendadora',
   actor_uid:'test',creado_en:'2026-11-07T14:33:00.000Z'}]};
 const csv=exp.csv(report);
 assert.ok(csv.includes('sep=;'));
 assert.ok(csv.includes("'=SUM(1,2)"));
 assert.match(csv,/Agendadora/);
 const pdf=exp.pdf(report);
 assert.ok(pdf.length>500);
 assert.equal(Buffer.from(pdf).subarray(0,8).toString(),'%PDF-1.4');
 assert.match(exp.message(report),/Regimiento Arica/);
});
test('panel de caja mantiene cierres reales e invoca conciliación solo tras confirmar',()=>{
 const html=src('firebase/uki-sushi-local.html');
 const ui=src('firebase/uki-caja-acumulada-admin.js');
 assert.match(html,/const cierreAcumulable=S\.cierres\[S\.cierres\.length-1\]/);
 assert.match(html,/ukiCajaAcumuladaRegistrarCierre\(cierreAcumulable\)/);
 assert.match(ui,/c\.efectivoContado/);
 assert.match(ui,/diff===0/);
 assert.match(ui,/ms>initMs/);
 assert.match(ui,/sincronizar_cierre/);
 assert.match(ui,/saldo_inicial_contado:first/);
 assert.doesNotMatch(ui,/\bS\.cierres\s*=|\bS\.pedidos\s*=/);
});
test('cuentas y traspasos de producción son atómicos, no incluyen importes del turno dos veces',()=>{
 const migration=src('migrations/2026-11-07-uki-caja-acumulada-live.sql');
 for(const x of ['uk[i]','uki_caja_acum_cuentas_live','uki_caja_acum_movimientos_live',
  'uki_caja_acum_sincronizar_cierre_live','ORDER BY branch FOR UPDATE',
  'UNIQUE (branch,op_key)','delta=p_amount-close_row.monto_actual',
  'to_timestamp(p_close_ms/1000.0)<=account.initialized_at']){
  if(x==='uk[i]')continue;
  assert.ok(migration.includes(x),x);
 }
 assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE|DELETE FROM/);
 assert.doesNotMatch(migration,/_qa\b/);
});
