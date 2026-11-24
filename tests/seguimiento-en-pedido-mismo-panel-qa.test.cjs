'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const index=fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/index.html'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs'),'utf8');
test('Uki y Romo muestran mensajes y transferencia dentro de su propia ficha',()=>{
 assert.match(index,/function ukiSeguimientoEnPedidoQA\(p\)/);
 assert.match(index,/💬 Mensajes y transferencia/);
 assert.match(index,/data-seguimiento-detalle hidden/);
 assert.match(index,/window\.ukiQAOpenOrderTracking/);
 assert.match(index,/cartaSolicitudRemotaId/);
 assert.match(index,/\$\{ukiSeguimientoEnPedidoQA\(p\)\}/);
 assert.match(index,/const seguimientoDirecto=ukiSeguimientoEnPedidoQA\(p\)/);
 assert.match(index,/seguimientoDirecto\+acciones/);
 assert.match(ui,/const card=inlineFor\(id\)/);
 assert.match(ui,/await loadDetail\(id,target\)/);
 assert.match(ui,/card\.scrollIntoView/);
 assert.match(ui,/dialog\.open=true/);
});
test('el acceso directo exige la misma sucursal y token de sesión actual',()=>{
 assert.match(ui,/if\(!root\|\|!dialog\|\|!detail\|\|!store\(\)\)return false/);
 assert.match(ui,/const store=\(\)=>NAMES\[window\.ukiQAGet/);
 assert.match(ui,/window\.ukiMesasTokenConfirmar/);
 assert.match(ui,/Authorization:'Bearer '\+token/);
 assert.match(ui,/if\(store\(\)!==storeId\)/);
 assert.match(ui,/activeStore===shop&&store\(\)===shop/);
 assert.doesNotMatch(ui,/signInWithPopup|requestOTP|loginSeparate/);
});
test('aviso no es abono; mensajes no borran el texto de respuesta',()=>{
 const start=ui.indexOf('function badgeText('),end=ui.indexOf('function paintBadges(',start);
 const badge=new Function(ui.slice(start,end)+'\nreturn badgeText;')();
 assert.match(badge({estadoPago:'avisada'}),/falta verificar/);
 assert.match(badge({estadoPago:'confirmada'}),/verificada/);
 assert.match(badge({pagoDeclarado:'transferencia'}),/pendiente/);
 assert.equal(badge(null),'');
 assert.match(ui,/target\.querySelector\('textarea'\)\?\.value/);
 assert.match(ui,/paintBadges\(data\.orders\|\|\[\],shop\)/);
 assert.match(ui,/\},15000\)/);
});
test('no muestra ficha para solicitud sin identificador, cancelada o de otro local',()=>{
 const start=index.indexOf('function ukiSeguimientoEnPedidoQA('),end=index.indexOf('function vPedidos(){',start);
 const id='621bd292-2153-4160-9e85-375978e10352';
 for(const suc of ['Uki Regimiento Arica','Uki La Serena','Romo’s Sushi La Serena']){
  const render=new Function('S',index.slice(start,end)+'\nreturn ukiSeguimientoEnPedidoQA;')({suc});
  assert.match(render({suc,cartaSolicitudRemotaId:id}),/data-seguimiento-detalle/);
  assert.equal(render({suc,cartaSolicitudRemotaId:'invalido'}),'');
  assert.equal(render({suc,cartaSolicitudRemotaId:id,estado:'Cancelado'}),'');
  assert.equal(render({suc:'otro local',cartaSolicitudRemotaId:id}),'');
 }
});
