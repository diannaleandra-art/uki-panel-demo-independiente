'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const begin=html.indexOf("      let autorizacion='';");
const finish=html.indexOf('      let correccionHistorica=null;',begin);
assert.ok(begin>0&&finish>begin,'debe existir validación de responsable en edición');
const guard=html.slice(begin,finish);
function ensayo(nombre){
 const avisos=[],campo={focusCalled:false,scrollCalled:false,focus(){this.focusCalled=true},scrollIntoView(){this.scrollCalled=true}};
 const ctx={D:{responsableEdicion:nombre},cierreHistorico:null,snapshot:{},esDelPeriodo:()=>true,
  ukiTimbreResponsableActual:()=>{throw Error('No debe heredarse el nombre del turno')},
  aviso:x=>avisos.push(x),document:{getElementById:id=>id==='ukiResponsableEdicion'?campo:null}};
 const fn=vm.runInNewContext('(function(){'+guard+'return autorizacion;})',ctx);
 return {nombre:fn(),avisos,campo};
}
test('No guarda una edición sin escribir el nombre de quien corrige',()=>{
 const x=ensayo('');
 assert.equal(x.nombre,undefined);
 assert.match(x.avisos.join(' '),/No se guardó/);
 assert.equal(x.campo.focusCalled,true);
});
test('Espacios no cuentan como identificación',()=>{
 const x=ensayo('   ');
 assert.equal(x.nombre,undefined);
});
test('Guarda exactamente la identidad escrita, no la del turno',()=>{
 const x=ensayo('  María Agendadora  ');
 assert.equal(x.nombre,'María Agendadora');
 assert.equal(x.avisos.length,0);
});
test('El nombre aparece solo al editar y se registra en el historial de correcciones',()=>{
 assert.match(html,/D.editando\?'<div class="card"><h2>Responsable de la corrección/);
 assert.match(html,/oninput="D.responsableEdicion=this.value"/);
 assert.match(html,/responsableEdicion:"",editando:id/);
 assert.match(html,/responsable:autorizacion,antes,despues/);
 assert.match(html,/\$\{ukiCorreccionesTurnoUI\(p\)\}/);
});
test('Historial deja ver nombre, hora, pago y lista de productos antes y después',()=>{
 const a=html.indexOf('function ukiCorreccionesTurnoUI(p){'),b=html.indexOf('function ukiVCorreccionesPedido(p){',a);
 assert.ok(a>0&&b>a);
 const ctx={fmt:x=>'$'+Number(x).toLocaleString('es-CL'),esc:x=>String(x).replace(/</g,'&lt;').replace(/>/g,'&gt;')};
 const render=vm.runInNewContext(html.slice(a,b)+'\nukiCorreccionesTurnoUI',ctx);
 const salida=render({correccionesTurno:[{responsable:'María',fechaISO:'2026-11-08T22:10:00',
  antes:{total:16800,medio:'Efectivo',productos:[{nombre:'Gohan',cantidad:1,precioUnit:2800}]},
  despues:{total:14000,medio:'Transferencia',productos:[]},saldoPendiente:2800}]});
 assert.match(salida,/Modificación 1 · María/);
  assert.match(salida,/Fecha y hora:/);
 assert.match(salida,/Medio de pago/);
  assert.match(salida,/Antes: Efectivo/);
  assert.match(salida,/Después: Transferencia/);
 assert.match(salida,/Antes: 1 × Gohan/);
 assert.match(salida,/Después: Sin productos/);
 assert.match(salida,/Diferencia pendiente/);
});
test('Correcciones previas sin un responsable siguen visibles sin inventar una identidad',()=>{
 const a=html.indexOf('function ukiCorreccionesTurnoUI(p){'),b=html.indexOf('function ukiVCorreccionesPedido(p){',a);
 const ctx={fmt:x=>'$'+Number(x),esc:x=>String(x)};
 const render=vm.runInNewContext(html.slice(a,b)+'\nukiCorreccionesTurnoUI',ctx);
 const salida=render({correccionesTurno:[{fechaISO:'2026-11-08',antes:{total:1000},despues:{total:900}}]});
 assert.match(salida,/No identificado en registros antiguos/);
  assert.doesNotMatch(salida,/Modificación 1 · (?:María|Sara|Jorge)/);
});
