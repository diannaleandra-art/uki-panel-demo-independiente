'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const h=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
test('Editar funciona sin casilla de devolución, sin pedir motivo ni segundo confirmar',()=>{
 assert.doesNotMatch(h,/Ya se devolvió o cobró realmente la diferencia/);
 assert.doesNotMatch(h,/Responsable y motivo de la corrección del pedido/);
 assert.doesNotMatch(h,/¿Confirmar corrección del pedido/);
 assert.match(h,/onclick="ndGuardar\(\)"/);
 assert.match(h,/¿Quién editó este pedido\?/);
});
test('Guarda auditoría de todos los cambios y conserva caja real',()=>{
 const save=h.slice(h.indexOf('async function ndGuardar(){'),h.indexOf('\nfunction cerrar(){'));
 assert.match(save,/const antes=ukiFotoCorreccionPedido\(snapshot\),despues=ukiFotoCorreccionPedido\(p\)/);
 assert.match(save,/responsable:autorizacion,antes,despues/);
 assert.match(save,/ukiPrepararAjusteCobro\(snapshot,p,false\)/);
 assert.match(h,/ukiCobroFisicoPedido\(p\)/);
 assert.match(h,/Historial de ediciones|Correcciones del turno/);
});
