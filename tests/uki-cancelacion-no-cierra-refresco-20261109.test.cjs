'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
function seg(a,b){
 const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'No se encontró '+a);
 return html.slice(i,j);
}
test('La validación de cancelación usa mensaje en el propio pedido, sin volver arriba',()=>{
 const cancelar=seg('function ukiErrorCancelarPedido(id,mensaje){','// El código visible sale siempre');
 assert.match(cancelar,/destino\.textContent=mensaje/);
 assert.match(cancelar,/destino\.hidden=false/);
 assert.match(cancelar,/scrollIntoView\?\./);
 assert.doesNotMatch(cancelar,/window\.scrollTo\(\{top:0/);
 const ui=seg('function vPedidos(){','let pedidoExpandido=null;');
 assert.match(ui,/id="ukiErrorCancelar\$\{p\.id\}"/);
 assert.match(ui,/id="detalleCancelacion\$\{p\.id\}" rows="2"/);
 assert.doesNotMatch(ui,/id="detalleCancelacion\$\{p\.id\} rows=/);
});
test('Refresh conserva pedido, su bloque Cancelar, motivo, selección, posición y foco',()=>{
 const suc='Uki Regimiento Arica';
 let app,currentArea,currentSelect,scroll=0,focused=false;
 function construir(valor,seleccion,abiertoPedido,abiertoCancelar){
  const pedido={
   open:abiertoPedido,getAttribute:()=>String(257),
   closest:selector=>selector==='details[data-uki-pedido-id]'?pedido:null,
   querySelectorAll:selector=>selector==='details'?[cancelar]:[],
   querySelector:()=>({textContent:'Pedido #257'}),
   parentElement:{closest:()=>null}
  };
  const cancelar={
   open:abiertoCancelar,
   closest:selector=>selector==='details[data-uki-pedido-id]'?pedido:null,
   querySelectorAll:()=>[],querySelector:()=>({textContent:'Cancelar pedido'}),
   parentElement:{closest:()=>pedido}
  };
  const area={id:'detalleCancelacion257',value:valor,selectionStart:4,selectionEnd:4,
   focus:()=>{focused=true;},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}};
  const select={id:'motivoCancelacion257',value:seleccion};
  app={
   querySelectorAll:selector=>selector==='details'?[pedido,cancelar]:
    selector.startsWith('[id^=')?[area,select]:[],
   contains:node=>node===area||node===select||node===pedido||node===cancelar
  };
  currentArea=area;currentSelect=select;
  return {pedido,cancelar,area,select};
 }
 const antes=construir('Cliente pidió cambio', 'cliente',true,true);
 const win={scrollY:712,scrollTo:({top})=>{scroll=top;}};
 const doc={activeElement:antes.area,getElementById:id=>
  id==='detalleCancelacion257'?currentArea:
  id==='motivoCancelacion257'?currentSelect:null};
 const ctx={S:{vista:'pedidos',suc},window:win,document:doc,$:id=>id==='app'?app:null};
 vm.createContext(ctx);
 vm.runInContext('let cancelacionGuardando=false;\n'+seg('let ukiUltimaVistaRender=','function render(){'),ctx);
 vm.runInContext("ukiUltimaVistaRender=S.vista;ukiUltimaSucursalRender=S.suc;",ctx);
 const estado=vm.runInContext('ukiCapturarVistaAntesRender()',ctx);
 assert.ok(estado);
 const despues=construir('','',false,false);
 doc.activeElement={id:'ninguno'};
 vm.runInContext('ukiRestaurarVistaTrasRender(vista)',Object.assign(ctx,{vista:estado}));
 assert.equal(despues.pedido.open,true);
 assert.equal(despues.cancelar.open,true);
 assert.equal(despues.area.value,'Cliente pidió cambio');
 assert.equal(despues.select.value,'cliente');
 assert.equal(scroll,712);
 assert.equal(focused,true);
});
test('Mientras se escribe el motivo NO se reemplaza la pantalla por refresco',()=>{
 const code='let cancelacionGuardando=false;\n'+seg('let ukiUltimaVistaRender=','function render(){');
 const ctx={
  S:{vista:'pedidos',suc:'Uki Regimiento Arica',msg:null},
  document:{activeElement:{id:'detalleCancelacion257'}},
  $:id=>id==='app'?{contains:()=>true}:null
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 assert.equal(vm.runInContext('ukiEscribiendoCancelacion()',ctx),true);
 ctx.document.activeElement={id:'otraCosa'};
 assert.equal(vm.runInContext('ukiEscribiendoCancelacion()',ctx),false);
 ctx.document.activeElement={id:'detalleCancelacion257'};
 ctx.S.msg='Cancelado';
 assert.equal(vm.runInContext('ukiEscribiendoCancelacion()',ctx),false);
 const render=seg('function render(){','function pedirPin(s){');
 assert.match(render,/if\(ukiEscribiendoCancelacion\(\)\)\{void guardarEnLocalStorage\(\);return;\}/);
 assert.match(render,/ukiCapturarVistaAntesRender\(\)/);
 assert.match(render,/ukiRestaurarVistaTrasRender\(ukiVistaAnterior\)/);
});
test('El formulario no desaparece por S.busy y pide aclaración si pago anterior era erróneo',()=>{
 const ui=seg('function vPedidos(){','let pedidoExpandido=null;');
 const elig=seg('function ukiFormularioCancelarDisponible(p){','async function cancelarPedido(id){');
 assert.match(ui,/ukiFormularioCancelarDisponible\(p\)/);
 assert.match(ui,/cobroCancelacion/);
 assert.match(ui,/no_recibido/);
 assert.match(ui,/devuelto/);
 assert.match(ui,/pendiente/);
 assert.match(elig,/!S\.busy&&!cancelacionGuardando/);
 assert.match(elig,/ukiFormularioCancelarDisponible/);
});
test('El bloque JavaScript principal es sintácticamente válido',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 const main=scripts.find(x=>x.includes('function render(){')&&x.includes('function vPedidos(){'));
 assert.ok(main);
 assert.doesNotThrow(()=>new vm.Script(main));
});