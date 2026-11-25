'use strict';
/* Bandeja de seguimiento por local, separada de caja y cobro comercial. */
const ENV=require('../lib/seguimiento-qa-entorno-v1.cjs');
const AUTH=require('../lib/seguimiento-qa-personal-auth-v1.cjs');
const S=require('../lib/seguimiento-qa-servidor-v1.cjs');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=(r,c,m)=>r.status(c).json({ok:false,error:m});
// Exclusivamente los tres pedidos ficticios existentes en las bases QA aisladas.
const REVISION_CODES=Object.freeze({'uki:arica':'QA-REV-ARICA','uki:serena':'QA-REV-SERENA','romo:serena':'QA-REV-ROMO'});
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=ENV.config();
 if(!cfg||(!cfg.live&&process.env.SEGUIMIENTO_PERSONAL_QA_ENABLED!=='true'))
  return fail(res,503,'Bandeja de seguimiento en preparación');
 if(!ENV.validOrigin(req,cfg))return fail(res,403,'Origen no autorizado');
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Acción no autorizada');
 if(req.method==='POST'&&(!String(req.headers['content-type']||'').startsWith('application/json')||
  !req.body||typeof req.body!=='object'||Array.isArray(req.body)||
  JSON.stringify(req.body).length>1500))return fail(res,400,'Formulario inválido');
 const revision=req.query?.revision==='1';
 if(revision&&cfg.live)return fail(res,403,'Revisión aislada no disponible en producción');
 const storeId=String(req.method==='GET'?req.query?.storeId:req.body?.storeId||'');
 if(!S.TABLES[storeId])return fail(res,400,'Sucursal inválida');
 try{
  const db=ENV.makeDb(cfg,storeId);
  let actor=await AUTH.authorized(req,db,storeId).catch(()=>null);
  if(!actor&&revision&&!cfg.live)actor=await AUTH.authorizedRevisionOwner(req,storeId).catch(()=>null);
  if(!actor)return fail(res,403,'Sesión sin permiso para esta sucursal');
  if(actor.revisionOnly===true&&(!revision||cfg.live||!REVISION_CODES[storeId]||
     (req.method==='POST'&&!['simular_transferencia','responder_mensaje'].includes(req.body.action))))
   return fail(res,403,'Permiso limitado a la revisión ficticia de esta sucursal');
  const meta=S.TABLES[storeId];
  const ficticio=" AND s.codigo_pedido ~* '^(QA|PRUEBA|TEST|DEMO)[-_ ]' AND s.cliente ~* '^(QA|PRUEBA|TEST|DEMO|CLIENTE (QA|PRUEBA|TEST|DEMO))'"+
   (actor.revisionOnly===true?" AND s.codigo_pedido='"+REVISION_CODES[storeId]+"'":"");
  if(req.method==='GET'&&!req.query?.id){
   const OP=require('../lib/seguimiento-operacion-unificada-qa.cjs');
   const list=await db.query(
    'SELECT s.id,s.branch,s.codigo_pedido,s.cliente,s.estado,s.total_indicado,s.datos,s.creado_en,'+
    (meta.uki?'NULL::text AS store_id,':'s.store_id,')+
    'p.estado_pago,p.monto_transferencia,p.cliente_aviso_en,'+
    '(SELECT max(m.creado_en) FROM '+meta.messages+
    ' m WHERE m.solicitud_id=s.id AND m.store_id=$1'+(meta.uki?' AND m.branch=$2':'')+
    ') AS ultima_consulta FROM '+meta.source+' s LEFT JOIN '+meta.payment+
    ' p ON p.solicitud_id=s.id AND p.store_id=$1'+(meta.uki?' AND p.branch=$2':'')+
    ' WHERE s.branch=$2'+(meta.uki?'':' AND s.store_id=$1')+
    " AND s.estado IN ('pendiente','aceptada') AND s.creado_en>now()-interval '7 days'"+
    (revision?ficticio:'')+' ORDER BY s.creado_en DESC LIMIT 80',[storeId,meta.branch]);
   const orders=list.map(r=>{
    const plan=OP.normalizeOrder(storeId,r);
    return plan?{
     id:r.id,codigoPedido:plan.codigo,cliente:String(r.cliente||'').slice(0,80),
     estadoPedido:plan.estado,metodoPago:plan.metodoPago,pagoDeclarado:plan.pagoDeclarado,
     montoTransferencia:plan.montoTransferencia,
     estadoPago:!r.estado_pago?'pendiente':r.monto_transferencia===plan.montoTransferencia?r.estado_pago:'requiere_revision',
     clienteAvisoEn:r.cliente_aviso_en||null,ultimaConsulta:r.ultima_consulta||null
    }:null;
   }).filter(Boolean);
   return res.status(200).json({ok:true,storeId,orders,...(revision?{revisionAislada:true}:{})});
  }
  const id=String(req.method==='GET'?req.query?.id:req.body?.id||'');
  if(!UUID.test(id))return fail(res,400,'Pedido inválido');
  if(revision){
   const rows=await db.query('SELECT s.id FROM '+meta.source+
    ' s WHERE s.id=$1::uuid AND s.branch=$2'+(meta.uki?'':' AND s.store_id=$3')+
    ficticio+' LIMIT 1',meta.uki?[id,meta.branch]:[id,meta.branch,storeId]);
   if(rows.length!==1)return fail(res,404,'Sólo pedidos ficticios en revisión');
  }
  const order=await S.loadOne(db,storeId,id);
  if(!order||!['pendiente','aceptada'].includes(order.estado))return fail(res,404,'Pedido no disponible en esta sucursal');
  const simulacion=revision&&!cfg.live&&!!cfg.revisionOrigin&&
   String(req.headers.host||'').toLowerCase()===new URL(cfg.revisionOrigin).hostname&&
   order.codigo===REVISION_CODES[storeId];
  if(req.method==='POST'&&order.estado!=='aceptada')
   return fail(res,409,'La solicitud sigue pendiente: primero acepta el pedido y valida su importe');
  if(req.method==='POST'){
   const action=req.body.action;
   if(action==='generar_enlace'){
    if(Object.keys(req.body).sort().join('|')!=='action|id|storeId')
     return fail(res,400,'Datos de enlace no válidos');
    const created=await S.issueAccepted({db,storeId,orderId:id,staff:actor,secret:cfg.tokenSecret});
    // No reenviar por WhatsApp automáticamente: el personal decide compartir.
    return res.status(200).json({ok:true,storeId,
     enlace:cfg.origin+'/seguimiento-pedido-qa.html#t='+encodeURIComponent(created.token),
     venceEn:new Date(created.expiresAtSeconds*1000).toISOString()});
   }
   if(action==='confirmar_medio_de_pago'){
    // QA únicamente: el medio queda validado por el agendador, no pagado.
    // La implementación comercial debe integrarse en su guardado habitual.
    if(Object.keys(req.body).sort().join('|')!=='action|id|metodo|storeId|totalValidado')
     return fail(res,400,'Revisa la forma de pago');
    const PAY=require('../lib/seguimiento-confirmar-medio-pago-qa.cjs');
    const result=await PAY.confirmPreferred({
     db,storeId,orderId:id,staff:actor,metodo:req.body.metodo,
     totalValidado:req.body.totalValidado
    });
    return res.status(200).json(result);
   }
   if(action==='confirmar_distribucion_pago'){
    if(!['action|id|pagos|storeId|totalValidado','action|id|montoOtroLocal|pagos|propinaTransferencia|storeId|totalValidado'].includes(Object.keys(req.body).sort().join('|')))
     return fail(res,400,'Distribución inválida');
    const PAY=require('../lib/seguimiento-confirmar-medio-pago-qa.cjs');
    const result=await PAY.confirmDistribution({db,storeId,orderId:id,staff:actor,
     pagos:req.body.pagos,totalValidado:req.body.totalValidado,
     montoOtroLocal:req.body.montoOtroLocal??0,propinaTransferencia:req.body.propinaTransferencia??0});
    return res.status(200).json(result);
   }
   if(action==='simular_transferencia'){
    if(!simulacion)return fail(res,403,'Simulación sólo disponible para el pedido ficticio de revisión');
    if(Object.keys(req.body).sort().join('|')!=='action|confirmoSimulacion|id|montoRecibido|storeId'||
       req.body.confirmoSimulacion!==true||!Number.isSafeInteger(req.body.montoRecibido)||
       req.body.montoRecibido!==order.montoTransferencia||order.montoTransferencia<=0)
     return fail(res,400,'Revisa el importe ficticio');
    // Reutiliza la validación y persistencia reales del módulo, únicamente en QA.
    // Identifica el registro en auditoría como SIMULADO; no consulta una cuenta real.
    const result=await S.staffConfirm({db,order,staff:{...actor,userId:'QA_SIMULACION:'+actor.userId},
     bank:{storeId,verified:true},receivedAmount:req.body.montoRecibido,seenBankCredit:true});
    return res.status(200).json({ok:true,storeId,estadoPago:result.status,simulado:true,
     nota:'Simulación aislada, sin abono bancario ni movimiento de caja'});
   }
   if(action==='confirmar_transferencia'){
    if(revision)return fail(res,409,'En revisión aislada utiliza exclusivamente la simulación de transferencia');
    if(Object.keys(req.body).sort().join('|')!=='action|id|montoRecibido|storeId|verificadoEnBanco')
     return fail(res,400,'Datos bancarios incompletos');
    const result=await S.staffConfirm({db,order,staff:actor,bank:cfg.banks[storeId],
     receivedAmount:req.body.montoRecibido,seenBankCredit:req.body.verificadoEnBanco===true});
    return res.status(200).json({ok:true,storeId,estadoPago:result.status,
     nota:'Verificación manual registrada. Sin modificar caja ni venta'});
   }
   if(action==='publicar_estado_guardado'){
    if(revision||actor.revisionOnly===true||process.env.SEGUIMIENTO_ESTADO_GUARDADO_ENABLED!=='true')
     return fail(res,503,'Actualización de estado guardado no habilitada');
    if(Object.keys(req.body).sort().join('|')!=='action|estado|id|montoTransferencia|pagado|revision|storeId|total')
     return fail(res,400,'Estado guardado incompleto');
    const result=await S.publishSavedPayment({db,order,staff:actor,revision:req.body.revision,
     total:req.body.total,montoTransferencia:req.body.montoTransferencia,estado:req.body.estado,pagado:req.body.pagado});
    return res.status(200).json(result);
   }
   if(action==='responder_mensaje'){
    if(Object.keys(req.body).sort().join('|')!=='action|id|storeId|texto')
     return fail(res,400,'Mensaje inválido');
    await S.sendMessage({db,order,from:'agendador',body:req.body.texto,staff:actor,chatSecret:cfg.chatSecret});
    return res.status(200).json({ok:true,storeId,enviado:true});
   }
   return fail(res,400,'Acción no autorizada');
  }
  const details=await S.snapshot({db,order,bank:cfg.banks[storeId],chatSecret:cfg.chatSecret});
  return res.status(200).json({ok:true,storeId,orderId:id,totalPedido:order.total,pedido:details,
   ...(revision?{revisionAislada:true,puedeSimular:simulacion&&order.estado==='aceptada'&&
    ['pendiente','avisada'].includes(details.estadoPago)&&details.montoTransferencia>0}:{}),
   puedeConfirmar:!revision&&order.estado==='aceptada'&&details.estadoPago!=='requiere_revision'&&
    details.montoTransferencia>0&&!!cfg.banks[storeId]});
 }catch(error){
  const c=[400,403,404,409,429].includes(error?.code)?error.code:503;
  return fail(res,c,c===503?'No se pudo guardar o leer. Revisa el pedido antes de reintentar.':
   String(error?.message||'No disponible').slice(0,200));
 }
};
