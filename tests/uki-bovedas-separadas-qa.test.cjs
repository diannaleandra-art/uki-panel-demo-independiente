'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const cargar=()=>import('../firebase/uki-bovedas-separadas-qa.mjs');
const OPER='operacion-prueba-2026-diferente';
const ADMIN='admin-prueba-2026-independiente';
const BRANCH='Uki Regimiento Arica';
function fixture(){
 return {
  suc:BRANCH,nextId:20,nextIncidenciaId:4,fechaOperativa:'2026-11-05',
  pedidos:[{suc:BRANCH,id:19,cliente:'Cliente ficticio',total:19000}],
  clientes:{x:{nombre:'Cliente ficticio'}},borradores:[],incidencias:[],deliveriesManuales:[],
  cierres:[{suc:BRANCH,total:19000,marca:'CIERRE-PRIVADO-TEST'}],
  cajasDiarias:{[BRANCH+'|2026-11-05']:{base:18000,precierres:[]}},
  gastos:[{suc:BRANCH,concepto:'PROVEEDOR-PRIVADO-TEST',monto:2000}],
  retiros:[],propinas:[],ajustesHistoricos:[],base:18000,apps:{},pagoDelivery:500,
  pagoDeliveryMedio:'Efectivo',cajaChica:{inicial:20000,gastos:[]}
 };
}
async function vault(){
 const mod=await cargar(),state=fixture();
 const paquetes=await mod.prepararBovedasQA(state,{
  claveOperativa:OPER,claveAdministracion:ADMIN,cryptoImpl:webcrypto});
 return {mod,state,...paquetes};
}
test('solo paquete operativo: no contiene nombres ni cierres ni clave financiera',async()=>{
 const {mod,state,operativa,financiera}=await vault();
 const payload=JSON.stringify(operativa);
 for(const marker of ['CIERRE-PRIVADO-TEST','PROVEEDOR-PRIVADO-TEST','cajasDiarias','cierres',
  ADMIN,'PROVEEDOR']){
  assert.equal(payload.includes(marker),false,'fuga en paquete operativo: '+marker);
 }
 assert.notDeepEqual(operativa.salt,financiera.salt,'los sobres deben tener sales distintas');
 assert.notDeepEqual(operativa.iv,financiera.iv,'los sobres deben tener IV distintos');
 const abierto=await mod.descifrarBovedaQA({paquete:operativa,branch:BRANCH,role:'operacion',
  clave:OPER,cryptoImpl:webcrypto});
 assert.equal(abierto.pedidos[0].id,19);
 assert.equal(Object.hasOwn(abierto,'cierres'),false);
 assert.equal(Object.hasOwn(abierto,'cajaChica'),false);
 assert.equal(state.cierres.length,1,'no muta el estado inicial');
});
test('trabajador con clave operativa NO puede descifrar finanzas ni suplantar rol',async()=>{
 const {mod,operativa,financiera}=await vault();
 await assert.rejects(mod.descifrarBovedaQA({paquete:financiera,branch:BRANCH,role:'administracion',
  clave:OPER,cryptoImpl:webcrypto}),/No se pudo abrir/);
 await assert.rejects(mod.descifrarBovedaQA({paquete:financiera,branch:BRANCH,role:'operacion',
  clave:OPER,cryptoImpl:webcrypto}),/No se pudo abrir/);
 await assert.rejects(mod.descifrarBovedaQA({paquete:operativa,branch:BRANCH,role:'administracion',
  clave:ADMIN,cryptoImpl:webcrypto}),/No se pudo abrir/);
});
test('administración recompone todos los registros sin perder ni mezclar pedidos y cierres',async()=>{
 const {mod,state,operativa,financiera}=await vault();
 const recovered=await mod.recuperarEstadoParaAdministracionQA({
  operativa,financiera,branch:BRANCH,claveOperativa:OPER,claveAdministracion:ADMIN,
  cryptoImpl:webcrypto});
 assert.deepEqual(recovered,state);
});
test('no se pueden mezclar las sucursales ni alterar un sobre cifrado',async()=>{
 const {mod,operativa}=await vault();
 await assert.rejects(mod.descifrarBovedaQA({paquete:operativa,branch:'Uki La Serena',
  role:'operacion',clave:OPER,cryptoImpl:webcrypto}),/No se pudo abrir/);
 const altered={...operativa,cifrado:(operativa.cifrado[0]==='A'?'B':'A')+operativa.cifrado.slice(1)};
 await assert.rejects(mod.descifrarBovedaQA({paquete:altered,branch:BRANCH,role:'operacion',
  clave:OPER,cryptoImpl:webcrypto}),/No se pudo abrir/);
});
test('impide usar una sola clave compartida para todo el sistema',async()=>{
 const {prepararBovedasQA}=await cargar();
 await assert.rejects(prepararBovedasQA(fixture(),{
  claveOperativa:OPER,claveAdministracion:OPER,cryptoImpl:webcrypto}),/distintas/);
});
test('bloquea campos financieros nuevos dentro de paquete operativo',async()=>{
 const {cifrarBovedaQA}=await cargar();
 await assert.rejects(cifrarBovedaQA({branch:BRANCH,role:'operacion',clave:OPER,
  datos:{suc:BRANCH,pedidos:[],cierreFuturo:{total:100}},cryptoImpl:webcrypto}),/administrativo/);
});
test('no cambia el cifrado operativo actualmente usado en producción',()=>{
 const html=readFileSync(join(__dirname,'..','firebase/uki-sushi-local.html'),'utf8');
 assert.doesNotMatch(html,/uki-bovedas-separadas-qa\.mjs/);
 assert.match(html,/const UKI_OPERACION_HABILITADA/);
 const vault=readFileSync(join(__dirname,'..','firebase/uki-bovedas-separadas-qa.mjs'),'utf8');
 assert.doesNotMatch(vault,/firestore|https:\/\/|fetch\(/i);
});
