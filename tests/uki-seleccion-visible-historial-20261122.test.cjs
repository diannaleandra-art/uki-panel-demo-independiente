'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const cut=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Falta bloque '+start);
 return html.slice(a,b);
};
test('Al tocar una tarjeta se muestra inmediatamente el producto seleccionado encima de la lista',()=>{
 const block=cut('function ukiDibujarCatalogoManual(){','function vNuevo(){');
 assert.match(block,/Producto seleccionado · aún no agregado al pedido/);
 assert.match(block,/chosen\.scrollIntoView\(\{behavior:'smooth',block:'start'\}\)/);
 assert.match(block,/root\.append\(search,chosen,grid,refresh\)/);
 assert.match(block,/b\.setAttribute\('aria-pressed'/);
 assert.match(block,/tile\.style\.border=selected\?/);
 assert.match(block,/id='ukiProductoSeleccionActual'/);
 assert.match(block,/Agregar al pedido/);
});
test('Luego de agregar se confirma arriba sin guardar o cobrar',()=>{
 const code=cut('function ukiProductoAgregadoMensaje(){','function ukiCatalogoManualUI(){');
 assert.match(code,/Agregado al pedido/);
 assert.match(code,/todavía no se ha guardado ni cobrado/);
 assert.match(code,/ukiResumenProductosPedido/);
 const selection=cut('function ukiDibujarCatalogoManual(){','function vNuevo(){');
 assert.match(selection,/ukiConfirmarProductoAgregado\(D\.items\[D\.items\.length-1\]\)/);
});
test('Nuevos controles conservan sintaxis válida',()=>{
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/src=/.test(m[1])&&m[2].trim());
 const main=scripts.find(m=>m[2].includes('function ukiDibujarCatalogoManual(){'));
 assert.ok(main);
 assert.doesNotThrow(()=>new vm.Script(main[2]));
});
test('Pendientes de turnos antiguos se consultan solo en Historial, sin alterar datos',()=>{
 const pedidos=cut('function vPedidos(){','let pedidoExpandido=null;');
 assert.doesNotMatch(pedidos,/Pendientes de turnos anteriores/);
 const history=cut("let ukiPendientesHistoricosDia='';",'function vHistorialCompacto(){');
 const rows=Array.from({length:301},(_,i)=>({id:i+1,fechaISO:'2026-11-10',pagado:false,estado:'Pendiente',esPremio:false}));
 const ctx={S:{suc:'Uki Regimiento Arica'},pedidosSuc:()=>rows,esDelPeriodo:()=>false,
  fechaTurnoRegistro:p=>p.fechaISO,ukiReferenciaConCarta:p=>'#'+p.id,esc:String,ir:()=>{throw Error('No debe navegar sin clic')},render:()=>{}};
 vm.createContext(ctx);
 const htmlHist=vm.runInContext(history+'\nukiHistorialPendientesAnterioresUI()',ctx);
 assert.match(htmlHist,/Pedidos de otras jornadas por revisar · 301/);
 assert.match(htmlHist,/Solo archivo histórico/);
 assert.match(htmlHist,/Buscar un día/);
 assert.equal((htmlHist.match(/>Ver día<\/button>/g)||[]).length,25);
 assert.equal(rows.length,301);
 assert.equal(rows[0].estado,'Pendiente');
 assert.match(html,/ukiHistorialPendientesAnterioresUI\(\)\+ukiArchivoRechazadosHistorialUI\(\)/);
});
