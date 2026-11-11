'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {TextEncoder,TextDecoder,atob,btoa}=require('node:util');

const html=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const main=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
function span(begin,end){
 const start=main.indexOf(begin),finish=main.indexOf(end,start+begin.length);
 assert.ok(start>=0&&finish>start,'No se encontró segmento de código '+begin);
 return main.slice(start,finish);
}
const b64=span('const ukiB64=arr=>','async function ukiClaveBackup(');
const derive=span('async function ukiClaveBackup(','async function ukiCifrarRespaldo(');
const romo=span('const ROMO_QA_LOCAL_KEY=','function pedirPin(s)');

function romoHarness(){
 const entries=new Map();
 const localStorage={
  getItem(k){return entries.has(k)?entries.get(k):null},
  setItem(k,v){entries.set(k,String(v));},
  removeItem(k){entries.delete(k);}
 };
 const context={crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,atob,btoa,localStorage};
 vm.createContext(context);
 vm.runInContext(
  'const UKI_BACKUP_ITER=300000;\n'+b64+derive+romo+'\n'+
  'globalThis.romoQA={create:ukiCrearClaveRomoQA,verify:ukiVerificarClaveRomoQA};',
  context,{filename:'uki-romo-ingreso-qa.js'}
 );
 return {qa:context.romoQA,localStorage,entries};
}

test('Romo muestra el mismo formulario que Uki y no requiere otro panel',()=>{
 assert.match(main,/function ukiAbrirRomoLaSerena\(\)/);
 assert.match(main,/id="ukiAccesoClave" type="password"/);
 assert.match(main,/id="ukiAccesoConfirmar" type="password"/);
 assert.match(main,/ukiEntrarRomoQA\(\)/);
 assert.match(main,/Abrir sucursal/);
 assert.match(main,/Crear acceso/);
 assert.doesNotMatch(main,/Romo Regimiento Arica/);
});
test('la lista operativa original y el guardado cifrado Uki NO se tocan',()=>{
 assert.match(main,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(main,/const claveLocal=s=>UKI_LOCAL_PREFIX\+\(SUCURSALES\.indexOf\(s\)===0\?"regimiento":SUCURSALES\.indexOf\(s\)===1\?"la-serena":"desconocida"\)/);
 assert.match(main,/romo_operativo_v1_cifrado_la-serena/);
 assert.match(main,/if\(!SUCURSALES\.includes\(s\)\)return/);
 assert.match(main,/pedidos, caja, inventario y cierres de Romo todavía no están habilitados/);
});
test('la contraseña de Romo se cifra con AES-GCM y no se almacena en texto',async()=>{
 const {qa,localStorage,entries}=romoHarness();
 const pass='ClaveDeRomoSegura123';
 await qa.create(pass);
 const stored=localStorage.getItem('romo_operativo_v1_cifrado_la-serena');
 assert.ok(stored);
 assert.ok(!stored.includes(pass));
 assert.deepEqual([...entries.keys()],['romo_operativo_v1_cifrado_la-serena']);
 const record=JSON.parse(stored);
 assert.equal(record.storeId,'romo:serena');
 assert.equal(record.formato,'romo-acceso-local-qa-v1');
 assert.equal(typeof record.cifrado,'string');
 assert.ok(await qa.verify(pass));
 await assert.rejects(()=>qa.verify('ContraseñaErrónea987'),/OperationError|decrypt|authentication|Error/i);
});
test('Romo rechaza claves cortas, intentos de sobrescritura y otros locales',async()=>{
 const {qa,localStorage}=romoHarness();
 await assert.rejects(()=>qa.create('corta'),/12 caracteres/);
 await qa.create('RomoContratoSeguro678');
 await assert.rejects(()=>qa.create('OtraClaveSegura987'),/Ya existe/);
 const key='romo_operativo_v1_cifrado_la-serena';
 const item=JSON.parse(localStorage.getItem(key));
 localStorage.setItem(key,JSON.stringify({...item,storeId:'uki:serena'}));
 await assert.rejects(()=>qa.verify('RomoContratoSeguro678'),/Acceso de prueba no válido/);
});
test('no permite abrir pedidos reales desde el ingreso QA',()=>{
 assert.match(main,/S\.romoIngresadoQA=true;render\(\)/);
 assert.match(main,/S\.romoIngresadoQA=false;render\(\)/);
 assert.match(main,/if\(!S\.suc&&!S\.pinSuc&&S\.romoSeleccionadoQA\)/);
 assert.match(main,/Vista de prueba de ingreso local/);
 assert.match(main,/todavía no verifica Google ni sincroniza la base Romo/);
 assert.doesNotMatch(romo,/S\.suc\s*=\s*["']Romo/);
 assert.doesNotMatch(romo,/ukiQAOnLocalSaved/);
});
test('el JavaScript principal mantiene sintaxis válida',()=>{
 assert.doesNotThrow(()=>new vm.Script(main));
});
