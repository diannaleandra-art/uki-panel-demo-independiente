'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalize,planConciliacion}=require('../lib/uki-ventas-duenos-conciliacion.cjs');
const base={
 suc:'Uki Regimiento Arica',fechaOperativa:'2026-11-08',
 fechaMs:1794180000000,venta:27000,pedidos:2,gastos:4500,efectivo:6000,
 enviosManuales:3500,medios:{Efectivo:6000,Transferencia:16000,'Débito':5000}
};
test('Cierre de Uki se representa solo para lectura y respeta fecha operativa y sucursal',()=>{
 const res=normalize(base);
 assert.equal(res.branch,'arica');assert.equal(res.day,'2026-11-08');
 assert.equal(res.sale,27000);assert.equal(res.payments.transferencia,16000);
 assert.equal(res.deliveryManualPayable,3500);
 assert.equal(res.payments.efectivo,6000,'Delivery manual no aumenta efectivo');
 assert.equal(Object.values(res.payments).reduce((a,b)=>a+b,0),27000);
 assert.ok(Object.isFrozen(res));
 assert.equal(normalize({...base,suc:'Uki La Serena'}).branch,'serena');
 assert.notEqual(normalize({...base,suc:'Uki La Serena'}).sourceId,res.sourceId);
 assert.notEqual(normalize({...base,fechaMs:base.fechaMs+5000}).sourceId,res.sourceId);
});
test('El mismo cierre reintentado no genera otra venta',()=>{
 const c=normalize(base);
 const already=[{source:'uki-cierre',sourceId:c.sourceId,day:c.day,branch:c.branch,sale:c.sale}];
 assert.equal(planConciliacion(c,already).status,'ya_importado');
});
test('Venta manual coincidente se marca para conciliación, no se suma dos veces',()=>{
 const c=normalize(base);
 assert.equal(planConciliacion(c,[{source:'manual',day:c.day,branch:c.branch,sale:c.sale}]).status,'revisar_posible_duplicado');
 assert.equal(planConciliacion(c,[]).status,'nuevo_pendiente_de_verificacion');
 assert.equal(planConciliacion(c,[{source:'manual',day:c.day,branch:'serena',sale:c.sale}]).status,'nuevo_pendiente_de_verificacion');
});
test('Se rechaza un cierre incompleto o con sumas incorrectas sin cambiarlo',()=>{
 assert.throws(()=>normalize({...base,venta:28000}),/no cuadra/);
 assert.throws(()=>normalize({...base,medios:{Efectivo:27000,Bitcoin:0}}),/Medio o valor/);
 assert.throws(()=>normalize({...base,fechaOperativa:'2026-11-32'}),/Día operativo/);
 assert.throws(()=>normalize({...base,fechaMs:null,fechaISO:null}),/hora de confirmación/);
 assert.throws(()=>normalize({...base,medios:{Efectivo:-1}}),/Medio o valor/);
});
