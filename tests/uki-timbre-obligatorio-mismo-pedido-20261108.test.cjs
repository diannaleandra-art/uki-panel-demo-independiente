'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const from=html.indexOf('function ukiNumeroTimbreWhatsApp('),to=html.indexOf('function vNuevo(){',from);
assert.ok(from>0&&to>from,'está incluido el flujo manual en Nuevo pedido');
const block=html.slice(from,to);
const alerts=[],ctx={
 S:{suc:"Uki Regimiento Arica",clientes:{},pedidos:[]},
 D:{},
 ukiTelefonoNormalizado:t=>{let n=String(t||'').replace(/\D/g,'');return /^9\d{8}$/.test(n)?'56'+n:n;},
 getCliente:()=>null,ventasValidas:()=>0,
 ukiTimbreResponsableActual:()=> 'Agendador QA',
 aviso:m=>alerts.push(m),render:()=>{},
 window:{open:()=>({})}
};
vm.createContext(ctx);vm.runInContext(block,ctx);
const base=()=>({
 cliente:"Camila",telefono:"+56 9 1234 5678",pagado:true,editando:null,
 modalidad:"Retiro",fecha:"2026-11-08T20:00",medio:"Efectivo",
 items:[{nombre:"Promo 24",cant:1,precio:7500,det:""}]
});
test("Pago con WhatsApp exige confirmación manual: abrir enlace no basta",()=>{
 ctx.D=base();
 assert.equal(ctx.ukiTimbreObligatorioGuardar(ctx.D,null),true);
 assert.equal(ctx.ukiValidarTimbreAntesGuardar(ctx.D,null),false);
 ctx.ukiAbrirTimbreBorrador();
 assert.equal(ctx.ukiValidarTimbreAntesGuardar(ctx.D,null),false);
 ctx.ukiConfirmarTimbreBorrador(true);
 assert.equal(ctx.ukiValidarTimbreAntesGuardar(ctx.D,null),true);
 const p={id:5};
 ctx.ukiAnotarTimbreConfirmadoEnPedido(p,ctx.D);
 assert.ok(p.timbreEnviadoEn);
 assert.equal(p.timbreEnviadoPor,'Agendador QA');
 assert.equal(p.timbreReglaObligatoria,true);
 assert.equal(p.timbreEventos.length,2);
});
test("Cliente sin WhatsApp no bloquea guardar venta pagada",()=>{
 ctx.D={...base(),telefono:""};
 assert.equal(ctx.ukiTimbreObligatorioGuardar(ctx.D,null),false);
 assert.equal(ctx.ukiValidarTimbreAntesGuardar(ctx.D,null),true);
});
test("WhatsApp inválido no se salta la obligación",()=>{
 ctx.D={...base(),telefono:"321"};
 assert.equal(ctx.ukiTimbreObligatorioGuardar(ctx.D,null),true);
 assert.equal(ctx.ukiValidarTimbreAntesGuardar(ctx.D,null),false);
});
test("Editar productos, nombre o pago NO invalida timbre enviado; cambiar WhatsApp destino sí",()=>{
 ctx.D=base();ctx.ukiAbrirTimbreBorrador();ctx.ukiConfirmarTimbreBorrador(true);
 assert.equal(ctx.ukiTimbreBorradorConfirmado(ctx.D),true);
 ctx.D.items[0].precio=8000;ctx.D.cliente="Camila Editada";ctx.D.pagado=false;
 assert.equal(ctx.ukiTimbreBorradorConfirmado(ctx.D),true);
 ctx.D.pagado=true;ctx.D.telefono='+56 9 8765 4321';
 assert.equal(ctx.ukiTimbreBorradorConfirmado(ctx.D),false);
});
test("Pedido todavía sin pago y edición de venta ya pagada no exige reenviar",()=>{
 assert.equal(ctx.ukiTimbreObligatorioGuardar({...base(),pagado:false},null),false);
 assert.equal(ctx.ukiTimbreObligatorioGuardar({...base(),editando:3},{pagado:true}),false);
 assert.equal(ctx.ukiTimbreObligatorioGuardar({...base(),editando:3},{pagado:false}),true);
});
test("UI incluye validación antes del guardado y timbre por pedido exacto",()=>{
 assert.match(html,/if\(!ukiValidarTimbreAntesGuardar\(D,originalQR\)\)return/);
 assert.match(html,/if\(ukiTimbreBorradorConfirmado\(D\)\)ukiAnotarTimbreConfirmadoEnPedido\(nuevoPedido,D\)/);
 assert.match(html,/if\(!ukiTimbreYaEnviadoPedido\(p\)&&ukiTimbreBorradorConfirmado\(D\)\)/);
 assert.match(html,/function ukiAbrirTimbrePedido\(id\)/);
 assert.match(html,/pedidosSinTimbreDelDia/);
 assert.match(html,/pendientesTimbreDelDia/);
 assert.match(html,/p\.timbreReglaObligatoria&&p\.pagado/);
});
test("Bloque JS del panel sin errores de sintaxis",()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const main=scripts.find(x=>x.includes('function vNuevo(){'));
 assert.ok(main);assert.doesNotThrow(()=>new vm.Script(main));
});
