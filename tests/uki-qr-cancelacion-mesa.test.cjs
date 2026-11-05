'use strict';
// Pruebas aisladas, sin tocar Firebase, Neon ni caja de Uki.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
function extraer(inicio,fin){
 const a=html.indexOf(inicio),b=html.indexOf(fin,a);
 assert.ok(a>0&&b>a,'Falta función de resguardo QR: '+inicio);
 return html.slice(a,b);
}
const code=extraer('function ukiMesaDetalleCubreRondas(','\nasync function ukiMesaRespaldoLocalContiene(');
const candidate=extraer('function ukiMesaCuentaCanceladaCandidata(','\nfunction ukiMesasUI(){');
const id='ff60bc4b-6b09-49d7-8c8a-0b7d1d96b3d5';
const c=()=>({id:'090ec1ca-5659-4034-bf7d-bd6a5adb6023',branch:'arica',mesa:50,
 estado:'abierta',total:2500,rondas:1,detalle:[{id,subtotal:2500,items:[
  {mesaLabel:'4 korokes',qty:1,mesaPrecio:2500,mesaDetalle:''}]}]});
const p=()=>({id:113,suc:'Uki Regimiento Arica',modalidad:'Consumo en local',
 estado:'Cancelado',pagado:false,motivoCancelacion:'local',canceladoEn:'2026-11-05T01:26:00Z',
 mesaReferencia:'Mesa 50',qrSolicitudes:['MESA-'+id.toUpperCase()],
 productos:[{nombre:'4 korokes',cantidad:1,precioUnit:2500,detalle:''}]});
function evaluator(){
 const state={
  S:{suc:'Uki Regimiento Arica'},
  ukiMesaNumeroReferencia:x=>Number(String(x).replace(/\D/g,''))||null,
  ukiMesaCode:x=>'MESA-'+String(x).toUpperCase(),
  ukiPedidoTieneQR:(x,code)=>(x.qrSolicitudes||[]).includes(code),
  ukiCuentaAbierta:x=>!x.pagado&&x.estado!=='Cancelado'
 };
 return vm.runInNewContext(code+'\n'+candidate+'\nukiMesaCuentaCanceladaCandidata',state,{timeout:1000});
}
test('Cuenta QR cancelada, nube respaldada y ninguna ronda pendiente puede liberarse sin cobro',()=>{
 const fn=evaluator(),cuenta=c(),pedido=p();
 assert.equal(fn(cuenta,{pedidos:[pedido]},'arica',[])?.id,113);
});
test('Mesa con nueva ronda por revisar nunca se libera',()=>{
 const fn=evaluator();
 assert.equal(fn(c(),{pedidos:[p()]},'arica',[{branch:'arica',mesa:50}]),null);
});
test('Un pedido pagado o no cancelado nunca libera una cuenta',()=>{
 const fn=evaluator();
 for(const cambios of [{pagado:true},{estado:'Pendiente'},{motivoCancelacion:''},{canceladoEn:null}]){
  assert.equal(fn(c(),{pedidos:[{...p(),...cambios}]},'arica',[]),null);
 }
});
test('No libera ronda con importe, producto o cantidad cambiados',()=>{
 const fn=evaluator();
 for(const cambios of [{nombre:'Gyozas'},{cantidad:2},{precioUnit:5000}]){
  const pedido=p();
  pedido.productos=[{...pedido.productos[0],...cambios}];
  assert.equal(fn(c(),{pedidos:[pedido]},'arica',[]),null);
 }
});
test('No libera una sucursal distinta ni la cuenta equivocada',()=>{
 const fn=evaluator();
 assert.equal(fn(c(),{pedidos:[p()]},'serena',[]),null);
 assert.equal(fn({...c(),rondas:2},{pedidos:[p()]},'arica',[]),null);
});
test('Otra cuenta local abierta impide cerrar la mesa cancelada',()=>{
 const fn=evaluator();
 assert.equal(fn(c(),{pedidos:[p(),{id:114,suc:'Uki Regimiento Arica',modalidad:'Consumo en local',
  mesaReferencia:'Mesa 50',estado:'Pendiente',pagado:false}]},'arica',[]),null);
});
test('Otra cuenta que usa una ronda QR existente bloquea liberación',()=>{
 const fn=evaluator();
 assert.equal(fn(c(),{pedidos:[p(),{...p(),id:114,estado:'Pendiente',pagado:false}]},'arica',[]),null);
});
test('La liberación requiere confirmación humana, nube sincronizada y doble consulta de Neon',()=>{
 const action=extraer('async function ukiMesaLiberarCuentaCancelada(','\nasync function ukiMesaActualizar(){');
 assert.match(action,/window\.ukiCancelacionNubeLista/);
 assert.match(action,/confirm\('¿Liberar la Mesa/);
 assert.match(action,/ukiMesaEstadoLocalGuardado\(\)/);
 assert.match(action,/const reciente=\(d\.cuentas\|\|\[\]\)/);
 assert.match(action,/if\(!x\.ok\|\|!result\.ok\|\|!result\.cerrada\)/);
 assert.match(action,/method:'PATCH'/);
 assert.doesNotMatch(action,/S\.pedidos\.push|p\.pagado=true|DELETE FROM/);
});
test('No permite rechazar QR en una cuenta o borrador existente',()=>{
 const action=extraer('async function ukiMesaEstado(id,estado,automatico=false){','\nlet ukiMesasConfirmando=false;');
 assert.match(action,/estado==='rechazado'/);
 assert.match(action,/const respaldo=await ukiMesaEstadoLocalGuardado\(\)/);
 assert.match(action,/enCuenta\|\|enBorrador\|\|enEdicion/);
 assert.match(action,/No la rechaces ni dupliques/);
});
test('El botón solo se ofrece ante cancelación respaldada, sin cobros',()=>{
 const view=extraer('function ukiMesasUI(){','\nasync function ukiMesaLiberarCuentaCancelada(');
 assert.match(view,/ukiMesaCuentaCanceladaCandidata\(c,S,branch,arr\)/);
 assert.match(view,/Liberar cuenta QR cancelada \(sin cobrar\)/);
});
