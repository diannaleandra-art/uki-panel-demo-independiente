'use strict';
const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const {apply}=require('../lib/seguimiento-cambio-retiro-v1.cjs');
const html=fs.readFileSync('public/romo-panel-qa/index.html','utf8');
const chunk=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return html.slice(i,j)};
const id='12345678-1234-4234-8234-123456789abc',suc='Romo’s Sushi La Serena',storeId='romo:serena';
const mensaje='*ENTREGA*\nDelivery\nTotal productos: $21.700\nDelivery: $1.400\nTotal con delivery: $23.100';
const original={id:688,suc,pagado:false,estado:'Pendiente',modalidad:'Retiro',envio:0,subtotal:21700,total:21700,cartaSolicitudRemotaId:id,textoOriginal:mensaje};
const draft={editando:688,modalidad:'Retiro',envio:0,items:[{nombre:'Roll',cant:1,precio:21700}],medio:'Transferencia',cartaSolicitudRemotaId:id,responsableEdicion:'Prueba',pagado:true};
test('Romo sincroniza carta y cobra desde Retiro por cobrar en la misma edición',async()=>{
 const trace=[],S={suc,pedidos:[original]},d={...draft};
 const c={S,D:d,ROMO_SUCURSAL_QA:suc,esDelPeriodo:()=>true,ukiCierreConfirmadoPedido:()=>false,
  ukiMontoPropina:()=>0,ukiSeguimientoHayTransferenciaQA:()=>true,ukiRomoOperacionesEnCursoQA:()=>false,ukiPideRectificacionPago:()=>false,
  ukiRevisionBancoBorradorValidaQA:()=>true,aviso:m=>trace.push(m),ukiGuardarFormularioQA:async()=>trace.push('guardar'),
  window:{UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED:true,ukiRomoSesionRemotaQA:{disponible:()=>true},
   ukiQACambiarRetiroSinAbono:async (p,d,plan)=>{assert.equal(plan.delivery,1400);trace.push('sincronizar');return {pedidoInterno:'688'};}}};
 vm.createContext(c);
 vm.runInContext(chunk('function extraerMensajeCartaUki','function leerTextoD')+
  chunk('function ukiPlanRetiroSinAbonoQA','function ukiPideRectificacionPago')+
  chunk('let ukiRomoFormularioGuardandoQA','async function ukiGuardarFormularioQA'),c);
 await c.ndGuardar();assert.deepEqual(trace,['sincronizar','guardar']);assert.equal(d.cambioRetiroSinAbonoQA.pedidoInterno,'688');
});
test('Romo valida la cotización y el vínculo en la misma sucursal sin confirmar un abono',async()=>{
 const queries=[];
 const db={query:async(q,args)=>{queries.push({q,args});return q.startsWith('SELECT')?[{pedido_interno:'688',mensaje}]:[{id}];}};
 const order={orderId:id,storeId,estado:'aceptada',total:23100,modalidad:'delivery',snapshotDatos:JSON.stringify({origen:'carta-normal',subtotal:21700,reparto:1400})};
 const a={db,meta:{source:'public.solicitudes',payment:'public.pagos',branch:'serena'},order,
  actor:{storeId,role:'agendador',userId:'prueba-autorizada'},body:{id,pedidoInterno:'688',totalAnterior:23100,delivery:1400,totalValidado:21700},
  detail:{pagos:[{medio:'transferencia',monto:21700}],montoTransferencia:21700,montoOtroLocal:0,propinaTransferencia:0}};
 assert.equal((await apply(a)).cambioRetiro.totalNuevo,21700);
 assert.match(queries[0].q,/AND store_id=\$4/);assert.match(queries[1].q,/s\.store_id=\$13/);
 assert.match(queries[1].q,/NOT EXISTS.*public\.pagos/);assert.doesNotMatch(queries[1].q,/abono_verificado|estado_pago=/);
 await assert.rejects(apply({...a,order:{...order,snapshotDatos:JSON.stringify({origen:'carta-normal',subtotal:21700,reparto:500})}}),/cotización original/);
});
