import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crearControlRomoMismoPanelQA} from '../firebase/uki-romo-panel-control-qa.mjs';
const SUC='Romo’s Sushi La Serena',password='ClaveQA_Prueba_SinDatos2026';
function crear({revision=0,confirmarClaveInicial}={}){
 let applied=0,loaded=0;
 const c=crearControlRomoMismoPanelQA({
  habilitado:true,
  obtenerToken:async()=> 'token_ficticio_'.repeat(5),
  validarClave:async p=>p===password,
  confirmarClaveInicial,
  crearInicial:()=>({suc:SUC,pedidos:[]}),
  validarEstado:(v,s)=>v?.suc===s,
  estadoRemoto:{disponible:()=>true,cargar:async()=>{
   loaded++;return {revision,estado:revision?{suc:SUC,pedidos:[]}:null};
  }},
  bandeja:{disponible:()=>true},
  aplicarEstado:async()=>{applied++}
 });
 return {c,counters:()=>({applied,loaded})};
}
test('sin confirmación inicial se bloquea el primer ingreso sin crear registros',async()=>{
 const x=crear();
 await assert.rejects(x.c.abrir({password}),/Primera apertura/);
 assert.deepEqual(x.counters(),{applied:0,loaded:1});
 assert.equal(x.c.resumen().abierto,false);
});
test('una segunda clave distinta no abre ni muestra pedidos',async()=>{
 const x=crear({confirmarClaveInicial:async()=>false});
 await assert.rejects(x.c.abrir({password}),/no coincide/);
 assert.equal(x.counters().applied,0);
 assert.equal(x.c.resumen().abierto,false);
});
test('primera apertura confirmada solo permite estado vacío de Romo, no crea venta',async()=>{
 let calls=0;
 const x=crear({confirmarClaveInicial:async pass=>{calls++;return pass===password}});
 const result=await x.c.abrir({password});
 assert.equal(result.revision,0);
 assert.equal(x.c.resumen().abierto,true);
 assert.equal(x.counters().applied,1);
 assert.equal(calls,1);
});
test('si ya existe estado cifrado, no vuelve a exigir doble ingreso',async()=>{
 const x=crear({revision:3});
 const result=await x.c.abrir({password});
 assert.equal(result.revision,3);
 assert.deepEqual(x.counters(),{applied:1,loaded:1});
});
test('validación explícita negativa de clave bloquea acceso antes de leer Neon',async()=>{
 const x=crear();
 await assert.rejects(x.c.abrir({password:'ClaveErroneaDePrueba'}),/validación/);
 assert.deepEqual(x.counters(),{applied:0,loaded:0});
});
test('panel usa campo password solo primera apertura y conserva las sucursales Uki',()=>{
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(html,/id="ukiRomoConfirmacionClaveQA" type="password"/);
 assert.match(html,/confirmarClaveInicial:async\(pass\)=>/);
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(html,/Esta dirección no puede comprobar la clave contra Uki original/);
});

test('la primera clave de Romo se captura antes de comenzar las peticiones, no tras render',()=>{
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const inicio=html.indexOf('async function ukiRomoAbrirEnPanelQA(password){');
 const previo=html.slice(inicio,html.indexOf('const google=async()=>',inicio));
 assert.match(previo,/const confirmacionInicial=String\(\$\('ukiRomoConfirmacionClaveQA'\)\?\.value\|\|''\)/);
 const callback=html.slice(html.indexOf('confirmarClaveInicial:async(pass)=>',inicio),
  html.indexOf('crearInicial:',inicio));
 assert.match(callback,/confirmacionInicial\.length>=12&&confirmacionInicial===pass/);
 assert.doesNotMatch(callback,/\$\('ukiRomoConfirmacionClaveQA'\)/);
});
