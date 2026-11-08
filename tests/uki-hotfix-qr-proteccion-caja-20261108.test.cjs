'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
test('Pedidos cancelados y canjes nunca ingresan en el resumen de caja',()=>{
 assert.match(html,/if\(p\.estado==="Cancelado"\|\|p\.esPremio\|\|\(!p\.pagado&&!ukiCobroPendiente\(p\)\)\)continue/);
});
test('El dominio oficial conserva permiso exclusivo, Vercel no puede escribir caja',()=>{
 assert.match(html,/const UKI_OPERACION_HABILITADA=location\.hostname==='diannaleandra-art\.github\.io'/);
});
test('No se reemplazan funciones para timbres, QR ni cierre',()=>{
 for(const f of ['function cerrar(){','function ukiQRPermitirCobroDefinitivo(d){',
 'function ukiCierreConfirmadoPedido(p){','function ukiSincronizarPropinaPedido(p){'])
 assert.ok(html.includes(f),f);
 assert.match(html,/correccionesPendientesAlCerrar/);
});
