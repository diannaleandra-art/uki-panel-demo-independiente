'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const api=read('api/inventario-turno-live.js');
const client=read('firebase/uki-factura-inventario-admin-panel.js');
const common=read('public/uki-factura-interfaz-live.mjs');
const panel=read('firebase/uki-sushi-local.html');
const worker=read('public/index.html');
const config=JSON.parse(read('vercel.json'));
const st=api.indexOf('  const desdePanel=action==='),end=api.indexOf("  etapa='consulta-catalogo';",st);
assert.ok(st>0&&end>st);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const authBlock=new AsyncFunction('action','req','admin','nombre','pin','sql','input',
 'branch','fail','res', "let etapa='';"+api.slice(st,end+"  etapa='consulta-catalogo';".length)+";return {worker,etapa}");
const deny=(_r,status,error)=>({status,error});
test('trabajador: las facturas siguen autorizándose con el código de inventario',async()=>{
 let calls=0;
 const a=await authBlock('factura-recibir',{headers:{}},async()=>{throw Error('No debe usar Google')},
  ()=>'Trabajador', {autorizar:async()=>{calls++;return true}}, {}, {codigo:'123456'},
  'arica',deny,{});
 assert.equal(a.worker,'Trabajador');assert.equal(calls,1);
});
test('administración: Google autoriza solo las tres acciones de factura, sin PIN',async()=>{
 for(const action of ['factura-consultar','factura-preparar-articulos','factura-recibir']){
  let pins=0;
  const result=await authBlock(action,{headers:{authorization:'Bearer example'}},
   async()=> 'usuario-autorizado',()=>{throw Error('No necesita nombre')},
   {autorizar:async()=>{pins++;return true}}, {}, {}, 'serena',deny,{});
  assert.match(result.worker,/Administración Google/);
  assert.equal(pins,0);
 }
});
test('rechazar Google no permite saltarse el PIN ni ejecutar cambios',async()=>{
 let pins=0;
 const result=await authBlock('factura-recibir',{headers:{authorization:'Bearer invalid'}},
  async()=>null,()=>'Nadie',{autorizar:async()=>{pins++;return true}}, {}, {},
  'arica',deny,{});
 assert.equal(result.status,403);assert.equal(pins,0);
});
test('Google no concede accidentalmente permisos para contar o registrar entradas sin PIN',async()=>{
 let pins=0;
 const result=await authBlock('contar',{headers:{authorization:'Bearer example'}},
  async()=> 'usuario-autorizado',()=>'Nadie',
  {autorizar:async()=>{pins++;return false}}, {}, {},'arica',deny,{});
 assert.equal(result.status,403);assert.equal(pins,1);
});
test('ambos paneles usan la misma interfaz y API, con sucursal fija',()=>{
 assert.ok(client.includes('uki-factura-interfaz-live.mjs'));
 assert.ok(client.includes('/api/inventario-turno-live'));
 assert.ok(client.includes("const branchActual=()=>String($('invBranch')?.value||'')"));
 assert.ok(client.includes('body:JSON.stringify({...payload,branch,action})'));
 assert.ok(client.includes("post:(action,payload)=>solicitar(action,payload,branch)"));
 assert.ok(worker.includes("import {iniciarFacturaLive} from './uki-factura-interfaz-live.mjs'"));
 assert.ok(common.includes('mountTarget=null'));
 assert.ok(common.includes('mountTarget.append(section)'));
 assert.ok(common.includes("document.getElementById('items')"));
 assert.ok(panel.includes('uki-factura-inventario-admin-panel.js?v='));
 assert.equal((panel.match(/uki-factura-inventario-admin-panel\.js\?v=/g)||[]).length,1);
});
test('módulos públicos tienen CORS limitado al origen propio sin alterar rutas',()=>{
 assert.equal(config.rewrites.length,2);
 for(const name of ['uki-factura-interfaz-live.mjs','uki-factura-lectura-live.mjs']){
  const entry=config.headers.find(h=>h.source==='/'+name);
  assert.ok(entry);
  assert.equal(entry.headers.find(h=>h.key==='Access-Control-Allow-Origin').value,
   'https://diannaleandra-art.github.io');
 }
});
test('código del adaptador y formulario original tienen sintaxis JavaScript correcta',()=>{
 assert.doesNotThrow(()=>new Function(client));
 assert.doesNotThrow(()=>new Function(common.replace(/^import .*$/gm,'').replace(/^export /gm,'')));
 assert.doesNotThrow(()=>new Function("const module={exports:{}};\n"+api));
});

test('el panel rechaza limpiamente un módulo de facturas antiguo sin montaje',()=>{
 const guard=client.indexOf('if(lib.facturaAdmiteMontajeAdmin!==true)');
 const call=client.indexOf('lib.iniciarFacturaLive({');
 assert.ok(guard>=0&&call>guard,'Comprobar compatibilidad antes de montar');
 assert.match(client,/usarRecepcionPorCodigo\('El servicio de facturas/);
 assert.ok(client.includes('https://uki-sushi-inventario.vercel.app/'));
 assert.match(client,/no la registres dos veces/);
});
test('módulo compartido incluye señal para montaje admin sin alterar QR',()=>{
 assert.match(common,/export const facturaAdmiteMontajeAdmin\s*=\s*true/);
 assert.ok(common.includes('mountTarget.append(section)'));
 assert.ok(common.includes("itemsContainer.parentNode.insertBefore(section,itemsContainer)"));
 assert.match(panel,/uki-facturas-error-version-v2-20261111/);
});
