'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const bridge=fs.readFileSync('firebase/uki-fin-auto-qa.js','utf8');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
test('El emisor permanece desactivado hasta un endpoint QA aprobado',async()=>{
 let calls=0;
 const ctx={window:{
   ukiInventarioToken:async()=>{calls++;return 'token'},
   ukiVentasAutoResumenActual:()=>({branch:'arica',turno_ref:'arica|2026-11-08|1794190000000',
    fecha_operativa:'2026-11-08',estado:'abierto',revision:42,venta_total:27000,pedidos:3,
    medios:{Efectivo:3500,Transferencia:23500}})
 },location:{hostname:'diannaleandra-art.github.io'},console,Date,Set,Number,Object,
 fetch:()=>{throw Error('No debe contactar servicios en prueba inerte')}};
 vm.runInNewContext(bridge,ctx);
 assert.equal(ctx.window.ukiFinAutoQAEstado().configurado,false);
 assert.equal(await ctx.window.ukiFinAutoQAActualizar(),false);
 assert.equal(calls,0,'No pedir token ni transferir información si el endpoint no está autorizado.');
});
test('No hay trasvase del contenido de clientes ni cambios a la caja',()=>{
 assert.match(bridge,/const QA_ENDPOINT='';/);
 assert.match(bridge,/uk(i)?iInventarioToken/);
 assert.doesNotMatch(bridge,/\.pedidos\.push\(|\.cierres\.push\(|DELETE FROM|fin_movimientos/i);
 assert.match(bridge,/NO_CONTABILIZADO/);
 assert.match(html,/window\.ukiVentasAutoResumenActual=/);
 assert.match(html,/window\.ukiVentasAutoResumenCierre=/);
 assert.match(html,/window\.ukiFinAutoQAEnviarCierre/);
 assert.match(html,/estado==='sincronizado'/);
 assert.match(html,/<script src="\.\/uki-fin-auto-qa\.js" defer><\/script>/);
 const main=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(main);assert.doesNotThrow(()=>new vm.Script(main));
});
