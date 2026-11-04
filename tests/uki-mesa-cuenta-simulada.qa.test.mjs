import test from 'node:test';
import assert from 'node:assert/strict';
import {
 crearEstadoMesaQA,incorporarRondaMesaQA,cuentasSucursalMesaQA
} from '../firebase/uki-mesas-cuenta-simulada.qa.mjs';

const r1={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',branch:'arica',
 mesa:2,nombre:'Dianna',total:2500,
 items:[{mesaLabel:'4 korokes',qty:1,mesaPrecio:2500}]};
const r2={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',branch:'arica',
 mesa:2,nombre:'Dianna',total:9000,
 items:[{mesaLabel:'36 piezas (simuladas)',qty:1,mesaPrecio:9000}]};
const rSerena={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',branch:'serena',
 mesa:2,nombre:'Cliente',total:7000,
 items:[{mesaLabel:'24 piezas',qty:1,mesaPrecio:7000}]};

test('Mesa 2 comienza con cuenta de consumo sin cobro y $2.500',()=>{
 const r=incorporarRondaMesaQA(crearEstadoMesaQA(),r1);
 assert.equal(r.duplicada,false);
 assert.equal(r.cuenta.total,2500);
 assert.equal(r.cuenta.pagado,false);
 assert.equal(r.cuenta.modalidad,'Consumo en local');
 assert.equal(r.cuenta.propina,0);
 assert.equal(r.cuenta.rondas.length,1);
});

test('segunda ronda se suma a la misma cuenta sin tocar otra mesa',()=>{
 const a=incorporarRondaMesaQA(crearEstadoMesaQA(),r1);
 const b=incorporarRondaMesaQA(a.estado,r2);
 assert.equal(b.estado.cuentas.length,1);
 assert.equal(b.cuenta.total,11500);
 assert.equal(b.cuenta.items.length,2);
 assert.equal(b.cuenta.rondas.length,2);
 assert.equal(b.cuenta.pagado,false);
 assert.equal(a.cuenta.total,2500,'no mutar la copia inicial');
});

test('repetir un ID QR no duplica el total ni el producto',()=>{
 const a=incorporarRondaMesaQA(crearEstadoMesaQA(),r1);
 const b=incorporarRondaMesaQA(a.estado,r1);
 assert.equal(b.duplicada,true);
 assert.equal(b.estado.cuentas[0].total,2500);
 assert.equal(b.estado.cuentas[0].rondas.length,1);
});

test('la misma mesa en Serena no se mezcla con Arica',()=>{
 const a=incorporarRondaMesaQA(crearEstadoMesaQA(),r1);
 const b=incorporarRondaMesaQA(a.estado,rSerena);
 assert.equal(b.estado.cuentas.length,2);
 assert.equal(cuentasSucursalMesaQA(b.estado,'arica')[0].total,2500);
 assert.equal(cuentasSucursalMesaQA(b.estado,'serena')[0].total,7000);
 assert.equal(b.estado.cuentas.some(c=>c.pagado),false);
});

test('un monto distinto del detalle no entra en la cuenta',()=>{
 assert.throws(()=>incorporarRondaMesaQA(crearEstadoMesaQA(),{...r1,total:1}),/total QR/i);
 assert.throws(()=>incorporarRondaMesaQA(crearEstadoMesaQA(),{...r1,items:[{mesaLabel:'producto',qty:1,mesaPrecio:-100}]}),/precio/i);
});

test('solicitudes sin sucursal o mesa válida se rechazan',()=>{
 for(const bad of [{...r1,branch:'otra'},{...r1,mesa:-2},{...r1,mesa:2.3},{...r1,id:'!'}]){
  assert.throws(()=>incorporarRondaMesaQA(crearEstadoMesaQA(),bad));
 }
});

test('no hay ventas persistidas; cada recarga comienza vacía',()=>{
 const one=incorporarRondaMesaQA(crearEstadoMesaQA(),r1);
 const refreshed=crearEstadoMesaQA();
 assert.equal(refreshed.cuentas.length,0);
 assert.equal(one.estado.cuentas[0].estado,'Pendiente de pago · simulación');
});
