'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const card=fs.readFileSync('firebase/uki-tarjeta-cliente.js','utf8');
const main=html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
const normalize=t=>{const d=String(t||'').replace(/\D/g,'');return /^9\d{8}$/.test(d)?'56'+d:d;};
const text=t=>String(t||'').trim().toLowerCase();
function button(nombre,telefono,codigo=''){
 const values={nombre,telefono,codigo};
 return {closest(){return {querySelector(selector){
  const field=selector.match(/data-uki-cliente-campo="([^"]+)"/)?.[1];
  return field?{value:values[field]}:null;
 }}}};
}
function editor(S,notify=()=>{},save=()=>{}){
 const a=html.indexOf('function ukiWhatsAppClienteValido(');
 const b=html.indexOf('\nfunction vClientes(){',a);
 assert.ok(a>=0&&b>a,'No se encontró el editor');
 const segment=html.slice(a,b);
 return Function('S','window','aviso','guardarEnLocalStorage','ukiTelefonoNormalizado','ukiTextoBusqueda',
 segment+'\nreturn {guardar:ukiGuardarDatosCliente,validar:ukiWhatsAppClienteValido};')(
  S,{ukiCancelacionNubeLista:()=>true},notify,save,normalize,text);
}
test('El panel y la tarjeta compartible tienen JavaScript válido',()=>{
 assert.ok(main&&main.includes('function vClientes(){'));
 assert.doesNotThrow(()=>new vm.Script(main));
 assert.doesNotThrow(()=>new vm.Script(card));
});
test('Ficha y tarjeta compartible muestran la identificación completa',()=>{
 for(const x of ['👤 Nombre:','📱 WhatsApp:','🔢 Código:','Completar o editar datos del cliente',
   'data-uki-cliente-campo="nombre"','data-uki-cliente-campo="telefono"','data-uki-cliente-campo="codigo"'])
  assert.ok(html.includes(x),x);
 for(const x of ['Nombre y apellido','Código: ','WhatsApp: ','Sin registrar'])
  assert.ok(card.includes(x),x);
 assert.match(html,/window\.ukiTarjetaMostrar\(\{nombre:cli\.nombre,whatsapp:cli\.telefono\|\|""/);
});
test('Editar sin WhatsApp mantiene tarjeta, movimientos, premios y compras',()=>{
 const cli={nombre:'sergio',telefono:'',codigoCliente:'',ventas:3,pedidos:3,gastado:24300,canje6:false,
  movimientos:[{tipo:'venta',pedidoId:1},{tipo:'venta',pedidoId:2},{tipo:'venta',pedidoId:3}]};
 const S={suc:'Uki Regimiento Arica',busy:false,clientes:{'nombre:sergio':cli}};
 let saved=0,msg='';
 const e=editor(S,m=>msg=m,()=>saved++);
 assert.equal(e.validar(''),true);
 e.guardar('nombre:sergio',button('Sergio Pérez','',''));
 assert.equal(cli.nombre,'Sergio Pérez');
 assert.equal(cli.telefono,'');
 assert.equal(S.clientes['nombre:sergio'],cli);
 assert.equal(cli.movimientos.length,3);
 assert.equal(cli.pedidos,3);
 assert.equal(cli.gastado,24300);
 assert.equal(saved,1);
 e.guardar('nombre:sergio',button('Sergio Pérez','912345678','0000'));
 assert.equal(cli.telefono,'912345678');
 assert.equal(cli.codigoCliente,'5678');
 assert.equal(cli.movimientos.length,3);
 assert.equal(cli.pedidos,3);
 assert.equal(saved,2);
 assert.ok(cli.identidadesAnteriores.some(x=>x.nombre==='sergio'));
 assert.ok(cli.identidadesAnteriores.some(x=>x.nombre==='Sergio Pérez'&&x.telefono===''));
 assert.match(msg,/Timbres, premios e historial se conservaron/);
});
test('No guarda WhatsApp inválido ni fusiona identidades diferentes',()=>{
 const cli={nombre:'Ana',telefono:'',codigoCliente:'',movimientos:[{tipo:'venta',pedidoId:18}]};
 const otro={nombre:'Berta',telefono:'56911112222',codigoCliente:'2222',movimientos:[]};
 const S={suc:'Uki La Serena',busy:false,clientes:{a:cli,b:otro}};
 let saved=0,msg='';
 const e=editor(S,m=>msg=m,()=>saved++);
 e.guardar('a',button('Ana','123'));
 assert.equal(saved,0);assert.match(msg,/WhatsApp inválido/);
 e.guardar('a',button('Ana','56911112222'));
 assert.equal(saved,0);assert.match(msg,/Ya existe otra tarjeta/);
 assert.equal(cli.movimientos.length,1);
});
test('Historial identifica compras por pedido y conserva nombres anteriores',()=>{
 assert.match(html,/const ids=new Set\(\(perfil\?ukiMovimientosVinculados\(perfil\):\[\]\)\.map\(m=>Number\(m\.pedidoId\)\)/);
 assert.match(html,/if\(ids\.has\(Number\(p\.id\)\)\)return true/);
 assert.match(html,/identidadesAnteriores/);
 assert.match(html,/const ids=new Set\(pedidosHist\(cli\.nombre,cli\.codigoCliente,cli\.telefono\)/);
});
test('Sin WhatsApp se permite completar después y no se exige enviar',()=>{
 for(const x of ['tieneWhatsApp','📋 Copiar aviso','El WhatsApp es opcional',
  'const key=cli._ukiClave||'])
  assert.ok(html.includes(x),x);
});
