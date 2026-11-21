'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../public/romo-panel-qa/uki-archivo-mensual-core.js');
function fixture(suc='Romo’s Sushi La Serena'){
 const s={suc,clientes:{a:{nombre:'Prueba',telefono:'56900000000',codigoCliente:'T',movimientos:[{tipo:'venta',fechaISO:'2026-11-01T12:00:00',monto:2000}]}}};
 for(const k of core.SECCIONES)s[k]=[];
 s.cajasDiarias={};
 s.pedidos=[{suc,id:'p1',fechaISO:'2026-11-01T12:00:00',pagado:true,total:2500,telefono:'56900000000'},{suc,id:'p2',fechaISO:'2026-11-30T12:00:00',pagado:true,total:5000}];
 return s;
}
test('35 y 95 días exactos, fecha Chile, respaldo previo y estado intacto',()=>{
 for(const suc of Object.keys(core.SUCURSALES)){
  const s=fixture(suc),a=core.generar(s,'2026-11',new Date('2026-12-05T15:00:00Z')),before=JSON.stringify(s),archiveBefore=JSON.stringify(a);
  const first=core.simularRetencion(s,a,new Date('2026-12-05T15:00:00Z'));
  assert.equal(first.secciones.pedidos.porAntiguedadYCoincidencia,0);
  const next=core.simularRetencion(s,a,new Date('2026-12-06T15:00:00Z'));
  assert.equal(next.secciones.pedidos.porAntiguedadYCoincidencia,1);
  assert.equal(next.timbres.porAntiguedadYCoincidencia,0);
  const later=core.simularRetencion(s,a,new Date('2027-02-04T15:00:00Z'));
  assert.equal(later.timbres.porAntiguedadYCoincidencia,1);
  assert.equal(later.permiteEliminar,false);
  assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(a),archiveBefore);
 }
});
test('Una modificación posterior no cuenta como copia exacta, ni se acepta respaldo ajeno',()=>{
 const s=fixture(),a=core.generar(s,'2026-11',new Date('2026-12-06T15:00:00Z'));
 s.pedidos[0].total=3000;
 const result=core.simularRetencion(s,a,new Date('2026-12-06T15:00:00Z'));
 assert.equal(result.secciones.pedidos.noCoinciden,1);
 assert.equal(result.secciones.pedidos.porAntiguedadYCoincidencia,0);
 assert.throws(()=>core.simularRetencion(s,{...a,sucursal:'uki:arica'}));
 assert.throws(()=>core.simularRetencion(s,{...a,sinFecha:{...a.sinFecha,timbres:1}}));
});
