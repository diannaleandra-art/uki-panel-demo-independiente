import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {consultarHistorialRomoQA} from '../firebase/uki-romo-caja-consulta-qa.mjs';
const SUC='Romo’s Sushi La Serena',a='2026-11-13',b='2026-11-14';
const row=(id,fecha,extra={})=>({
 suc:SUC,id,numeroTurno:id,fechaOperativa:fecha,fechaISO:fecha+'T19:00:00',
 registradoEn:1794500000000+id*1000,
 codigoCarta:'ROMO-'+id,cliente:'Cliente '+id,
 codigoCliente:String(1000+id),telefono:'+5691111'+String(1000+id),
 estado:'Pendiente',pagado:false,total:9000,modalidad:'Delivery',envio:2000,
 productos:[{nombre:'24 piezas',cantidad:1,precioUnit:7000,detalle:'Pollo/Palta/Panko - Salsa soya'}],
 ...extra
});
const base=()=>({suc:SUC,pedidos:[
 row(1,a,{estado:'Cancelado',cliente:'Cancelación antigua',
  historialCambios:[{tipo:'cancelacion_sin_pago',responsable:'QA',
   fecha:a+'T20:00:00',motivo:'Cliente desistió'}]}),
 row(2,b,{pagado:true,cliente:'Cliente pagado',telefono:'+56911112222',
  historialCambios:[{tipo:'cobro_pendiente',responsable:'Cajera QA',
   fecha:b+'T21:00:00',anterior:{pagado:false},
   nuevo:{pagado:true,total:9000}}]}),
 row(3,b,{cliente:'Pedido pendiente',codigoCarta:'QA-ROMO-001',
  telefono:'',total:9000})
 ],cierres:[],gastos:[],retiros:[],propinas:[],deliveriesManuales:[]});
test('historial Romo incluye pagados, pendientes y cancelados de días anteriores',()=>{
 const s=base(),before=structuredClone(s);
 const x=consultarHistorialRomoQA(s);
 assert.equal(x.soloLectura,true);
 assert.deepEqual([x.encontrados,x.pagados,x.pendientes,x.cancelados],[3,1,1,1]);
 assert.deepEqual(x.filas.map(f=>f.id),[3,2,1]);
 assert.equal(x.filas.find(f=>f.id===1).eventos[0].motivo,'Cliente desistió');
 assert.equal(x.filas.find(f=>f.id===2).eventos[0].totalNuevo,9000);
 assert.deepEqual(s,before);
});
test('rango de fechas muestra el día correcto, sin traer antiguos',()=>{
 const x=consultarHistorialRomoQA(base(),{desde:b,hasta:b});
 assert.deepEqual([x.encontrados,x.pagados,x.pendientes,x.cancelados],[2,1,1,0]);
 assert(x.filas.every(f=>f.fecha===b));
});
test('búsqueda por código, cliente, WhatsApp y turno funciona',()=>{
 const s=base();
 assert.equal(consultarHistorialRomoQA(s,{busqueda:'QA-ROMO-001'}).filas[0].id,3);
 assert.equal(consultarHistorialRomoQA(s,{busqueda:'cancelacion antigua'}).filas[0].id,1);
 assert.equal(consultarHistorialRomoQA(s,{busqueda:'2222'}).filas[0].id,2);
 assert.equal(consultarHistorialRomoQA(s,{busqueda:'ROMO-2'}).filas[0].id,2);
 assert.equal(consultarHistorialRomoQA(s,{busqueda:'no-existe'}).encontrados,0);
});
test('lista acotada informa truncamiento y evita consultas gigantes',()=>{
 const r=consultarHistorialRomoQA(base(),{maxResultados:1});
 assert.deepEqual([r.encontrados,r.mostrados,r.hayMas],[3,1,true]);
 assert.throws(()=>consultarHistorialRomoQA(base(),{maxResultados:999}));
 assert.throws(()=>consultarHistorialRomoQA(base(),{busqueda:'z'.repeat(121)}));
});
test('una sucursal Uki o una fila cruzada bloquea toda la lectura',()=>{
 const s=base();s.pedidos.push(row(10,b,{suc:'Uki La Serena'}));
 assert.throws(()=>consultarHistorialRomoQA(s),/otra sucursal/);
 assert.throws(()=>consultarHistorialRomoQA({...base(),suc:'Uki La Serena'}));
 assert.throws(()=>consultarHistorialRomoQA({...base(),cierres:[{suc:'Uki La Serena'}]}));
});
test('no acepta rango inverso, fecha inválida ni importes incoherentes',()=>{
 assert.throws(()=>consultarHistorialRomoQA(base(),{desde:b,hasta:a}),/rango/);
 assert.throws(()=>consultarHistorialRomoQA(base(),{desde:'fecha'}),/rango/);
 const s=base();s.pedidos[0].total=-1;
 assert.throws(()=>consultarHistorialRomoQA(s),/Importe/);
});
test('la consulta no exige inventar pagos ni borrar cancelados del día anterior',()=>{
 const s=base();
 const v=consultarHistorialRomoQA(s,{hasta:a});
 assert.equal(v.encontrados,1);
 assert.equal(v.cancelados,1);
 assert.equal(v.pagados,0);
 assert.equal(v.filas[0].pagado,false);
});
test('Historial está en Caja Romo y conserva las páginas Uki sin cambios',()=>{
 const source=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const pub=readFileSync(new URL('../public/romo-qa/uki-sushi-local.html',import.meta.url),'utf8');
 assert.equal(pub,source);
 assert.match(source,/function vRomoHistorialQA\(fuente\)/);
 assert.match(source,/if\(historialActivo\)return tabs\+vRomoHistorialQA\(fuente\)/);
 assert.match(source,/cambiarCajaTab\(\\'historial\\'\)/);
 assert.match(source,/Historial de pedidos · Romo La Serena/);
 assert.match(source,/Romo · Neon: lectura confirmada/);
 assert.match(source,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(source,/function vCaja\(\)/);
 const code=readFileSync(new URL('../firebase/uki-romo-caja-consulta-qa.mjs',import.meta.url));
 const copy=readFileSync(new URL('../public/romo-qa/uki-romo-caja-consulta-qa.mjs',import.meta.url));
 assert.deepEqual(copy,code);
});
