import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crearPuenteRomoOperativoQA,ROMO_OPERATIVO_ID_QA,ROMO_OPERATIVO_SUCURSAL_QA}
 from '../firebase/uki-romo-operativo-qa.mjs';

const panelSource=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
const clientSource=readFileSync(new URL('../firebase/uki-romo-operativo-qa.mjs',import.meta.url),'utf8');

function deps(){
 const calls=[];
 const puente=crearPuenteRomoOperativoQA({
  getGoogleToken:async()=>{calls.push('google');return 'fake_token_'.repeat(8)},
  fetchFn:async()=>{calls.push('fetch');throw Error('No debe usar la red')},
  cifrar:async()=>{calls.push('cifrar');return {}},
  descifrar:async()=>{calls.push('descifrar');return {}},
  validarEstado:()=>{calls.push('validar');return true}
 });
 return {puente,calls};
}
test('QA: estado operativo Romo APAGADO; no pide credenciales, no cifra ni usa red',async()=>{
 const {puente,calls}=deps();
 assert.equal(puente.disponible(),false);
 await assert.rejects(puente.cargar({password:'ClaveActualDeUki2026'}),/no habilitadas/);
 await assert.rejects(puente.guardar({
  estado:{suc:'Romo’s Sushi La Serena'},revision:0,password:'ClaveActualDeUki2026'
 }),/no habilitadas/);
 assert.deepEqual(calls,[]);
});
test('no permite conectar una URL distinta a la deshabilitada desde el navegador',async()=>{
 let called=false;
 const bridge=crearPuenteRomoOperativoQA({
  endpoint:'https://otro-sitio.example/api/romo',
  getGoogleToken:async()=>{called=true;return 'token'},
  fetchFn:async()=>{called=true;return null},
  cifrar:async()=>{},descifrar:async()=>{},validarEstado:()=>true
 });
 assert.equal(bridge.disponible(),false);
 await assert.rejects(bridge.cargar({password:'ClaveActualDeUki2026'}),/no habilitadas/);
 assert.equal(called,false);
});
test('mismo formato de datos, no un panel distinto para Romo',()=>{
 assert.equal(ROMO_OPERATIVO_ID_QA,'romo:serena');
 assert.equal(ROMO_OPERATIVO_SUCURSAL_QA,'Romo’s Sushi La Serena');
 assert.match(panelSource,/function estadoVacioSucursal\(s\)/);
 assert.match(panelSource,/function validarEstadoSucursal\(datos,suc\)/);
 assert.match(panelSource,/async function cifrarLocal\(datos,suc,key,salt\)/);
 assert.match(panelSource,/async function abrirLocal\(raw,suc,password\)/);
 assert.match(clientSource,/cifrar,descifrar,validarEstado/);
 assert.match(clientSource,/const ROMO_OPERATIVO_ENDPOINT_QA='';/);
 assert.match(clientSource,/method,headers:/);
 assert.doesNotMatch(clientSource,/setItem\(|fetch\([^)]*password/);
});
test('no manda contraseña ni pedidos en texto abierto; solo snapshot cifrado',()=>{
 assert.match(clientSource,/body:JSON\.stringify\(body\)/);
 assert.match(clientSource,/expectedRevision:revision,snapshot/);
 assert.doesNotMatch(clientSource,/body:JSON\.stringify\(\{[^}]*password/);
 assert.doesNotMatch(clientSource,/const ROMO_OPERATIVO_ENDPOINT_QA='https:/);
});
test('detectará conflicto 409 y no intenta sobrescribir una versión atrasada',()=>{
 assert.match(clientSource,/response\.status===409/);
 assert.match(clientSource,/new RomoGuardarConflictoQA\(\)/);
 assert.match(clientSource,/result\.revision!==revision\+1/);
});
