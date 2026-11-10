'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const a=html.indexOf('function ukiFotoCorreccionPedido(p){');
const b=html.indexOf('\nfunction ukiVCorreccionesPedido(p){',a);
assert.ok(a>0&&b>a,'Se necesita la función de auditoría vigente');
function fixture(){
 const c={fmt:n=>'$'+Number(n).toLocaleString('es-CL'),esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),Date,JSON};
 vm.createContext(c);vm.runInContext(html.slice(a,b),c);return c;
}
test('Cada pedido muestra su historial aun sin ediciones, sin cambiar datos',()=>{
 const {ukiCorreccionesTurnoUI}=fixture();
 const p={id:19,total:11800,cliente:'Cliente',productos:[{nombre:'Sushi',cantidad:1,precioUnit:11800}]};
 const original=JSON.stringify(p);
 const out=ukiCorreccionesTurnoUI(p);
 assert.match(out,/Historial de ediciones · 0 modificaciones/);
 assert.match(out,/No hay modificaciones registradas para este pedido/);
 assert.match(out,/open>/);
 assert.equal(JSON.stringify(p),original);
});
test('Responsable, fecha, hora y diferencias de forma de pago sin cambiar el total',()=>{
 const {ukiCorreccionesTurnoUI}=fixture();
 const a={cliente:'Cliente',medio:'Efectivo',medioEnvio:'Efectivo',total:11800,pagado:true};
 const b={...a,medio:'Transferencia'};
 const out=ukiCorreccionesTurnoUI({correccionesTurno:[
  {fechaISO:'2026-11-10T19:20:00.000Z',responsable:'Agendador',antes:a,despues:b}
 ]});
 assert.match(out,/Historial de ediciones · 1 modificación/);
 assert.match(out,/Modificación 1 · Agendador/);
 assert.match(out,/Fecha y hora:/);
 assert.match(out,/Medio de pago/);
 assert.match(out,/Antes: Efectivo/);
 assert.match(out,/Después: Transferencia/);
 assert.doesNotMatch(out,/>Total<\/b>/,'No mostrar el total si nunca cambió');
});
test('Cambios de productos, cantidad, precio, nombre y observaciones se ven antes y después',()=>{
 const {ukiCorreccionesTurnoUI}=fixture();
 const anterior={cliente:'Ana',productos:[{nombre:'36 piezas',cantidad:1,precioUnit:11800,detalle:'Con nori'}],
  textoOriginal:'Con nori',total:11800,subtotal:11800,envio:0};
 const nuevo={cliente:'Ana María',productos:[{nombre:'36 piezas',cantidad:1,precioUnit:12500,detalle:'Sin nori'}],
  textoOriginal:'Sin nori, por favor',total:12500,subtotal:12500,envio:0};
 const out=ukiCorreccionesTurnoUI({correccionesTurno:[
  {responsable:'Andrea',fechaISO:'2026-11-10T19:21:00Z',antes:anterior,despues:nuevo}
 ]});
 for(const term of ['Nombre del cliente','Ana María','Productos y armado',
  'Con nori','Sin nori','Texto u observaciones del pedido','Después: $12.500'])
   assert.ok(out.includes(term),term);
 assert.doesNotMatch(out,/Antes: <img/);
});
test('Cada nueva modificación aparece en orden reciente primero, conservando los anteriores',()=>{
 const {ukiCorreccionesTurnoUI}=fixture();
 const orig={medio:'Efectivo',total:7000};
 const cambiada={medio:'Débito',total:7000};
 const nueva={medio:'Débito',total:7500};
 const p={correccionesTurno:[
  {responsable:'Primero',fechaISO:'2026-11-10T19:10:00Z',antes:orig,despues:cambiada},
  {responsable:'Segundo',fechaISO:'2026-11-10T19:15:00Z',antes:cambiada,despues:nueva}
 ]};
 const antes=JSON.stringify(p);
 const out=ukiCorreccionesTurnoUI(p);
 assert.match(out,/2 modificaciones/);
 assert.ok(out.indexOf('Segundo')<out.indexOf('Primero'));
 assert.match(out,/Modificación 2/);
 assert.match(out,/Modificación 1/);
 assert.equal(JSON.stringify(p),antes);
});
test('La foto auditada contiene todos los datos necesarios y no altera cifras',()=>{
 const {ukiFotoCorreccionPedido}=fixture();
 const pedido={cliente:'Ana',sucursalCarta:'arica',qrSolicitudes:['mesa-3'],propinaPersonalizada:500,
  total:12300,medio:'Efectivo',correccionesTurno:[{responsable:'Ana'}]};
 const before=JSON.stringify(pedido);
 const foto=ukiFotoCorreccionPedido(pedido);
 assert.equal(foto.sucursalCarta,'arica');
 assert.equal(foto.qrSolicitudes[0],'mesa-3');
 assert.equal(foto.propinaPersonalizada,500);
 assert.equal(foto.total,12300);
 assert.equal(JSON.stringify(pedido),before);
});
test('El historial vive dentro del mismo pedido, sin modificar guardar o timbres',()=>{
 assert.match(html,/\$\{ukiCorreccionesTurnoUI\(p\)\}/);
 assert.match(html,/if\(JSON\.stringify\(antes\)!==JSON\.stringify\(despues\)\)/);
 assert.match(html,/responsable:autorizacion,antes,despues/);
 assert.match(html,/Historial de ediciones/);
 assert.match(html,/✅ Ya enviado · no volver a compartir por cambio de pago/);
 for(const word of ['function cerrar(){','function ukiCorreccionesTurnoUI(p){','function ukiVCorreccionesPedido(p){'])
  assert.ok(html.includes(word),word);
});
