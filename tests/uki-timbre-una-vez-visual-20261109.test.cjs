'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const chunk=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'bloque '+a);return html.slice(i,j)};
const norm=t=>{let n=String(t||'').replace(/\D/g,'');if(/^9\d{8}$/.test(n))n='56'+n;return n;};
const ctx={S:{suc:'Uki Regimiento Arica'},ukiTelefonoNormalizado:norm};
vm.createContext(ctx);
vm.runInContext(chunk('function ukiTimbreYaEnviadoPedido(p){','function ukiTimbreTextoPedido('),ctx);
const base=()=>({pagado:true,telefono:'+56 9 1234 5678',cliente:'Carolina',editando:null,
 modalidad:'Retiro',productosPagadosOtroLocal:false,fecha:'2026-11-09T12:30',items:[{nombre:'Sushi 24',precio:7500,cant:1,det:''}],propinaModo:'ninguna'});
test('El aviso confirmado sobrevive pagado→no pagado→pagado y modificaciones de producto',()=>{
 const d=base(),signature=ctx.ukiFirmaTimbreBorrador(d);
 d.timbreAvisoAbiertoEn='2026-11-09T15:00:00Z';
 d.timbreAvisoConfirmadoEn='2026-11-09T15:01:00Z';
 d.timbreAvisoAbiertoFirma=signature;d.timbreAvisoConfirmadoFirma=signature;
 assert.equal(ctx.ukiTimbreBorradorConfirmado(d),true);
 d.pagado=false;
 assert.equal(ctx.ukiTimbreBorradorConfirmado(d),true);
 d.items[0].precio=9000;d.cliente='Carolina Pérez';d.modalidad='Delivery';d.envio=2000;
 d.pagado=true;
 assert.equal(ctx.ukiTimbreBorradorConfirmado(d),true,'no se vuelve a abrir WhatsApp por modificación');
 assert.equal(ctx.ukiTimbreObligatorioGuardar(d,null),true);
 assert.equal(ctx.ukiFirmaTimbreBorrador(d),signature);
});
test('Un cambio real de WhatsApp antes de guardar no confunde al destinatario',()=>{
 const d=base();d.timbreAvisoAbiertoEn='a';d.timbreAvisoConfirmadoEn='b';
 d.timbreAvisoAbiertoFirma=d.timbreAvisoConfirmadoFirma=ctx.ukiFirmaTimbreBorrador(d);
 d.telefono='+56 9 9999 8888';
 assert.equal(ctx.ukiTimbreBorradorConfirmado(d),false);
});
test('Pedido existente con timbre enviado NO exige reenviar al volver a pagado',()=>{
 const d={...base(),editando:77};
 const original={id:77,pagado:false,timbreEnviadoEn:'2026-11-09T15:01:00Z'};
 assert.equal(ctx.ukiTimbreObligatorioGuardar(d,original),false);
 assert.equal(ctx.ukiTimbreObligatorioGuardar(d,{...original,pagado:true}),false);
 assert.equal(ctx.ukiTimbreObligatorioGuardar(d,{...original,timbreEnviadoEn:null}),true);
 assert.equal(ctx.ukiTimbreObligatorioGuardar({...d,telefono:''},null),false);
 assert.equal(ctx.ukiTimbreObligatorioGuardar({...d,pagado:false},null),false);
});
test('Confirmación de timbre se anota una sola vez en el pedido y conserva evento',()=>{
 const context={ukiTimbreYaEnviadoPedido:ctx.ukiTimbreYaEnviadoPedido,
 ukiTimbreBorradorConfirmado:ctx.ukiTimbreBorradorConfirmado};
 vm.createContext(context);
 vm.runInContext(chunk('function ukiAnotarTimbreConfirmadoEnPedido(p,d){','// Distancia solo informativa:'),context);
 const d=base();const firma=ctx.ukiFirmaTimbreBorrador(d);
 Object.assign(d,{timbreAvisoAbiertoFirma:firma,timbreAvisoConfirmadoFirma:firma,
 timbreAvisoAbiertoEn:'2026-11-09T15:00:00Z',timbreAvisoConfirmadoEn:'2026-11-09T15:01:00Z',
 timbreAvisoConfirmadoPor:'Agendador'});
 const p={id:77,timbreEventos:[]};
 context.ukiAnotarTimbreConfirmadoEnPedido(p,d);
 assert.equal(p.timbreEnviadoEn,d.timbreAvisoConfirmadoEn);assert.equal(p.timbreEventos.length,2);
 context.ukiAnotarTimbreConfirmadoEnPedido(p,d);
 assert.equal(p.timbreEventos.length,2);
});
test('Cambio de estado del pago se realiza a través de editar y exige responsable',()=>{
 const calls=[],context={S:{suc:'Uki Regimiento Arica',vista:'pedidos',pedidos:[
  {id:77,suc:'Uki Regimiento Arica',pagado:true,timbreEnviadoEn:'2026-11-09T15:00:00Z',estado:'Pendiente'}
 ]},D:{},ukiCierreConfirmadoPedido:()=>null,editarPedido(id){
 calls.push(['editar',id]);context.D={editando:id,pagado:true};context.S.vista='nuevo';
 },render(){calls.push(['render']);},aviso(t){calls.push(['aviso',t]);},
 ukiTimbreYaEnviadoPedido:ctx.ukiTimbreYaEnviadoPedido,
 ukiTimbreObligatorioGuardar:ctx.ukiTimbreObligatorioGuardar};
 // Los métodos del mock se ejecutan como identificadores del entorno VM.
 vm.createContext(context);
 vm.runInContext(chunk('function togglePagado(id){','// Cancelación operativa:'),context);
 context.togglePagado(77);
 assert.equal(context.D.pagado,false);
 assert.equal(context.S.pedidos[0].pagado,true,'el original no cambia hasta guardar la corrección');
 assert.equal(calls[0][0],'editar');
 const src=chunk('function ndGuardar(){','function cerrar(){');
 assert.match(src,/autorizacion=String\(D\.responsableEdicion\|\|''\)/);
 assert.match(src,/if\(!autorizacion\)/);
 const nuevo=chunk('function vNuevo(){','function uki');
 assert.ok(html.includes("D.editando?'<div class=\"card\"><h2>Responsable de la corrección"));
});
test('Primera creación no exige nombre de edición y conserva aviso aunque guarde como no pagado',()=>{
 const src=chunk('function ndGuardar(){','function cerrar(){');
 assert.match(src,/if\(D\.editando\)\{/);
 assert.match(src,/if\(ukiTimbreBorradorConfirmado\(D\)\)ukiAnotarTimbreConfirmadoEnPedido\(nuevoPedido,D\)/);
 assert.match(html,/uk[iI]TimbreYaEnviadoPedido\(pedidoEdicion\)/);
 assert.match(html,/PASO OBLIGATORIO ANTES DE GUARDAR/);
 assert.match(html,/NO reenviar/);
 assert.match(html,/!enviado&&ukiNumeroTimbreWhatsApp/);
});
test('Color distinto por pagado, cobrar, entregado, cancelado y premio',()=>{
 const p=chunk('function vPedidos(){','let pedidoExpandido=null;');
 for(const cls of ['uki-pedido-pagado','uki-pedido-cobrar','uki-pedido-entregado',
  'uki-pedido-cancelado','uki-pedido-premio','uki-estado-badge'])assert.ok(p.includes(cls),cls);
 for(const css of ['.order-card.uki-pedido-pagado',' .order-card.uki-pedido-cobrar',
  '#ukiFraseDiariaInicio','uki-navegacion-caja','uki-navegacion-movimientos'])assert.ok(html.includes(css.trim()),css);
 assert.match(html,/Secciones de Caja visibles/);assert.match(html,/Tipos de movimiento visibles/);
});
test('Flechas cambian fecha consultada, no fecha operativa ni cierre real',()=>{
 const context={pedidosArchivoDia:'2026-11-09',S:{filtroFecha:'2026-11-09',filtro:'abc'},
 fechaOperativaActual:()=>'2026-11-09',
 verArchivoPedidos(v){this.pedidosArchivoDia=v;},
 render(){}};
 vm.createContext(context);
 vm.runInContext(chunk('function ukiDesplazarFechaISO(fecha,dias){','function aplicarDiaIncidencias(){'),context);
 assert.equal(context.ukiDesplazarFechaISO('2026-11-09',-1),'2026-11-08');
 assert.equal(context.ukiDesplazarFechaISO('2026-11-30',1),'2026-12-01');
 context.ukiMoverDiaCierres(-1);assert.equal(context.S.filtroFecha,'2026-11-08');
 assert.equal(context.S.filtro,'');
 assert.match(html,/ukiMoverDiaPedidos\(-1\)/);
 assert.match(html,/ukiMoverDiaCierres\(1\)/);
});
test('Sintaxis JS del panel válido',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 const main=scripts.find(s=>s.includes('function vNuevo(){')&&s.includes('function vPedidos(){'));
 assert.ok(main);assert.doesNotThrow(()=>new vm.Script(main));
});
