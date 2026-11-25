'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const remote=fs.readFileSync('firebase/uki-carta-remotas-panel.js','utf8');
const extract=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j)};
test('Sin cambios no hay nuevos avisos, escrituras ni temporizadores de nube',async()=>{
 const mod=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(fs.readFileSync('firebase/uki-sushi-autoguardado.js','utf8')));
 let notices=[],writes=0,timers=new Map(),seq=0,st={suc:'regimiento',pedidos:[]};
 const a=mod.crearAutoGuardadoOperativo({getEstado:()=>st,
  avisar:x=>notices.push(x.estado),guardar:async({revisionEsperada})=>{writes++;return {revision:revisionEsperada+1}},
  scheduler:fn=>{timers.set(++seq,fn);return seq},cancel:id=>timers.delete(id)});
 a.activar({suc:st.suc,rev:1,estadoBase:st});const n=notices.length;
 for(let i=0;i<20;i++)a.cambioLocal();
 assert.equal(notices.length,n);assert.equal(timers.size,0);assert.equal(writes,0);
 st={...st,pedidos:[{id:1}]};a.cambioLocal();assert.equal(timers.size,1);
 const [id,fn]=timers.entries().next().value;timers.delete(id);await fn();
 assert.equal(writes,1);assert.equal(a.resumen().actualRespaldado,true);
});
test('La consulta automática de carta no redibuja si la respuesta coincide, pero sí al cambiar y al consultar manualmente',async()=>{
 let draws=0;const rows=[{branch:'arica',estado:'pendiente',id:'1'}];let current=rows;
 const context={S:{suc:'Uki Regimiento Arica',vista:'pedidos'},
  ukiCartaRemotas:{branch:'arica',rows:rows.slice(),status:'1 solicitud(es) pendientes. Comprueba que el WhatsApp del cliente también haya llegado.',busy:false,used:true},
  document:{body:{classList:{contains:()=>false}}},ukiMesaBranch:()=> 'arica',
  ukiCartaApiSesion:async()=> 'fixture',fetch:async()=>({ok:true,json:async()=>({ok:true,orders:current})}),
  UKI_CARTA_REMOTAS_API:'https://fixture.invalid',ukiCartaReservaVencidaQA:()=>false,ukiCartaAceptadasSinVinculo:()=>[],
  render:()=>draws++,ukiCartaConfirmarRespaldados:()=>{},AbortSignal:{timeout:()=>undefined}};
 vm.createContext(context);
 vm.runInContext('let ukiCartaReservaDesfaseServidorQA=0,ukiCartaRecuperacionPuedeQA=false;'+extract(remote,'async function ukiCartaRemotasActualizar(','// Comprobación estricta del cierre'),context);
 await vm.runInContext('ukiCartaRemotasActualizar(true)',context);assert.equal(draws,0);
 current=[...rows,{branch:'arica',estado:'pendiente',id:'2'}];
 await vm.runInContext('ukiCartaRemotasActualizar(true)',context);assert.equal(draws,1);
 await vm.runInContext('ukiCartaRemotasActualizar(false)',context);assert.equal(draws,2);
});
test('Consulta automática de mesas conserva la pantalla cuando no hay cambios y dibuja cambios reales',async()=>{
 let draws=0;const rows=[{branch:'arica',id:'1'}];let current=rows;
 const context={S:{suc:'Uki Regimiento Arica',vista:'pedidos'},ukiMesas:{branch:'arica',rows:rows.slice(),cuentas:[],status:'1 solicitud(es) por revisar.',busy:false,used:true},
 UKI_MESAS_PANEL_ACTIVADO:true,UKI_MESAS_ENDPOINT:'https://fixture.invalid',UKI_MESAS_LIVE_URL:'https://otra.invalid',
 ukiMesaBranch:()=> 'arica',window:{ukiMesasQAToken:async()=> 'fixture'},fetch:async()=>({ok:true,json:async()=>({ok:true,orders:current})}),
 render:()=>draws++,ukiMesaConfirmarGuardadosSeguro:()=>{},AbortSignal:{timeout:()=>undefined}};
 vm.createContext(context);
 vm.runInContext(extract(html,'async function ukiMesaActualizar(','function ukiMesaAbrir('),context);
 await vm.runInContext('ukiMesaActualizar(true)',context);assert.equal(draws,0);
 current=[...rows,{branch:'arica',id:'2'}];await vm.runInContext('ukiMesaActualizar(true)',context);assert.equal(draws,1);
 await vm.runInContext('ukiMesaActualizar(false)',context);assert.equal(draws,3);
});
