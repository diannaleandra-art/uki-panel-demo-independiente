'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path'),fs=require('node:fs');
const cp=require('node:child_process');
const frontend=path.resolve(__dirname,'../firebase/uki-sushi-local.html');
const mod=path.resolve(__dirname,'../firebase/uki-duenos-cierre-publicador-live.mjs');
const valid={suc:'Uki Regimiento Arica',fechaOperativa:'2026-11-10',
 fechaMs:1794330780000,venta:27000,pedidos:3,medios:{Efectivo:12000,Transferencia:15000},
 gastos:1200,delivery:2500,propinas:700,retiros:0,
 detalle:{clientes:[{nombre:'No exportar',telefono:'56911111111'}]}};
test('Solo envía totales de cierres definitivos, no datos de clientes',async()=>{
 const m=await import(pathToFileURL(mod).href);
 const p=m.prepararCierreParaDuenos(valid);
 assert.equal(p.branch,'arica');assert.equal(p.venta_total,27000);
 assert.equal(p.confirmado,true);assert.equal(p.gastos_cierre,1200);
 assert.equal(p.delivery_por_pagar,2500);assert.equal(p.propinas,700);
 assert.ok(!JSON.stringify(p).includes('No exportar'));
 assert.ok(!JSON.stringify(p).includes('56911111111'));
 assert.equal(m.prepararCierreParaDuenos({...valid,suc:'Uki La Serena'}).branch,'serena');
 assert.throws(()=>m.prepararCierreParaDuenos({...valid,venta:27001}),/cuadran/);
 assert.throws(()=>m.prepararCierreParaDuenos({...valid,fechaOperativa:undefined}),/no apto/);
});
test('El servidor de dueños solo es el dominio oficial; reintento no modifica caja',async()=>{
 const m=await import(pathToFileURL(mod).href);
 let sent=null,calls=0;
 const cfg={endpoint:'https://uki-sushi-inventario.vercel.app/api/uki-duenos-cierres-live',
  obtenerToken:async()=> 'token-qa',
  fetchImpl:async(_url,init)=>{calls++;sent=JSON.parse(init.body);
   assert.equal(init.method,'POST');
   assert.equal(init.headers.Authorization,'Bearer token-qa');
   return {ok:true,json:async()=>({ok:true,registrado:true,duplicado:false,referencia:'uki|arica|1794330780000'})};
  }};
 const out=await m.sincronizarCierreDuenos(valid,cfg);
 assert.equal(out.registrado,true);assert.equal(calls,1);assert.equal(sent.pedidos,3);
 assert.equal(Object.hasOwn(sent,'clientes'),false);
 await assert.rejects(m.sincronizarCierreDuenos(valid,{...cfg,endpoint:'https://dominio-cualquiera.vercel.app/api/uki-duenos-cierres-live'}),/no configurado/);
});
test('El panel espera Firebase sincronizado y nunca cambia el cierre definitivo',()=>{
 const html=fs.readFileSync(frontend,'utf8');
 const index=html.indexOf('function cerrar(){'),end=html.indexOf('function descargarTextoArchivo',index);
 assert.ok(index>0&&end>index);
 const closing=html.slice(index,end);
 assert.match(closing,/S\.cierres\.push\(\{/);
 assert.match(closing,/guardarEnLocalStorage\(\);/);
 assert.doesNotMatch(closing,/ukiConciliarCierresDuenos|sincronizarCierreDuenos/);
 assert.match(html,/if\(!cloudStatus\.actualRespaldado\|\|!local\?\.estado\|\|/);
 assert.match(html,/cloudStatus\.estado!=='sincronizado'/);
 assert.match(html,/if\(estado==='sincronizado'\)Promise\.resolve\(\)\.then/);
 assert.match(html,/void ukiConciliarCierresDuenos\(\);/);
 assert.match(html,/UKI_OPERACION_HABILITADA=location\.hostname==='diannaleandra-art\.github\.io'/);
 assert.match(html,/ukiDuenosEnviados\.has\(key\)/);
 assert.match(html,/ukiDuenosSincronizando/);
 const modules=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 assert.equal(modules.length,1);
 const child=cp.spawnSync(process.execPath,['--check','--input-type=module'],{input:modules[0][1],encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
});
