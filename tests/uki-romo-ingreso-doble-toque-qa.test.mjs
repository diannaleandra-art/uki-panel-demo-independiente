import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
const a=html.indexOf('let ukiRomoAccesoOcupadoQA=false;');
const b=html.indexOf('async function salirSuc(){',a);
const codigo=html.slice(a,b);
function escenario({confirmacion='ClaveQA_Prueba2026',clave='ClaveQA_Prueba2026'}={}){
 let resolver,aperturas=0;const alertas=[],renderizados=[];
 const pendiente=new Promise(resolve=>{resolver=resolve});
 const datos={
  S:{pinSuc:'Romo’s Sushi La Serena',suc:null},ROMO_SUCURSAL_QA:'Romo’s Sushi La Serena',
  ROMO_PANEL_INTEGRACION_HABILITADA_QA:true,
  $:id=>({value:id==='ukiAccesoClave'?clave:confirmacion}),
  localStorage:{getItem:()=>null},claveLocal:s=>s,
  ukiRomoAbrirEnPanelQA:async()=>{aperturas++;await pendiente;},
  render:()=>{renderizados.push(1)},
  aviso:x=>alertas.push(x)
 };
 const contexto=vm.createContext(datos);
 vm.runInContext(codigo+'\nglobalThis.entrarEnPrueba=entrarSuc;',contexto);
 return {entrar:contexto.entrarEnPrueba,terminar:()=>resolver(),
  resultado:()=>({aperturas,alertas,renderizados})};
}
test('dos pulsaciones simultáneas de Abrir Romo crean UNA sola apertura',async()=>{
 const x=escenario();const a=x.entrar(),b=x.entrar();
 await b;
 assert.equal(x.resultado().aperturas,1);
 assert.equal(x.resultado().alertas.length,0);
 x.terminar();await a;
 assert.equal(x.resultado().renderizados.length,1);
});
test('una confirmación distinta se rechaza antes de hacer peticiones o abrir Romo',async()=>{
 const x=escenario({confirmacion:'ClaveDiferente0123'});
 await x.entrar();
 assert.equal(x.resultado().aperturas,0);
 assert.match(x.resultado().alertas[0],/no coincide/);
 assert.equal(x.resultado().renderizados.length,0);
});
test('la vista publicada de Romo conserva la misma protección que el código fuente',()=>{
 const original=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url));
 const publicado=readFileSync(new URL('../public/romo-qa/uki-sushi-local.html',import.meta.url));
 assert.deepEqual(publicado,original);
});
