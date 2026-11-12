'use strict';
// Prueba aislada: ejecuta los mismos módulos del panel en un DOM realista.
// Las peticiones se simulan. NO inicia Google, NO escribe producción.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const SCRIPTS=[
 'firebase/uki-inventario-admin-embebido.js',
 'firebase/uki-disponibilidad-admin.js',
 'firebase/uki-carta-precios-admin.js',
 'firebase/uki-inventario-exportar.js',
 'firebase/uki-inventario-historial-admin.js'
];
const mockInventory=branch=>[
 {sku:'ingredient:proteina-pollo',name:'Pollo',kind:'ingredient',stock_qty:2.5,
  min_stock_qty:3,stock_unit:'kg',category:'ingrediente',inventory_only:false,version:1},
 {sku:'inv:00000000-0000-0000-0000-000000000001',name:'Aceite',kind:'inventory',
  stock_qty:3,min_stock_qty:2,stock_unit:'l',category:'ingrediente',inventory_only:true,version:2},
 {sku:'ingredient:vegetal-palta',name:branch==='arica'?'Palta':'Palta Serena',
  kind:'ingredient',stock_qty:2,min_stock_qty:1,stock_unit:'kg',
  category:'ingrediente',inventory_only:false,version:0}
];
const history=[
 {id:'0a1b2c3d-ffff-4000-8000-000000000001',worker_name:'Trabajadora de prueba',
  summary:{productos:3,faltantes:[{nombre:'Pollo'}]},created_at:'2026-11-07T01:45:00Z'}
];
async function tick(){
 for(let i=0;i<7;i++)await new Promise(resolve=>setImmediate(resolve));
}
async function setup(){
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{
  url:'https://diannaleandra-art.github.io/uki-panel-demo-independiente/firebase/uki-sushi-local.html',
  runScripts:'outside-only'
 });
 const w=dom.window,requests=[],downloads=[],shared=[];
 w.ukiInventarioToken=async()=> 'SIMULADO.NO_ES_GOOGLE.SIN_PERMISOS';
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.confirm=()=>true;
 w.URL.createObjectURL=blob=>{downloads.push({blob});return 'blob:mock-inventario';};
 w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){downloads.push({filename:this.download,href:this.href});};
 w.navigator.canShare=()=>true;
 w.navigator.share=async payload=>{shared.push(payload);};
 w.fetch=async(url,init={})=>{
  const request=JSON.parse(init.body||'{}');
  const branch=request.branch||'arica',action=request.action;
  requests.push({url,branch,action,data:request,authorization:init.headers?.Authorization});
  let data={ok:true,branch};
  if(url.includes('uki-disponibilidad-live')){
   if(action==='listar')data.items=[{sku:'classic:24',name:'Sushi 24 piezas',kind:'product',available:true,version:2}];
   if(action==='marcar')Object.assign(data,{available:request.available,version:3});
  }else if(url.includes('uki-carta-precios-live')){
   if(action==='listar')data.items=[
    {sku:'classic:24',kind:'classic',group:'promos',name:'Sushi clásico 24 piezas',
     price:branch==='arica'?8000:7500,available:true,version:2,custom:false},
    ...(branch==='arica'?[{sku:'pizza:pepperoni',kind:'pizza',group:'pizzas',
     name:'Pizza pepperoni',price:9000,available:true,version:1,custom:false}]:[])
   ];
   if(action==='editar-precio')data.item={sku:request.sku,price:request.price,version:request.expected_version+1};
   if(action==='crear-producto')data.item={sku:'pizza:mock-prueba',...request.item,available:true,version:1};
  }else if(url.includes('inventario-turno-live')){
   if(action==='articulos')data.items=mockInventory(branch);
   if(action==='reportes')data.revisiones=history;
   if(action==='historial')Object.assign(data,{revisiones:history,total:1,offset:0,limite:25});
   if(action==='revision')data.revision={...history[0],branch,items:mockInventory(branch)};
  }else throw Error('No se permite otra API en pruebas: '+url);
  return {ok:true,status:200,json:async()=>data};
 };
 for(const file of SCRIPTS){
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  w.eval(source+'\n//# sourceURL='+file);
 }
 const html=w.ukiInventarioPanelHTML();
 w.document.body.innerHTML=html;
 w.ukiInventarioMontar();
 await tick();
 const nav=async key=>{
  const btn=w.document.querySelector('[data-uki-tab="'+key+'"]');
  assert.ok(btn,'Falta sección '+key);
  btn.click();await tick();return btn;
 };
 return {dom,w,requests,downloads,shared,nav};
}
test('cuatro secciones, lista corta e inventario en administración con sucursal correcta',async()=>{
 const ctx=await setup(),{w,requests,nav}=ctx,d=w.document;
 try{
  assert.equal(d.querySelectorAll('[data-uki-tab]').length,4);
  assert.equal(d.getElementById('ukiMiniInventario').hidden,false);
  assert.match(d.getElementById('ukiMiniFilas').textContent,/Pollo/);
  assert.match(d.getElementById('ukiMiniEstado').textContent,/para reponer/);
  assert.equal(d.getElementById('invAdmin').style.display,'none','No debe ocupar pantalla el editor entero');
  const edit=d.querySelector('#ukiMiniFilas button');
  assert.ok(edit);edit.click();await tick();
  assert.equal(d.getElementById('invAdmin').style.display,'');
  assert.equal(d.getElementById('invSelect').value,'inv:00000000-0000-0000-0000-000000000001');
  assert.match(d.getElementById('ukiMiniFilas').firstElementChild.textContent,/Aceite/);
  await nav('precios');
  assert.match(d.getElementById('ukiPriceList').textContent,/24 piezas/);
  assert.equal(d.getElementById('ukiMiniInventario').hidden,true);
  assert.equal(d.getElementById('ukiPreciosPanel').style.display,'');
  await nav('disponibilidad');
  assert.notEqual(d.getElementById('ukiCartaDisponibilidad').style.display,'none');
  assert.match(d.getElementById('ukiDispLista').textContent,/24 piezas/);
  assert.equal(d.getElementById('ukiPreciosPanel').style.display,'none');
  await nav('reportes');
  assert.equal(d.getElementById('ukiHistorial').hidden,false);
  assert.equal(d.getElementById('ukiMiniInventario').hidden,true);
  assert.match(d.getElementById('ukiHistoriaLista').textContent,/Trabajadora de prueba/);
  assert.ok(requests.some(x=>x.action==='historial'&&x.branch==='arica'));
  assert.ok(requests.filter(x=>x.action).every(x=>x.authorization==='Bearer SIMULADO.NO_ES_GOOGLE.SIN_PERMISOS'), 'todas las operaciones protegidas deben llevar token; las fotos públicas no requieren autorización');
 }finally{ctx.dom.window.close();}
});
test('abrir historial y preparar Excel, PDF y compartir inventario por WhatsApp desde el panel',async()=>{
 const ctx=await setup(),{w,nav,downloads,shared}=ctx,d=w.document;
 try{
  await nav('reportes');
  const open=d.querySelector('#ukiHistoriaLista button');
  assert.ok(open,'La revisión tiene que ofrecer botón Ver inventario');open.click();await tick();
  assert.equal(d.getElementById('ukiHistorialDetalle').hidden,false);
  assert.match(d.getElementById('ukiHistorialFecha').textContent,/22:45 h/);
  assert.match(d.getElementById('ukiDetalleLista').textContent,/Pollo/);
  d.getElementById('ukiDetalleExcel').click();await tick();
  d.getElementById('ukiDetallePDF').click();await tick();
  assert.ok(downloads.some(x=>/\.csv$/.test(x.filename||'')));
  assert.ok(downloads.some(x=>/\.pdf$/.test(x.filename||'')));
  assert.ok(downloads.some(x=>x.blob?.type==='application/pdf'));
  d.getElementById('ukiDetalleCompartir').click();await tick();
  assert.equal(shared.length,1);
  assert.match(shared[0].text,/Regimiento Arica/);
  assert.match(shared[0].text,/22:45 h/);
  assert.equal(shared[0].files[0].type,'application/pdf');
 }finally{ctx.dom.window.close();}
});
test('cambio de sucursal durante espera de Google no desvía edición de precio al otro local',async()=>{
 const ctx=await setup(),{w,requests,nav}=ctx,d=w.document;
 try{
  await nav('precios');
  const amount=d.querySelector('#ukiPriceList input[type="number"]');
  const save=d.querySelector('#ukiPriceList button');
  assert.ok(amount&&save);amount.value='8500';
  let releaseToken;
  const pendingGoogle=new Promise(resolve=>{releaseToken=resolve});
  w.ukiInventarioToken=()=>pendingGoogle;
  save.click();
  assert.ok(releaseToken,'La edición debe esperar el token');
  d.getElementById('invBranch').value='serena';
  d.getElementById('invBranch').dispatchEvent(new w.Event('change',{bubbles:true}));
  releaseToken('SIMULADO.NO_ES_GOOGLE.SIN_PERMISOS');
  await tick();
  const changed=requests.find(x=>x.action==='editar-precio');
  assert.ok(changed,'Se registró una edición simulada');
  assert.equal(changed.branch,'arica','No puede guardar precios en Serena por cambiar sucursal durante Google');
  assert.equal(changed.data.price,8500);
 }finally{ctx.dom.window.close();}
});
