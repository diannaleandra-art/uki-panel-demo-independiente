'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const panel=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const main=panel.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
const start=main.indexOf('const ROMO_SERENA_QA=');
const end=main.indexOf('async function salirSuc(){',start);
assert.ok(start>0&&end>start,'Sección del ingreso único');
const login=main.slice(start,end);

function harness({serena=false,arica=false,validPassword='ClaveUkiSegura123',inputPassword='ClaveUkiSegura123'}={}){
 const ROMO='Romo’s Sushi La Serena';
 const entries=new Map();
 if(serena)entries.set('uki_operativo_v1_cifrado_la-serena','cifrado-uki-serena');
 if(arica)entries.set('uki_operativo_v1_cifrado_regimiento','cifrado-uki-arica');
 const reads=[],writes=[],entered=[],alerts=[];
 const data={
  S:{romoSeleccionadoQA:false,romoIngresadoQA:false,suc:null,pinSuc:ROMO},
  SUCURSALES:['Uki Regimiento Arica','Uki La Serena'],
  SUCURSALES_PANEL_QA:['Uki Regimiento Arica','Uki La Serena',ROMO],
  ROMO_SUCURSAL_QA:ROMO,
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
  async entrarDatosSucursal(s,pass){entered.push({s,pass});data.S.suc=s;data.S.pinSuc=null},
  $:()=>({value:inputPassword}),
  render(){},aviso(msg){alerts.push(msg)}
 };
 const context=vm.createContext(data);
 vm.runInContext(login+'\nglobalThis.romotest={verify:ukiValidarClaveUkiParaRomoQA,enter:entrarSuc,choose:pedirPin};',context);
 return {testFns:context.romotest,entries,reads,writes,entered,alerts,data,ROMO};
}
test('no se introdujo segundo formulario de ingreso para Romo',()=>{
 assert.match(main,/SUCURSALES_PANEL_QA\.map\(s=>/);
 assert.match(main,/onclick="entrarSuc\(\)"/);
 assert.doesNotMatch(main,/ukiEntrarRomoQA\(|ukiAbrirRomoLaSerena\(/);
 assert.match(main,/const existe=esRomo\|\|!!localStorage\.getItem/);
 assert.match(main,/Ingresa con la misma contraseña de Uki/);
 assert.doesNotMatch(main,/Romo Regimiento Arica/);
});
test('mismo botón de ingreso Romo acepta contraseña ya existente de Uki La Serena',async()=>{
 const h=harness({serena:true});
 await h.testFns.enter();
 assert.equal(h.data.S.romoIngresadoQA,true);
 assert.equal(h.data.S.romoSeleccionadoQA,true);
 assert.equal(h.data.S.suc,null);
 assert.equal(h.data.S.pinSuc,null);
 assert.equal(h.writes.length,0);
 assert.equal(h.entered.length,0,'No abre datos de Uki como Romo');
});
test('la misma contraseña de Uki Regimiento también comprueba Romo',async()=>{
 const h=harness({arica:true});
 await h.testFns.enter();
 assert.equal(h.data.S.romoIngresadoQA,true);
 assert.equal(h.entered.length,0);
 assert.equal(h.writes.length,0);
});
test('sin contraseña existente de Uki no se crea otra en Romo',async()=>{
 const h=harness();
 await h.testFns.enter();
 assert.equal(h.data.S.romoIngresadoQA,false);
 assert.equal(h.alerts.length,1);
 assert.equal(h.entries.size,0);
});
test('una contraseña incorrecta no abre Romo',async()=>{
 const h=harness({serena:true,validPassword:'ClaveCorrectaUki2026'});
 await h.testFns.enter();
 assert.equal(h.data.S.romoIngresadoQA,false);
 assert.equal(h.alerts.length,1);
 assert.equal(h.writes.length,0);
});
test('seleccionar Uki deja intacta su apertura original',async()=>{
 const h=harness({serena:true});
 h.testFns.choose('Uki La Serena');
 assert.equal(h.data.S.pinSuc,'Uki La Serena');
 await h.testFns.enter();
 assert.equal(h.entered.length,1);
 assert.equal(h.entered[0].s,'Uki La Serena');
 assert.equal(h.data.S.romoSeleccionadoQA,false);
 assert.equal(h.data.S.suc,'Uki La Serena');
});
test('ningún local ajeno puede ingresar por el selector',()=>{
 const h=harness();
 h.testFns.choose('Romo Regimiento Arica');
 assert.equal(h.data.S.pinSuc,h.ROMO);
});
test('el panel principal mantiene sintaxis válida',()=>assert.doesNotThrow(()=>new vm.Script(main)));
