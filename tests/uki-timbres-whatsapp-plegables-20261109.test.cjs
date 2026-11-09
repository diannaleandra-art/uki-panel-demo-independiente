'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const section=(a,b)=>{
 const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'No se encuentra bloque '+a);
 return html.slice(i,j);
};
const now=Date.now();
const fecha=(days)=>new Date(now+days*86400000).toISOString();
const compra=(id,days=-2)=>({tipo:'venta',pedidoId:id,fecha:fecha(days),vence:fecha(80)});
function preparar(){
 const principal={nombre:'Dianna',telefono:'+56 9 9122 7362',codigoCliente:'7362',
   pedidos:3,gastado:8500,ultimo:'09-11-2026',movimientos:[compra(1,-4),compra(2,-3),compra(3,-2)]};
 const alias={nombre:'D',telefono:'56991227362',codigoCliente:'7362',pedidos:1,
   gastado:3500,ultimo:'09-11-2026',movimientos:[compra(4,-1)]};
 const S={suc:'Uki Regimiento Arica',clientes:{'codigo:7362|56991227362':principal,
   'codigo:7362|56991227362|nombre:d':alias},pedidos:[1,2,3,4].map((id)=>({
    id,suc:'Uki Regimiento Arica',cliente:id===4?'D':'Dianna',
    telefono:id===4?'56991227362':'+56 9 9122 7362',estado:'Entregado',
    pagado:true,subtotal:id===4?3500:2500,esPremio:false,fechaISO:fecha(-id)
   }))};
 const ctx={S};
 vm.createContext(ctx);
 vm.runInContext(section('function ukiTelefonoNormalizado(','function fechaVencimiento('),ctx);
 vm.runInContext(section('function ventasValidas(cli){','/* Historial por cliente;'),ctx);
 vm.runInContext(section('function pedidosHist(nombre,codigo="",telefono=""){','function fichaHistorial(cli){'),ctx);
 return {ctx,S,principal,alias};
}
test('Dianna y D, mismo WhatsApp completo: UNA ficha y 4 timbres sin borrar fuente',()=>{
 const {ctx,S,principal,alias}=preparar();
 const antes=JSON.stringify(S);
 assert.equal(ctx.ukiTarjetasAgrupadas().length,1);
 const vista=ctx.ukiTarjetasAgrupadas()[0];
 assert.equal(vista.nombre,'Dianna');
 assert.equal(ctx.ventasValidas(vista),4);
 assert.equal(vista.movimientos.length,4);
 assert.equal(vista.pedidos,4);
 assert.equal(ctx.ukiCodigoClienteVisible(vista),'7362');
 assert.equal(ctx.getCliente('D','7362','56991227362'),principal);
 assert.equal(ctx.asegurarCliente('D','7362','56991227362'),principal);
 assert.equal(Object.keys(S.clientes).length,2);
 assert.equal(alias.movimientos.length,1);
 assert.equal(JSON.stringify(S),antes);
 assert.equal(ctx.pedidosHist('D','7362','56991227362').length,4);
});
test('Dos números diferentes con los mismos 4 dígitos no se mezclan',()=>{
 const {ctx,S}=preparar();
 S.clientes['otra']={nombre:'Camila',telefono:'56912347362',codigoCliente:'7362',
  movimientos:[compra(5)],pedidos:1};
 assert.equal(ctx.ukiTarjetasAgrupadas().length,2);
 assert.equal(ctx.ventasValidas(ctx.getCliente('Camila','7362','56912347362')),1);
 assert.equal(ctx.ventasValidas(ctx.getCliente('D','7362','56991227362')),4);
});
test('Sin WhatsApp se exige el mismo nombre y código: nombres distintos no se confunden',()=>{
 const {ctx,S}=preparar();
 S.clientes.a={nombre:'Ana',telefono:'',codigoCliente:'1111',movimientos:[compra(6)]};
 S.clientes.b={nombre:'Berta',telefono:'',codigoCliente:'1111',movimientos:[compra(7)]};
 assert.equal(ctx.ukiTarjetasAgrupadas().length,3);
 assert.notEqual(ctx.getCliente('Ana','1111',''),ctx.getCliente('Berta','1111',''));
});
test('Un pedido repetido en dos perfiles da un único timbre',()=>{
 const {ctx,S}=preparar();
 S.clientes['codigo:7362|56991227362|nombre:d'].movimientos.push(compra(2,-1));
 assert.equal(ctx.ventasValidas(ctx.ukiTarjetasAgrupadas()[0]),4);
 assert.equal(ctx.ukiTarjetasAgrupadas()[0].movimientos.filter(x=>x.tipo==='venta').length,4);
});
test('Canje 10 en un alias reinicia los timbres vinculados sin perder registros',()=>{
 const {ctx,S,alias}=preparar();
 alias.movimientos.push({tipo:'canje10',fecha:fecha(-0.5),vence:null});
 assert.equal(ctx.ventasValidas(ctx.ukiTarjetasAgrupadas()[0]),0);
 S.clientes['codigo:7362|56991227362'].movimientos.push(compra(8,0));
 assert.equal(ctx.ventasValidas(ctx.ukiTarjetasAgrupadas()[0]),1);
});
test('Tarjetas de Pedidos y Timbres cerradas; click sobre summary las abre',()=>{
 const pedidos=section('function vPedidos(){','let pedidoExpandido=null;');
 assert.match(pedidos,/<details class="card order-card/);
 assert.match(pedidos,/<summary><div class="order-head">/);
 assert.doesNotMatch(pedidos,/p\.id===pedidoExpandido\?'open'/);
 const timbres=section('function vClientes(){','function compartirImagenTimbres(');
 assert.match(timbres,/<details class="card"><summary style="cursor:pointer"><b>🎫 Timbres del/);
 assert.doesNotMatch(timbres,/<details class="card" open>/);
 assert.doesNotMatch(timbres,/uki-timbre-tarjeta/);
 assert.match(timbres,/return `<div class="card" style=/);
 assert.match(timbres,/const clientes=ukiTarjetasAgrupadas\(\)/);
});
test('Compartir, avisar y canjear usan vista agrupada pero escriben solo en original',()=>{
 const acciones=section('function compartirImagenTimbres(','function addGasto(){');
 assert.match(acciones,/function compartirImagenTimbres\(key\)\{\s*const cli=ukiVistaCliente\(key\)/);
 assert.match(acciones,/function avisarTimbres\(key,modo='abrir'\)\{\s*const cli=ukiVistaCliente\(key\)/);
 assert.match(acciones,/const original=S\.clientes\[key\],cli=ukiVistaCliente\(key\)/);
 assert.match(acciones,/original\.movimientos\.push\(\{tipo:'canje10'/);
});
test('El JavaScript íntegro del panel es sintácticamente válido',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const main=scripts.find(x=>x.includes('function vClientes(){')&&x.includes('function vPedidos(){'));
 assert.ok(main);
 assert.doesNotThrow(()=>new vm.Script(main));
});
test('Primero el último PEDIDO registrado aunque la fecha del timbre sea distinta',()=>{
 const S={suc:'Uki Regimiento Arica',pedidos:[
  {id:1,suc:'Uki Regimiento Arica',registradoEn:1000},
  {id:2,suc:'Uki Regimiento Arica',registradoEn:3000},
  {id:3,suc:'Uki Regimiento Arica',registradoEn:2000}
 ]};
 const ctx={S,fechaRegistroMs:p=>p.registradoEn};
 vm.createContext(ctx);
 vm.runInContext(section('function ukiRegistroTimbreMs(m){','function vClientes(){'),ctx);
 const compras=[
  {tipo:'venta',pedidoId:1,fecha:'2026-11-09T20:00:00Z'},
  {tipo:'venta',pedidoId:2,fecha:'2026-11-09T08:00:00Z'},
  {tipo:'venta',pedidoId:3,fecha:'2026-11-09T15:00:00Z'}
 ];
 const orden=compras.slice().sort((a,b)=>ctx.ukiRegistroTimbreMs(b)-ctx.ukiRegistroTimbreMs(a));
 assert.deepEqual(orden.map(m=>m.pedidoId),[2,3,1]);
 const tarjetas=[
  {nombre:'Primero',movimientos:[compras[0]]},
  {nombre:'Último',movimientos:[compras[1]]},
  {nombre:'Medio',movimientos:[compras[2]]}
 ];
 tarjetas.sort((a,b)=>ctx.ukiUltimaCompraClienteMs(b)-ctx.ukiUltimaCompraClienteMs(a));
 assert.deepEqual(tarjetas.map(x=>x.nombre),['Último','Medio','Primero']);
 const vista=section('function vClientes(){','function compartirImagenTimbres(');
 assert.match(vista,/sort\(\(a,b\)=>ukiUltimaCompraClienteMs\(b\)-ukiUltimaCompraClienteMs\(a\)/);
 assert.match(vista,/sort\(\(a,b\)=>b\.registroMs-a\.registroMs/);
 assert.match(vista,/Primero el último pedido registrado/);
});
