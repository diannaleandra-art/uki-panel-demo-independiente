'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../firebase/uki-archivo-mensual-core.js');
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

test('Antigüedad no libera pedidos pendientes ni entregas sin pago',()=>{
 const s=fixture();const fechaISO='2026-11-01T12:00:00';
 s.pedidos=[
  {suc:s.suc,id:'a',fechaISO,estado:'Pendiente',pagado:false,total:2000},
  {suc:s.suc,id:'b',fechaISO,estado:'Entregado',pagado:false,total:2000},
  {suc:s.suc,id:'c',fechaISO,estado:'Entregado',pagado:true,total:2000},
  {suc:s.suc,id:'d',fechaISO,estado:'Cancelado',pagado:false,total:2000}
 ];
 s.solicitudesWhatsApp=[{suc:s.suc,fechaISO,estado:'pendiente',id:'s'}];
 const a=core.generar(s,'2026-11',new Date('2026-12-06T15:00:00Z'));
 const v=core.simularRetencion(s,a,new Date('2026-12-06T15:00:00Z'));
 assert.equal(v.bloqueos.pedidosAbiertos,2);
 assert.equal(v.bloqueos.solicitudesPendientes,1);
 assert.equal(v.permiteEliminar,false);
 assert.equal(s.pedidos.length,4);
});

test('No confundir 95 días con vencimiento real ni eliminar información de canjes',()=>{
 const s=fixture(),fecha='2026-11-01T12:00:00Z';
 s.clientes.a.movimientos=[
  {tipo:'venta',fecha,vence:'2027-03-01T12:00:00Z',pedidoId:1},
  {tipo:'venta',fecha,vence:'2027-02-01T12:00:00Z',pedidoId:2},
  {tipo:'venta',fecha,pedidoId:3},
  {tipo:'canje6',fecha},{tipo:'canje10',fecha}
 ];
 const archive=core.generar(s,'2026-11',new Date('2026-12-05T15:00:00Z'));
 const antes=JSON.stringify(s);
 const result=core.simularRetencion(s,archive,new Date('2027-02-04T15:00:00Z'));
 assert.deepEqual(result.bloqueos.timbresProtegidos,{vigentes:1,canjes:2,sinVencimiento:1});
 assert.equal(result.permiteEliminar,false);
 assert.equal(JSON.stringify(s),antes);
});

test('Motor de archivo y retención idéntico para Uki y Mi Administración, referente Romo publicado',()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
 const uki=fs.readFileSync(path.join(__dirname,'../firebase/uki-archivo-mensual-core.js'));
 const admin=fs.readFileSync(path.join(__dirname,'../public/uki-archivo-mensual-core.js'));
 assert.deepEqual(uki,admin);
 const blob=crypto.createHash('sha1').update('blob '+uki.length+'\0').update(uki).digest('hex');
 assert.equal(blob,'f0317b4cffe82c7e1e8203ac8e654618531e681e','Revisar y coordinar una modificación del núcleo con Romo antes de cambiar la referencia');
});

test('Estados reales de WhatsApp, finalización tardía, borradores y pedidos vinculados',()=>{
 const s=fixture(),fechaISO='2026-11-01T12:00:00',finalizadoEn=Date.parse('2026-11-01T13:00:00Z');
 const base={suc:s.suc,fechaISO,finalizadoEn};
 s.pedidos=[{suc:s.suc,id:123,fechaISO,estado:'Entregado',pagado:true},
  {suc:s.suc,id:124,fechaISO,estado:'Pendiente',pagado:false}];
 s.solicitudesWhatsApp=[
  {...base,id:'a',estado:'aceptada',pedidoId:123},
  {...base,id:'r',estado:'rechazada'},
  {...base,id:'p',estado:'pendiente'},
  {...base,id:'b',estado:'aceptada',pedidoId:124},
  {...base,id:'c',estado:'aceptada',pedidoId:999},
  {...base,id:'d',estado:'rechazada',finalizadoEn:Date.parse('2026-12-05T13:00:00Z')},
  {...base,id:'e',estado:'rechazada',finalizadoEn:null},
  {...base,id:'f',estado:'rechazada'}
 ];
 s.borradores=[{suc:s.suc,solicitudWhatsAppId:'f'}];
 s.incidencias=[{suc:s.suc,fecha:fechaISO,estado:'Pendiente',problema:'prueba'},
  {suc:s.suc,fecha:fechaISO,estado:'Resuelto',solucion:'confirmada'}];
 const a=core.generar(s,'2026-11',new Date('2026-12-06T15:00:00Z'));
 const antes=JSON.stringify(s),r=core.simularRetencion(s,a,new Date('2026-12-06T15:00:00Z'));
 assert.equal(r.bloqueos.solicitudesPendientes,1);
 assert.equal(r.bloqueos.solicitudesVinculadas,3);
 assert.equal(r.bloqueos.solicitudesFinalizacionNoVerificada,2);
 assert.equal(r.bloqueos.incidenciasPendientes,1);
 assert.equal(r.permiteEliminar,false);
 assert.equal(JSON.stringify(s),antes);
});
