'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const first=h.indexOf('function ukiDiferenciaDeliveryOriginalUI(p){');
const end=h.indexOf('\nfunction ukiVCorreccionesPedido(p){',first);
if(first<0||end<0)throw Error('Vista de historial no encontrada');
const ctx={fmt:n=>'$'+Number(n).toLocaleString('es-CL'),
 esc:x=>String(x??''),Date,JSON};
vm.createContext(ctx);vm.runInContext(h.slice(first,end),ctx);
test('Pedido real de 36 piezas: WhatsApp delivery $1.500 versus $2.000 muestra diferencia $500',()=>{
 const p={modalidad:'Delivery',envio:2000,total:13800,textoOriginal:
 'UKI SUSHI · ABC123\nTotal productos: $11.800\nDelivery: $1.500\nTotal con delivery: $13.300',
 correccionesTurno:[]};
 const original=JSON.stringify(p);
 const out=ctx.ukiCorreccionesTurnoUI(p);
 assert.match(out,/0 modificaciones/);
 assert.match(out,/Diferencia respecto al WhatsApp original/);
 assert.match(out,/Delivery en el mensaje recibido: \$1\.500/);
 assert.match(out,/Delivery registrado ahora: <b>\$2\.000/);
 assert.match(out,/\+\$500/);
 assert.match(out,/no demuestra cuándo ni quién cambió el valor/);
 assert.equal(JSON.stringify(p),original,'No crear una auditoría falsa en el pedido');
});
test('No inventar cambio si WhatsApp original dice el mismo delivery, si es Retiro o sin dato',()=>{
 const base={modalidad:'Delivery',envio:2000,total:13800,textoOriginal:'Delivery: $2.000',correccionesTurno:[]};
 assert.doesNotMatch(ctx.ukiCorreccionesTurnoUI(base),/Diferencia respecto al WhatsApp original/);
 assert.doesNotMatch(ctx.ukiCorreccionesTurnoUI({...base,modalidad:'Retiro',textoOriginal:'Delivery: $1.500'}),/Diferencia respecto al WhatsApp original/);
 assert.doesNotMatch(ctx.ukiCorreccionesTurnoUI({...base,textoOriginal:'Tarjeta $1.500\nTotal: $13.300'}),/Diferencia respecto al WhatsApp original/);
});
test('Ediciones reales conservan su auditoría, no se sustituyen por comparación con WhatsApp',()=>{
 const a={envio:1500,total:13300},b={envio:2000,total:13800};
 const p={modalidad:'Delivery',envio:2000,textoOriginal:'Delivery: $1.500',
 correccionesTurno:[{responsable:'Encargado',fechaISO:'2026-11-10T20:00:00.000Z',antes:a,despues:b}]};
 const out=ctx.ukiCorreccionesTurnoUI(p);
 assert.match(out,/1 modificación/);
 assert.match(out,/Encargado/);
 assert.match(out,/Costo del delivery/);
 assert.match(out,/Antes: \$1\.500/);
 assert.match(out,/Después: \$2\.000/);
 assert.doesNotMatch(out,/Diferencia respecto al WhatsApp original/);
});
test('No cambia lógica de caja, precios, timbres ni respaldo',()=>{
 assert.match(h,/p\.correccionesTurno\.push\(\{fechaISO:new Date\(\)\.toISOString\(\)/);
 assert.match(h,/function cerrar\(\)/);
 assert.match(h,/const datosPago=ukiDatosPago\(D,sub\)/);
 assert.match(h,/✅ Ya enviado · no volver a compartir por cambio de pago/);
 assert.match(h,/void ukiConciliarCierresDuenos\(\)/);
});
