import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {prepararEdicionPendienteRomoQA} from '../public/romo-panel-qa/uki-romo-edicion-pendiente-qa.mjs';
import * as rectificar from '../public/romo-panel-qa/rectificacion-pago-edicion-v2.mjs';
import {prepararCobroPendienteRomoQA} from '../public/romo-panel-qa/uki-romo-cobro-pendiente-qa.mjs';

const html=readFileSync(process.env.ROMO_HTML_FIXTURE||new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
const suc='Romo’s Sushi La Serena', uuid='00000000-0000-4000-8000-000000000001';
const at=Date.parse('2026-11-25T12:00:00-03:00'), dia='2026-11-25', turno=dia+'@'+(at-60000);
const take=(start,end)=>{
 const a=html.indexOf(start), b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Falta el código de '+start);
 return html.slice(a,b);
};
const beforeUkiOnly=take('let ukiRomoFormularioGuardandoQA=false;','  if(ukiGuardadoSolicitudEnCurso)return;')+'}';
const codigo=[
 take('function ukiTimbreYaEnviadoPedido','// Distancia solo informativa'),
 take('function editarPedido','function reanalizar'),
 take('function togglePagado','// Cancelación operativa'),
 take('function ukiSeguimientoHayTransferenciaQA','async function ukiMarcarPedidoEntregado'),
 take('const ukiRomoTimbreCobroQA=new Map();','function ukiRomoTimbreCobroDraftQA'),
 take('async function ukiSeguimientoValidarAntesDeCifrarRomoQA','async function ukiRomoConfirmarCobroQA'),
 take('async function ukiRomoEditarPedidoPendienteQA','async function ukiRomoGuardarPedidoPendienteQA')
  .replace(/await import\('\.\/uki-romo-edicion-pendiente-qa\.mjs\?[^']+'\)/,'__modEdit')
  .replace(/await import\('\.\/uki-romo-cobro-pendiente-qa\.mjs\?[^']+'\)/,'__modPay'),
 take('let ukiBaseRectificacionEdicion=null','function ukiCorreccionesTurnoUI('),
 take('function ukiSeguimientoConservarOrigenEdicionQA','let ukiRomoFormularioGuardandoQA=false;'),
 beforeUkiOnly
].join('\n').replaceAll("await import('./rectificacion-pago-edicion-v2.mjs?v=edicion-clara-v5')",'__rectificar');

function setup({method='Transferencia',hasPhone=true,linked=true,permitido=true,alreadySent=false,repartoIncompleto=false}={}){
 const phone=hasPhone?'+56900000001':'';
 const p={id:2,suc,numeroTurno:1,turnoClave:turno,codigoCarta:linked?'R2':'',cliente:'Cliente simulado',
  telefono:phone,modalidad:'Retiro',estado:'Pendiente',pagado:false,medio:method,medioEnvio:'Efectivo',
  subtotal:10000,total:10000,envio:0,productos:[{nombre:'Clásico',cantidad:1,precioUnit:10000}],
  ...(linked?{cartaSolicitudRemotaId:uuid}:{}),...(alreadySent?{timbreEnviadoEn:'2026-11-25T14:00:00Z'}:{})};
 if(repartoIncompleto)Object.assign(p,{modalidad:'Delivery',total:12500,envio:2500,medio:'Edenred',
  medioEnvio:'Edenred',pagosEnvio:[{medio:'Edenred',monto:0},{medio:'Transferencia',monto:0}]});
 let revision=5,saves=0,opens=0,confirmBank=0,bankAllowed=permitido,rectificaciones=0,comprobaciones=0;
 const etapas=[];
 const queries=[],messages=[];
 const session={disponible:()=>true,estado:()=>({revision,conflicto:false}),guardar:async (copy)=>{
  assert.equal(copy.pedidos.length,1);
  assert.equal(copy.pedidos[0].id,2);
  assert.equal(copy.nextId,3);
  saves++; etapas.push({pagado:copy.pedidos[0].pagado,medio:copy.pedidos[0].medioEnvio});
  return {changed:true,revision:++revision};
 }};
 const context={
  ROMO_SUCURSAL_QA:suc,S:{suc,vista:'pedidos',nextId:3,pedidos:[p],propinas:[],clientes:{},cierres:[],
   cajasDiarias:{[suc+'|'+dia]:{turnoId:turno,turnoAbierto:true,baseConfirmada:true}}},
  D:{},modoNuevo:'manual',ukiRomoGuardandoManualQA:false,
  __rectificar:rectificar,
  document:{getElementById:()=>null},
  __modEdit:{prepararEdicionPendienteRomoQA},__modPay:{prepararCobroPendienteRomoQA},
  window:{ukiRomoSesionRemotaQA:session,ukiRomoGuardadoHabilitadoQA:()=>true,
   UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED:true,
   ukiAutorizarRectificacionPagoV2:async ({plan,sinAbonoRectificado,abonoRestante})=>{
    assert.equal(plan.montoAnterior,2500);assert.equal(plan.pedidoInterno,'2');
    assert.deepEqual(JSON.parse(JSON.stringify(plan.sinDetalleAnterior)),[1]);
    assert.equal(sinAbonoRectificado,true);assert.equal(abonoRestante,0);
    rectificaciones++;
    return {recibo:{id:'recibo-1',firma:'prueba',motivo:'Delivery en efectivo',en:new Date(at).toISOString()}};
   },
   ukiVerificarRectificacionPagoV2:async ({plan,recibo})=>{
    assert.equal(rectificaciones,1);assert.equal(plan.montoRestante,0);assert.equal(recibo.id,'recibo-1');
    comprobaciones++;
   },
   open:()=>opens++,
   confirm:()=>{throw Error('No debe pedir una confirmación duplicada');},
   ukiMesasTokenConfirmar:async ()=>'token-simulado-para-prueba-sin-red',
   ukiQAConfirmTransferBeforePayment:async ({id,monto,revisionBancoMarcada})=>{
    assert.equal(id,uuid);assert.equal(monto,10000);assert.equal(revisionBancoMarcada,true);
    confirmBank++;bankAllowed=true;return 'confirmada';
   }},
  location:{hostname:'romos-sushi-panel.vercel.app'},Date:class extends Date{
   constructor(...args){super(...(args.length?args:[at]));} static now(){return at;}
  },URLSearchParams,AbortSignal,
  fetch:async (url)=>{
   const query=new URL(url,'https://test.example').searchParams;
   assert.equal(query.get('storeId'),'romo:serena');assert.equal(query.get('id'),uuid);
   queries.push(query.get('requiereTransferencia'));
   return {ok:true,json:async ()=>({ok:true,storeId:'romo:serena',orderId:uuid,permitido:bankAllowed,total:repartoIncompleto?12500:10000,
    montoTransferencia:method==='Transferencia'?10000:0})};
  },
  validarEstadoSucursal:()=>true,ukiRomoOperacionesEnCursoQA:()=>false,
  ukiCierreConfirmadoPedido:()=>false,ukiRomoFechaOperativaActualSeguraQA:()=>true,
  ukiTurnoFolioActual:()=>({clave:turno}),ukiDatosCatalogoItem:()=>({}),getCliente:()=>null,
  ukiCodigoWhatsApp:()=>'',ukiTimbreResponsableActual:()=>'Agendadora simulada',
  ukiTelefonoNormalizado:x=>String(x||'').replace(/\D/g,''),ukiNumeroTimbreWhatsApp:x=>String(x||'').replace(/\D/g,''),
  esc:String,fmt:String,ukiFotoCorreccionPedido:p=>({cliente:p.cliente,telefono:p.telefono,productos:p.productos,total:p.total,medio:p.medio}),
  ukiDatosPago:()=>({}),ukiMontoPropina:()=>0,ukiMontoEnvioOtroLocal:()=>0,ukiMontoProductosOtroLocal:()=>0,
  ukiLineasPago:(p,t,total)=>total>0?(t==='envio'&&p.pagosEnvio?.length?p.pagosEnvio:[{monto:total,medio:t==='productos'?p.medio:p.medioEnvio}]):[],
  ahora:()=>new Date(at).toISOString(),render:()=>{},aviso:t=>messages.push(t)
 };
 runInNewContext(codigo+'\nfunction ir(v){S.vista=v;} function nuevoDraft(){D={};} function datosSoloSucursal(){return JSON.parse(JSON.stringify(S));}',context);
 const invoke=(code)=>runInNewContext(code,context);
 return {invoke,context,queries,messages,etapas,rectificacion:()=>({rectificaciones,comprobaciones}),counts:()=>({saves,opens,confirmBank})};
}

test('Romo: Marcar pagado → revisión bancaria y timbre → Guardar conserva el pedido de carta',async()=>{
 const f=setup({permitido:false});
 f.invoke('togglePagado(2); D.responsableEdicion="Agendadora simulada"; ukiRevisionBancoMarcarBorradorQA({checked:true}); ukiAbrirTimbreBorrador(); ukiConfirmarTimbreBorrador(true)');
 assert.equal(f.invoke('ukiRevisionBancoBorradorValidaQA(D,S.pedidos[0])'),true);
 await f.invoke('ndGuardar()');
 assert.deepEqual(f.counts(),{saves:1,opens:1,confirmBank:1},f.messages.join(' | '));
 assert.deepEqual(f.queries,['1','1','1']);
 assert.equal(f.context.S.pedidos[0].cartaSolicitudRemotaId,uuid);
 assert.equal(f.context.S.pedidos[0].pagado,true);
 assert.ok(f.context.S.pedidos[0].timbreEnviadoEn);
 assert.equal(f.context.S.pedidos[0].transferenciaManualQA.firma.solicitudId,uuid);
 assert.throws(()=>prepararCobroPendienteRomoQA(f.context.S,{
  pedidoId:2,responsable:'Agendadora simulada',registradoEn:at,confirmoRecepcion:true
 }),/ya pagado/);
});
test('Romo: sin revisión bancaria no consulta ni registra el pago',async()=>{
 const f=setup({hasPhone:false});
 f.invoke('togglePagado(2); D.responsableEdicion="Agendadora simulada"');
 await f.invoke('ndGuardar()');
 assert.deepEqual(f.counts(),{saves:0,opens:0,confirmBank:0});
 assert.match(f.messages.at(-1),/revisión bancaria obligatoria/);
});
test('Romo: al reabrir el mismo pedido no pide otro envío, pero otro WhatsApp no hereda la confirmación',async()=>{
 const f=setup({method:'Efectivo',linked:false});
 f.invoke('togglePagado(2); ukiAbrirTimbreBorrador(); ukiConfirmarTimbreBorrador(true); nuevoDraft(); ir("pedidos"); togglePagado(2)');
 assert.equal(f.invoke('ukiTimbreBorradorConfirmado(D)'),true);
 assert.match(f.invoke('ukiPasoTimbreAntesDeGuardar(S.pedidos[0])'),/Timbre enviado · NO reenviar/);
 f.invoke('D.telefono="+56900000002"');
 assert.equal(f.invoke('ukiTimbreBorradorConfirmado(D)'),false);
 f.invoke('D.telefono="+56900000001"; D.responsableEdicion="Agendadora simulada"');
 await f.invoke('ndGuardar()');
 assert.deepEqual(f.counts(),{saves:1,opens:1,confirmBank:0},f.messages.join(' | '));
 assert.ok(f.context.S.pedidos[0].timbreEnviadoEn);
});
test('Romo: un timbre ya guardado no abre WhatsApp ni suma otro envío',async()=>{
 const f=setup({method:'Efectivo',alreadySent:true});
 f.invoke('togglePagado(2); D.responsableEdicion="Agendadora simulada"; ukiAbrirTimbreBorrador()');
 await f.invoke('ndGuardar()');
 assert.deepEqual(f.counts(),{saves:1,opens:0,confirmBank:0},f.messages.join(' | '));
 assert.equal(f.context.S.pedidos[0].timbreEnviadoEn,'2026-11-25T14:00:00Z');
});


test('Romo: corrige transferencia y confirma el pago de carta con un clic y sin reenviar el timbre',async()=>{
 for(const alreadySent of [false,true]){
  const f=setup({method:'Efectivo',repartoIncompleto:true,alreadySent});
  f.invoke('togglePagado(2); D.responsableEdicion="Agendadora simulada"; D.medioEnvio="Efectivo"; D.mixtoEnvio=false; D.pagosEnvio=[]; D.rectificacionConfirmada=true; D.rectificacionFirmaReparto=ukiFirmaRepartoRectificacion(D);');
  f.invoke('ukiAbrirTimbreBorrador(); if(!ukiTimbreYaEnviadoPedido(S.pedidos[0]))ukiConfirmarTimbreBorrador(true);');
  await f.invoke('ndGuardar()');
  assert.deepEqual(f.etapas,[{pagado:false,medio:'Efectivo'},{pagado:true,medio:'Efectivo'}],f.messages.join(' | '));
  assert.equal(f.counts().opens,alreadySent?0:1);
  assert.deepEqual(f.rectificacion(),{rectificaciones:1,comprobaciones:1});
  assert.equal(f.context.S.pedidos.length,1);
  assert.equal(f.context.S.pedidos[0].total,12500);
  assert.ok(f.context.S.pedidos[0].timbreEnviadoEn);
  const envios=(f.context.S.pedidos[0].timbreEventos||[]).filter(x=>x.tipo==='declarado_enviado');
  assert.equal(envios.length,alreadySent?0:1);
 }
});
