'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const panel=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const start=panel.indexOf('/* Uki Inventario y Carta');
const end=panel.indexOf('const VISTAS=',start);
const code=panel.slice(start,end);
function html(role){
 const env={
  S:{suc:'Uki Regimiento Arica'},
  SUCURSALES:['Uki Regimiento Arica','Uki La Serena'],
  cajaDelDia:()=>({turnoPrecierreAbierto:{nombre:'Sara',inicioMs:Date.now()}}),
  esc:x=>String(x),fmt:n=>'$'+n,
  confirm:()=>true,
  window:{},console,
  AbortSignal:{timeout:()=>undefined}
 };
 vm.runInNewContext(code+
  `ukiInv.role='${role}'; ukiInv.adminMode=${role==='admin'};\n`,env);
 return {env,form:vm.runInNewContext(
  `ukiInvForm({sku:'dish:korokes-4',kind:'dish',name:'Korokes',price:2500,
     stock_qty:0,stock_unit:'porciones',description:'Croquetas'})`,env)};
}
test('Inventario y carta sigue compilando en el panel existente',()=>{
 assert.ok(start>0&&end>start);
 assert.doesNotThrow(()=>new vm.Script(code));
});
test('trabajador puede contar y sumar entrada pero NO ve edición de precio ni producto',()=>{
 const {form}=html('trabajador');
 assert.match(form,/Guardar conteo/);
 assert.match(form,/Registrar entrada de mercadería/);
 assert.doesNotMatch(form,/ukiInvPrecio|ukiInvNombre"|ukiInvDesc/);
 const {env}=html('trabajador');
 vm.runInNewContext(`ukiInv.branch='arica';ukiInv.items=[{sku:'dish:korokes-4',
  kind:'dish',name:'Korokes',price:2500,stock_qty:0,stock_unit:'un',group_key:'entradas',
  available:true,version:0}];`,env);
 const f=vm.runInNewContext('vInventario()',env);
 assert.match(f,/Trabajador · conteos y agotados/);
 assert.doesNotMatch(f,/ukiInvNuevoPrecio|ukiInvCrear\(\)/);
 assert.match(f,/Marcar agotado/);
});
test('administrador puede editar precio y productos y ver historial',()=>{
 const {form,env}=html('admin');
 assert.match(form,/id="ukiInvPrecio"/);
 assert.match(form,/id="ukiInvNombre"/);
 const view=vm.runInNewContext('vInventario()',env);
 assert.match(view,/Administración · precios y productos/);
 assert.match(view,/ukiInvVerHistorial\(\)/);
});
test('el acceso normal del personal usa token de dispositivo y Google es explícito',()=>{
 const i=code.slice(code.indexOf('async function ukiInvRequest('),
  code.indexOf('async function ukiInvCargar('));
 assert.match(i,/ukiInv.adminMode\?await window.ukiMesasTokenConfirmar/);
 assert.match(i,/await window.ukiMesasTokenEquipo/);
 assert.match(i,/Authorization:'Bearer '\+token/);
 assert.doesNotMatch(i,/pinSuc|claveLocal|password/);
});
test('el registro exige nombre y el cambio de disponibilidad sigue siendo manual',()=>{
 assert.match(code,/function ukiInvNombreActual\(\)/);
 assert.match(code,/turnoPrecierreAbierto\?\.nombre/);
 assert.match(code,/worker_name=ukiInvNombreActual\(\)/);
 assert.match(code,/operation:'disponibilidad'/);
 assert.match(code,/operation:'entrada',quantity:cantidad/);
 assert.doesNotMatch(code,/stock_qty\s*===?\s*0\s*\?\s*false/);
});
