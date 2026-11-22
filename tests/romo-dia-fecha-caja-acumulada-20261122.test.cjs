'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file=fs.readFileSync('public/romo-panel-qa/romo-caja-acumulada-operativa.js','utf8');
const a=file.indexOf('const movimientoFechaChile=');
const b=file.indexOf("function status(msg,kind=''){",a);
assert.ok(a>=0&&b>a,'Falta el formato de fecha auditado');
const {fechaHoraMovimiento,fechaOperativaLegible}=new Function(file.slice(a,b)+'\nreturn {fechaHoraMovimiento,fechaOperativaLegible};')();
test('el registro muestra día, fecha y hora local incluso después de medianoche',()=>{
 assert.equal(fechaHoraMovimiento('2026-11-21T03:12:00Z'),'Sábado 21 de noviembre de 2026 · 00:12');
 assert.equal(fechaHoraMovimiento('2026-11-18T15:37:00Z'),'Miércoles 18 de noviembre de 2026 · 12:37');
});
test('se distingue el día operativo de la fecha del registro',()=>{
 assert.equal(fechaOperativaLegible('2026-11-20'),'Viernes 20 de noviembre de 2026');
 assert.equal(fechaOperativaLegible('2026-02-31'),null);
 assert.equal(fechaOperativaLegible('sin fecha'),null);
 assert.equal(fechaHoraMovimiento(null),'Fecha y hora sin registrar');
});
test('los datos originales y el importe se muestran sin escribir en la base',()=>{
 assert.match(file,/const diaTurno=\['cierre','ajuste_cierre'\]/);
 assert.match(file,/registrado\.textContent='📅 Registrado: '\+fechaHoraMovimiento\(x\.creado_en\)/);
 assert.match(file,/info\.textContent=String\(x\.concepto\|\|'Sin concepto'\)/);
 assert.match(file,/sum\.textContent=\(Number\(x\.monto\)>0\?'\+':''\)\+money\(x\.monto\)/);
 assert.match(file,/turno\.textContent='Turno: '\+diaTurno/);
});
test('Romo toma el día del turno de la referencia original del cierre',()=>{
 assert.match(file,/source_key/);
 assert.match(file,/romo:serena/);
});
