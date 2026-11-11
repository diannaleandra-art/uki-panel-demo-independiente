'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const panel=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const main=panel.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
const start=main.indexOf('const ROMO_QA_STORE_ID=');
const end=main.indexOf('function pedirPin(s)',start);
assert.ok(start>0&&end>start,'Sección del acceso Romo QA');
const romo=main.slice(start,end);

function harness({serena=false,arica=false,validPassword='ClaveUkiSegura123'}={}){
 const entries=new Map();
 if(serena)entries.set('uki_operativo_v1_cifrado_la-serena','cifrado-uki-serena');
 if(arica)entries.set('uki_operativo_v1_cifrado_regimiento','cifrado-uki-arica');
 const reads=[],writes=[];
 const data={
  S:{romoSeleccionadoQA:true,suc:null,pinSuc:null},
  SUCURSALES:['Uki Regimiento Arica','Uki La Serena'],
  localStorage:{
   getItem(k){reads.push(k);return entries.get(k)||null},
   setItem(k,v){writes.push([k,v]);entries.set(k,v)}
  },
  crypto:{subtle:{}},
  claveLocal(s){return s==='Uki La Serena'?'uki_operativo_v1_cifrado_la-serena':
   s==='Uki Regimiento Arica'?'uki_operativo_v1_cifrado_regimiento':'desconocida'},
  async abrirLocal(raw,suc,pass){
   if(pass!==validPassword)throw Error('Clave incorrecta');
   if(raw==='cifrado-uki-serena'&&suc==='Uki La Serena')return {estado:{suc}};
   if(raw==='cifrado-uki-arica'&&suc==='Uki Regimiento Arica')return {estado:{suc}};
   throw Error('Bóveda no válida');
  },
  $:()=>({value:validPassword}),
  render(){},
  aviso(){}
 };
 const context=vm.createContext(data);
 vm.runInContext(romo+'\nglobalThis.romotest={verify:ukiValidarClaveUkiParaRomoQA,enter:ukiEntrarRomoQA};',context);
 return {testFns:context.romotest,entries,reads,writes,data};
}
test('Romo usa la misma clave de Uki; no aparece Crear acceso ni confirmar contraseña',()=>{
 assert.match(main,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(main,/Ingresa con la misma contraseña que utilizas en Uki La Serena o Uki Regimiento Arica/);
 assert.match(main,/onclick="ukiEntrarRomoQA\(\)">Abrir sucursal/);
 assert.doesNotMatch(romo,/ukiCrearClaveRomoQA|ukiAccesoConfirmar|setItem\(/);
 assert.doesNotMatch(main,/Romo Regimiento Arica/);
});
test('acepta la contraseña existente de Uki La Serena',async()=>{
 const h=harness({serena:true});
 assert.equal(await h.testFns.verify('ClaveUkiSegura123'),true);
 assert.equal(h.writes.length,0,'Nunca escribe ni copia datos de Uki');
 assert.deepEqual([...h.entries.keys()],['uki_operativo_v1_cifrado_la-serena']);
});
test('acepta también la contraseña existente de Uki Regimiento Arica',async()=>{
 const h=harness({arica:true});
 assert.equal(await h.testFns.verify('ClaveUkiSegura123'),true);
 assert.equal(h.writes.length,0);
});
test('no acepta una clave equivocada aunque haya datos de Uki en el equipo',async()=>{
 const h=harness({serena:true,arica:true});
 await assert.rejects(()=>h.testFns.verify('OtraClave12345678'),/no coincide con las sucursales Uki/);
 assert.equal(h.writes.length,0);
});
test('si la clave Uki no existe en este navegador, no crea una nueva para Romo',async()=>{
 const h=harness();
 await assert.rejects(()=>h.testFns.verify('ClaveUkiSegura123'),/Primero abre Uki/);
 assert.equal(h.entries.size,0);
 assert.equal(h.writes.length,0);
});
test('el ingreso de prueba no abre pedidos y la selección sigue separada',async()=>{
 const h=harness({serena:true});
 await h.testFns.enter();
 assert.equal(h.data.S.romoIngresadoQA,true);
 assert.equal(h.data.S.suc,null,'No convierte Romo en sucursal Uki');
 assert.equal(h.writes.length,0);
 assert.match(main,/pedidos, caja, inventario y cierres de Romo todavía no están habilitados/);
 assert.match(main,/body\.romo-qa #ukiNubeSeccion/);
});
test('código del panel conserva sintaxis JavaScript',()=>{
 assert.doesNotThrow(()=>new vm.Script(main));
});
