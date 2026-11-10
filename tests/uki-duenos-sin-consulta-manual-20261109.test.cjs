'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../firebase');
const current=fs.readFileSync(path.join(root,'mi-administracion.html'),'utf8');
const qa=fs.readFileSync(path.join(root,'mi-administracion-vista-previa-duenos.html'),'utf8');
test('Se elimina la consulta cifrada manual que la dueña no necesita',()=>{
 for(const phrase of ['ukiOwnerClave','ukiOwnerConsultar','ukiOwnerBridge','lecturaUki.cargar',
 'Crear respaldo para leer','Clave del respaldo cifrado','Selecciona el respaldo de esta sucursal']){
  assert.equal(qa.includes(phrase),false,phrase);
 }
 assert.match(qa,/Conexión automática pendiente/);
 assert.match(qa,/Los cierres automáticos de Uki aún no se reciben/);
});
test('Se conservan las ventas manuales, cierres y acceso de dueños',()=>{
 for(const id of ['saveSale','saleSource','saleTotal','saleDate','saleBiz','saleBranch',
  'salePhoto','saleRef','paymentFields','m-ventas','m-gastos','m-resultado',
  'm-pendientes','google','pin','enter','exit','homeActions','tabs','ukiGoTodasVentas',
  'ukiOwnerListadoVentas','ukiOwnerFinancierasLista']){
  assert.equal((qa.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 for(const needle of ["api('guardar_movimiento',payload)","api('resumen',params)","api('listar_movimientos',params)","renderRows();renderPayments(s.pagos)","mostrarVentasFinancieras()","document.querySelectorAll('[data-go]')"]){
  assert.ok(qa.includes(needle),'Conservar '+needle);
 }
 assert.match(qa,/if\(total&&total!==monto\)/);
 assert.match(qa,/if\(session\)try\{await api\('salir'\)\}/);
});
test('Ver todas las ventas abre historial existente y no replica otra pantalla de ventas',()=>{
 assert.match(qa,/\$\('ukiGoTodasVentas'\)\.onclick=\(\)=>\{/);
 assert.match(qa,/const details=\$\('ukiOwnerListadoVentas'\);details\.open=true/);
 assert.equal((qa.match(/id="v-ventas"/g)||[]).length,1);
 assert.match(qa,/ventas y cierres/gi);
});
test('La vista de pruebas no reemplaza ni modifica la página original',()=>{
 assert.match(qa,/Vista previa privada · No modifica tu panel actual/);
 assert.doesNotMatch(current,/id="ukiGoTodasVentas"/);
 assert.match(current,/Registrar un gasto/);
 assert.match(current,/Agregar venta o cierre/);
});
test('Sintaxis del módulo de Safari correcta tras retirar lectores',()=>{
 const scripts=[...qa.matchAll(/<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:scripts[0][1],encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
});
