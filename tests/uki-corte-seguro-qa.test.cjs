'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const cargar=()=>import('../firebase/uki-corte-seguro-qa.mjs');
const cases=['Uki Regimiento Arica','Uki La Serena'];
const sample=suc=>({
 suc,base:18000,pedidos:[
  {suc,id:1,fechaISO:'2026-11-04',total:27000,pago:{mixto:true,local:3500,resto:23500}},
  {suc,id:2,fechaISO:'2026-11-05',total:12000,codigoCarta:'Mesa-A'}],
 clientes:{'1234':{nombre:'Cliente QA'}},borradores:[],incidencias:[],
 deliveriesManuales:[{suc,fechaISO:'2026-11-05',total:3500}],
 nextId:3,nextIncidenciaId:1,fechaOperativa:'2026-11-05',
 cierres:[{suc,fechaISO:'2026-11-04',total:27000}],
 cajasDiarias:{[suc+'|2026-11-04']:{base:18000,precierres:[],gastos:[{concepto:'Bolsas',monto:800}]}},
 gastos:[{suc,concepto:'Bolsas',monto:800}],
 retiros:[],propinas:[],ajustesHistoricos:[],
 apps:{Uber:1200},pagoDelivery:3500,pagoDeliveryMedio:'Efectivo',
 cajaChica:{inicial:20000,gastos:[]},
 nuevoCampoDelHistorial:{sensitive:'ADMIN QA'}
});
test('dos sucursales: respaldo simulado se reconstruye íntegro con fecha operativa anterior',async()=>{
 const {comprobarMigracionEnSecoQA}=await cargar();
 for(const suc of cases){
  const x=sample(suc),before=JSON.stringify(x);
  const summary=await comprobarMigracionEnSecoQA(x,{cryptoImpl:webcrypto});
  assert.equal(summary.mismoContenido,true);
  assert.equal(summary.pedidos,2);assert.equal(summary.cierres,1);
  assert.equal(summary.puedeActivarseEnProduccion,false);
  assert.match(summary.firmaSHA256,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(x),before,'no altera la copia original');
 }
});
test('cualquier pérdida financiera, sucursal incorrecta o mutación evita preparar el corte',async()=>{
 const {comprobarMigracionEnSecoQA}=await cargar();
 const incorrecto=sample('Uki Regimiento Arica');
 incorrecto.gastos[0].suc='Uki La Serena';
 await assert.rejects(()=>comprobarMigracionEnSecoQA(incorrecto,{cryptoImpl:webcrypto}),/otra sucursal/);
 const ausente=sample('Uki La Serena');delete ausente.cajaChica;
 await assert.rejects(()=>comprobarMigracionEnSecoQA(ausente,{cryptoImpl:webcrypto}),/Falta campo financiero/);
});
test('ninguna señal aislada habilita producción y exige cerrar acceso al respaldo antiguo',async()=>{
 const {revisarPreparacionDeCorteQA,CONDICIONES_DE_CORTE_QA}=await cargar();
 const alInicio=revisarPreparacionDeCorteQA();
 assert.equal(alInicio.verificadas,0);
 assert.equal(alInicio.total,9);
 assert.equal(alInicio.puedeActivarseEnProduccion,false);
 const completas=Object.fromEntries(CONDICIONES_DE_CORTE_QA.map(([k])=>[k,true]));
 const sinRevocar=revisarPreparacionDeCorteQA({...completas,accesoLegadoRevocado:false});
 assert.equal(sinRevocar.puedeSolicitarAutorizacion,false);
 assert.ok(sinRevocar.faltantes.some(x=>x.id==='accesoLegadoRevocado'));
 const sinBackup=revisarPreparacionDeCorteQA({...completas,respaldoSerenaRestaurado:false});
 assert.equal(sinBackup.puedeSolicitarAutorizacion,false);
 const completasAunNoAutorizan=revisarPreparacionDeCorteQA(completas);
 assert.equal(completasAunNoAutorizan.puedeSolicitarAutorizacion,true);
 assert.equal(completasAunNoAutorizan.puedeActivarseEnProduccion,false);
});
test('simulación no introduce red, modifica el estado real ni desactiva protección QA',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','firebase/uki-corte-seguro-qa.mjs'),'utf8');
 assert.doesNotMatch(source,/fetch\(|localStorage\.|indexedDB|navigator\.|firebase\/|https:\/\/|window\./);
 assert.match(source,/puedeActivarseEnProduccion:false/);
 const panel=fs.readFileSync(path.join(__dirname,'..','firebase/uki-sushi-local.html'),'utf8');
 assert.doesNotMatch(panel,/uki-corte-seguro-qa\.mjs/);
 assert.match(panel,/Nunca cargar ni guardar los registros cifrados de caja en Preview/);
});
