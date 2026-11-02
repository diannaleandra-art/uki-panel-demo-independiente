'use strict';
// Ejecutar sin datos de clientes ni Firebase:
// node --test tests/cuentas-local-uki.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','firebase','uki-sushi-local.html'),'utf8');
const segment=(a,b)=>{
 const i=html.indexOf(a),j=html.indexOf(b,i);
 assert.ok(i>=0&&j>i,'Sección no encontrada: '+a);
 return html.slice(i,j);
};
const fmt=n=>'$'+Number(n||0).toLocaleString('es-CL');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const methods=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const apps=['Uber Eats','PedidosYa','Rappi'];
function helpers(){
 const S={suc:'Uki Regimiento Arica',pedidos:[]};
 const parts=segment('function ukiCuentaLocal(p){','function copiarComanda(id){');
 const f=new Function('S','fmt','esc','row','navigator','window','aviso','esDelPeriodo','editarPedido','ukiMontoProductosOtroLocal','modoNuevo',
 parts+'\nreturn {ukiCuentaLocal,ukiCuentaAbierta,ukiDetalleCuentaTexto,ukiDetalleCuentaVista};');
 const all=f(S,fmt,esc,(name,value)=>'<div>'+esc(name)+': '+esc(value)+'</div>',{}, {},()=>{},()=>true,()=>{},
 (p,sub)=>p.productosPagadosOtroLocal?(p.montoProductosOtroLocal??sub):0,'manual');
 return {S,...all};
}
function sample(){
 return {id:4,suc:'Uki Regimiento Arica',codigoCarta:'C004',cliente:'Paula',mesaReferencia:'Mesa 3',
 modalidad:'Consumo en local',pagado:false,estado:'Pendiente',subtotal:3800,total:3800,
 medio:'Efectivo',medioEnvio:'Efectivo',envio:0,productos:[{nombre:'Handroll',cantidad:1,precioUnit:3800,detalle:'Kanicama'}]};
}
test('Cuenta de consumo en local conserva detalle, referencia y saldo por pagar',()=>{
 const x=helpers();const p=sample();
 assert.equal(x.ukiCuentaAbierta(p),true);
 const text=x.ukiDetalleCuentaTexto(p);
 assert.match(text,/Mesa 3/);
 assert.match(text,/1 x Handroll/);
 assert.match(text,/TOTAL: \$3\.800/);
 assert.match(text,/SALDO POR PAGAR EN UKI: \$3\.800/);
 assert.match(text,/no es boleta ni factura tributaria/);
 assert.match(x.ukiDetalleCuentaVista(p),/Compartir detalle/);
});
test('Cuentas pagadas o canceladas dejan de ser cuentas abiertas',()=>{
 const x=helpers(),p=sample();
 assert.equal(x.ukiCuentaAbierta({...p,pagado:true}),false);
 assert.equal(x.ukiCuentaAbierta({...p,estado:'Cancelado'}),false);
 assert.equal(x.ukiCuentaAbierta({...p,modalidad:'Delivery'}),false);
 assert.equal(x.ukiCuentaAbierta({...p,modalidad:'Retiro'}),true);
});
test('Detalle de cuenta suma adiciones sin abrir otro pedido',()=>{
 const x=helpers(),p=sample();
 p.productos.push({nombre:'Gohan',cantidad:2,precioUnit:6000,detalle:'Sin cebollín'});
 p.subtotal=15800;p.total=15800;
 const text=x.ukiDetalleCuentaTexto(p);
 assert.match(text,/2 x Gohan/);
 assert.match(text,/TOTAL: \$15\.800/);
 assert.match(text,/SALDO POR PAGAR EN UKI: \$15\.800/);
});
test('Valor pagado en otro local se descuenta del saldo informativo',()=>{
 const x=helpers(),p={...sample(),modalidad:'Retiro',subtotal:20000,total:20000,
  productos:[{nombre:'Roll',cantidad:2,precioUnit:10000,detalle:''}],
  productosPagadosOtroLocal:true,montoProductosOtroLocal:15000,localPagoExterno:'Uki La Serena'};
 const text=x.ukiDetalleCuentaTexto(p);
 assert.match(text,/Pagado en Uki La Serena: \$15\.000/);
 assert.match(text,/SALDO POR PAGAR EN UKI: \$5\.000/);
});
test('Nuevo formulario y edición guardan mesa sin tocar otros datos del pedido',()=>{
 assert.match(html,/mesaReferencia:D\.modalidad==="Consumo en local"/);
 assert.match(html,/p\.mesaReferencia=D\.modalidad==="Consumo en local"/);
 assert.match(html,/mesaReferencia:p\.mesaReferencia\|\|""/);
 assert.match(html,/value="\$\{esc\(D\.mesaReferencia\|\|""\)\}"/);
});
test('La vista Pedidos presenta cuentas abiertas y añadir consumo solo si no pagada',()=>{
 assert.match(html,/\["cuentas","Cuentas abiertas"\]/);
 assert.match(html,/if\(categoria==="cuentas"\)return ukiCuentaAbierta\(p\)/);
 assert.match(html,/ukiCuentaAbierta\(p\)&&esDelPeriodo\(p\)\?/);
 assert.match(html,/function ukiAgregarACuenta\(id\)/);
 assert.match(html,/\+ Agregar a cuenta/);
});
test('El flujo de cuenta pendiente no genera nuevos timbres ni venta antes de pago',()=>{
 assert.match(html,/if\(D\.cliente && D\.pagado && !D\.productosPagadosOtroLocal\)/);
 assert.match(html,/const pag=pedidos\.filter\(p=>p\.pagado&&p\.estado!=="Cancelado"/);
 assert.match(html,/ukiCuentaAbierta\(p\)\?" · Cuenta abierta, pendiente de pago":""/);
});
