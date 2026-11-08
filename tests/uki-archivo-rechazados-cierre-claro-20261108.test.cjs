'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');

test('El JavaScript central del panel conserva sintaxis válida',()=>{
 const m=html.match(/<script>([\s\S]*?)<\/script>/i);
 assert.ok(m&&m[1].includes('function vPedidos(){'),'El script principal no se encontró');
 assert.doesNotThrow(()=>new vm.Script(m[1],{filename:'uki-sushi-local.inline.js'}));
});

test('El precierre y cierre definitivo están separados y tienen explicaciones y guardas explícitas',()=>{
 assert.match(html,/\["precierre","Precierre trabajador"\]/);
 assert.match(html,/\["cierre","Cierre definitivo"\]/);
 assert.match(html,/precierre:vPrecierreTrabajadores,cierre:vCierre/);
 assert.match(html,/ir\(\\'precierre\\'\).*?PRECIERRE del trabajador/);
 assert.match(html,/PRECIERRE DEL TRABAJADOR · NO CIERRA EL DÍA/);
 assert.match(html,/CIERRE DEFINITIVO · \$\{fechaOperativaActual\(\)\}/);
 assert.match(html,/id="ukiConfirmarCierreDefinitivo" type="checkbox"/);
 assert.match(html,/if\(!\$\("ukiConfirmarCierreDefinitivo"\)\?\.checked\)/);
 assert.match(html,/CONFIRMAR CIERRE DEFINITIVO/);
 const c=html.slice(html.indexOf('function cerrar(){'),html.indexOf('\nfunction ',html.indexOf('function cerrar(){')+4));
 assert.ok(c.indexOf('ukiConfirmarCierreDefinitivo')>=0);
 assert.ok(c.indexOf('ukiConfirmarCierreDefinitivo')<c.indexOf('S.cierres.push('));
 assert.match(c,/S\.cierres\.push\(/);
});

test('Un rechazo antiguo sale de Todos tras el corte; los pendientes no desaparecen',()=>{
 const m=html.match(/const remotasTurno=remotasTodas\.filter\(r=>\{[\s\S]*?\n  \}\);/);
 assert.ok(m,'No se encontró el filtro del turno');
 const evaluate=new Function('remotasTodas','corteDelDiaMs',m[0]+'\nreturn remotasTurno;');
 const cutoff=Date.parse('2026-11-08T00:30:00Z');
 const rows=[
  {id:'antes',estado:'rechazada',creado_en:'2026-11-07T20:00:00Z'},
  {id:'hoy',estado:'rechazada',creado_en:'2026-11-08T08:00:00Z'},
  {id:'pendiente',estado:'pendiente',creado_en:'2026-11-06T08:00:00Z'},
  {id:'sin-fecha',estado:'rechazada',creado_en:null}
 ];
 const visible=evaluate(rows,()=>cutoff);
 assert.deepEqual(visible.map(x=>x.id),['hoy','pendiente','sin-fecha']);
 assert.equal(rows.length,4,'No se borran registros históricos');
 assert.match(html,/const remotas=remotasTurno/);
 assert.match(html,/function ukiHistorialSolicitudesRechazadas\(\)/);
});

test('Los rechazados nunca se registran como ventas',()=>{
 assert.match(html,/No cuentan como pedidos, ventas ni timbres/);
 assert.match(html,/if\(s\.estado==="aceptada"\)return false/);
 assert.match(html,/const remotasTurno=remotasTodas/);
 assert.match(html,/const urgentesCarta=remotas\.filter\(r=>r\.estado==='pendiente'\)/);
});

test('Resumen provisional no crea precierre ni cierre',()=>{
 assert.match(html,/Resumen provisional del turno/);
 assert.match(html,/Este resumen no registra ningún precierre ni cierre definitivo/);
 assert.match(html,/Guardar PRECIERRE del trabajador · dejar día abierto/);
});
