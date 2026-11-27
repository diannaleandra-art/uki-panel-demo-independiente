'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('public/romo-panel-qa/index.html','utf8');
const chunk=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert.ok(start>=0&&end>start);return html.slice(start,end);};
const guard=chunk('function ukiValidarResponsableEdicion(d){','function ukiRevisionBancoBorradorValidaQA(');
function ensayo(nombre){
 const avisos=[],campo={focusCalled:false,scrollCalled:false,focus(){this.focusCalled=true},scrollIntoView(){this.scrollCalled=true}};
 const ctx={aviso:x=>avisos.push(x),document:{getElementById:id=>id==='ukiResponsableEdicion'?campo:null}};
 const validar=vm.runInNewContext(guard+'\nukiValidarResponsableEdicion',ctx);
 return {nombre:validar({responsableEdicion:nombre}),avisos,campo};
}
test('No guarda una edición sin escribir el nombre de quien corrige',()=>{
 const x=ensayo('');
 assert.equal(x.nombre,'');
 assert.match(x.avisos.join(' '),/No se guardó/);
 assert.equal(x.campo.focusCalled,true);
});
test('Espacios no cuentan como identificación',()=>{
 const x=ensayo('   ');
 assert.equal(x.nombre,'');
});
test('Guarda exactamente la identidad escrita, no la del turno',()=>{
 const x=ensayo('  María Agendadora  ');
 assert.equal(x.nombre,'María Agendadora');
 assert.equal(x.avisos.length,0);
});
test('El nombre aparece solo al editar y se registra en el historial de correcciones',()=>{
 assert.match(html,/D\.editando&&[\s\S]*?ukiResponsableEdicionUI\(D\)/);
 assert.match(html,/function ukiResponsableEdicionUI\(d\)\{[\s\S]*?id="ukiResponsableEdicion"/);
 assert.match(html,/oninput="D.responsableEdicion=this.value"/);
 assert.match(html,/responsableEdicion:"",editando:id/);
 assert.doesNotMatch(html,/ukiIdentidadEdicionQA/);
 const input=html.slice(html.indexOf('function ukiResponsableEdicionUI(d){'),html.indexOf('function ukiRevisionBancoBorradorValidaQA('));
 const render=vm.runInNewContext(input+'\nukiResponsableEdicionUI',{esc:x=>String(x)});
 assert.match(render({responsableEdicion:''}),/value=""/);
 assert.match(render({responsableEdicion:''}),/¿Quién hizo este cambio\? · Obligatorio/);
 assert.match(render({responsableEdicion:'María Agendadora'}),/value="María Agendadora"/);
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
 assert.match(salida,/Modificación 1 · Editado por María/);
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
  assert.doesNotMatch(salida,/Editado por (?:María|Sara|Jorge)/);
});

test('Cada edición empieza sin responsable y no hereda la cuenta administrativa ni el nombre anterior',()=>{
 const romo=true;
 const suc=romo?'Romo’s Sushi La Serena':'Uki Regimiento Arica';
 const ctx={S:{suc,pedidos:[{id:692,estado:'Pendiente',pagado:false},{id:693,estado:'Pendiente',pagado:false}]},
  D:{},modoNuevo:'',ukiBaseRectificacionEdicion:null,ROMO_SUCURSAL_QA:suc,
  ahora:()=>new Date().toISOString(),aviso:()=>{},ir:()=>{},ukiMontoEnvioOtroLocal:()=>0,
  ukiTimbreYaEnviadoPedido:()=>true,ukiRecuperarTimbreEdicionQA:()=>{},ukiFirmaOtrosCambiosRectificacion:()=>'',ukiDatosCatalogoItem:()=>({}),
  window:{ukiIdentidadEdicionQA:()=>{throw Error('No debe extraer el nombre de Google');}}
 };
 vm.createContext(ctx);
 vm.runInContext(chunk('function editarPedido(id){','function reanalizar(){'),ctx);
 ctx.editarPedido(692);assert.equal(ctx.D.responsableEdicion,'');
 ctx.D.responsableEdicion='Andrey Cane';
 assert.equal(ctx.D.responsableEdicion,'Andrey Cane');
 ctx.editarPedido(693);assert.equal(ctx.D.responsableEdicion,'');
});
test('No toca verificación bancaria ni sincroniza un cambio de entrega si falta el nombre',async()=>{
 const romo=true;
 const suc=romo?'Romo’s Sushi La Serena':'Uki Regimiento Arica';
 const D={editando:692,pagado:true,responsableEdicion:'   '}, p={id:692,suc};
 const trace=[],campo={focus(){trace.push('focus');},scrollIntoView(){trace.push('scroll');}};
 const ctx={D,S:{suc,pedidos:[p]},ROMO_SUCURSAL_QA:suc,ukiRomoFormularioGuardandoQA:false,
  ukiGuardadoSolicitudEnCurso:false,ukiQRComprobandoCobro:false,ukiRomoOperacionesEnCursoQA:()=>false,
  ukiCambioRetiroSinAbonoQA:()=>false,ukiPlanRetiroSinAbonoQA:()=>null,ukiPideRectificacionPago:()=>false,
  ukiGuardarFormularioQA:async()=>trace.push('validar banco y guardar'),
  aviso:m=>trace.push(m),document:{getElementById:id=>id==='ukiResponsableEdicion'?campo:null},
  window:{UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED:true}};
 vm.createContext(ctx);
 vm.runInContext(guard+chunk('async function ndGuardar(){','async function ukiGuardarFormularioQA'),ctx);
 await ctx.ndGuardar();assert.deepEqual(trace,['No se guardó: escribe el nombre de quien hizo la corrección.','focus','scroll']);
 trace.length=0;D.responsableEdicion='Andrey Cane';
 await ctx.ndGuardar();assert.deepEqual(trace,['validar banco y guardar']);
});
test('Corrección histórica conserva responsable escrito, motivo y confirmación existente',()=>{
 assert.match(html,/Escribe el motivo de la corrección \(obligatorio\)/);
 assert.match(html,/nota:\(autorizacion\+' · '\+nota\.trim\(\)\)/);
 assert.match(html,/responsable:autorizacion,nota:correccionHistorica\.nota/);
 assert.match(html,/los importes, el PDF y los pagos del cierre original NO se modificarán/);
});
