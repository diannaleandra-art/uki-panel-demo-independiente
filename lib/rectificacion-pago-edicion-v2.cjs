'use strict';
const {createHmac,timingSafeEqual,randomUUID}=require('node:crypto');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ID=/^[1-9][0-9]{0,11}$/;
const stores=['uki:arica','uki:serena','romo:serena'];
const fail=(code,text)=>Object.assign(Error(text),{code});
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const canonical=x=>{
 if(Array.isArray(x))return x.map(canonical);
 if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));
 return x;
};
function validar(p,detalleDistribucion){
 if(!p||!stores.includes(p.storeId)||!ID.test(p.pedidoInterno||'')||
    typeof p.id!=='string'||(p.id&&!UUID.test(p.id))||
    ![p.total,p.montoOtroLocal,p.propinaTransferencia,p.montoAnterior,p.montoRestante].every(money)||
    p.total<1||p.montoAnterior<=p.montoRestante||
    !Array.isArray(p.repartoAntes)||p.repartoAntes.length!==2||
    !Array.isArray(p.repartoDespues)||p.repartoDespues.length!==2)
  throw fail(400,'Revisa el pedido y los importes de la corrección.');
 const normal=r=>r.map(l=>detalleDistribucion(l,p.total,p.total-(Array.isArray(l)?l.reduce((n,x)=>n+Number(x?.monto),0):NaN),0));
 const a=normal(p.repartoAntes),b=normal(p.repartoDespues);
 if([...a,...b].some(x=>!x))throw fail(400,'El reparto no coincide con el pedido.');
 for(let i=0;i<2;i++){
  if(a[i].montoOtroLocal!==b[i].montoOtroLocal||a[i].montoTransferencia<b[i].montoTransferencia||
     a[i].pagos.some(x=>x.medio!=='transferencia'&&(b[i].pagos.find(y=>x.medio===y.medio)?.monto||0)<x.monto))
   throw fail(409,'Solo puedes corregir la parte registrada como transferencia.');
 }
 const anterior=detalleDistribucion(a.flatMap(x=>x.pagos),p.total,p.montoOtroLocal,p.propinaTransferencia);
 const posterior=detalleDistribucion(b.flatMap(x=>x.pagos),p.total,p.montoOtroLocal,p.propinaTransferencia);
 if(!anterior||!posterior||anterior.montoTransferencia!==p.montoAnterior||posterior.montoTransferencia!==p.montoRestante||
    !same(anterior.pagos,p.pagosAntes)||!same(posterior.pagos,p.pagos))
  throw fail(409,'La distribución de la rectificación no cuadra.');
 return {storeId:p.storeId,id:p.id,pedidoInterno:p.pedidoInterno,total:p.total,montoOtroLocal:p.montoOtroLocal,
  propinaTransferencia:p.propinaTransferencia,montoAnterior:p.montoAnterior,montoRestante:p.montoRestante,
  pagosAntes:anterior.pagos,pagos:posterior.pagos,
  repartoAntes:a.map(x=>x.pagos),repartoDespues:b.map(x=>x.pagos)};
}
function mac(secret,plan,receipt){
 if(typeof secret!=='string'||!/^([a-f0-9]{2}){32}$/i.test(secret))throw fail(503,'Autorización de rectificación no disponible.');
 return createHmac('sha256',Buffer.from(secret,'hex')).update('panel:rectificacion-pago:v2\n')
  .update(JSON.stringify(canonical([plan,receipt]))).digest('hex');
}
const isOriginal=(row,amount)=>row?.estado_pago==='confirmada'&&Number(row.monto_transferencia)===amount&&
 !!row.confirmada_en&&!!row.abono_verificado_en&&typeof row.confirmada_por==='string'&&
 row.confirmada_por.trim().length>=2&&!row.confirmada_por.startsWith('QA_SIMULACION:');
function estadoRectificado(datos,row,restante){
 const h=datos?.rectificacionTransferenciaV2;
 if(h?.recibo?.id&&restante===0&&h.montoRestante===0&&!h.confirmacionOriginal&&row?.estado_pago!=='confirmada')
  return 'pendiente';
 if(!h?.confirmacionOriginal||h.montoRestante!==restante||
    h.confirmacionOriginal.por!==row?.confirmada_por||!isOriginal(row,h.confirmacionOriginal.monto))return null;
 return restante===0?'pendiente':'confirmada';
}
function firmar(secret,plan,{responsable,motivo,actor}){
 if(actor?.role!=='duenos'||actor.storeId!==plan.storeId||typeof actor.userId!=='string'||!actor.userId||
    typeof responsable!=='string'||!responsable.trim()||responsable.length>80)
  throw fail(403,'La corrección requiere la cuenta Google de administración y un responsable.');
 if(typeof motivo!=='string'||motivo.trim().length<8||motivo.length>140)
  throw fail(400,'Escribe un motivo entre 8 y 140 caracteres.');
 const base={id:randomUUID(),en:new Date().toISOString(),responsable:responsable.trim(),motivo:motivo.trim(),por:actor.userId};
 return {...base,firma:mac(secret,plan,base)};
}
function verificar({secret,body,actor,detalleDistribucion}){
 const plan=validar(body.plan,detalleDistribucion),r=body.recibo;
 if(actor?.storeId!==plan.storeId||!r||!UUID.test(r.id||'')||! /^[a-f0-9]{64}$/.test(r.firma||'')||
    !Number.isFinite(Date.parse(r.en)))
  throw fail(403,'No se confirmó la autorización de esta corrección.');
 const {firma,...base}=r;
 if(!timingSafeEqual(Buffer.from(firma,'hex'),Buffer.from(mac(secret,plan,base),'hex')))
  throw fail(403,'La autorización no coincide con este pedido y cambio de pago.');
 return {ok:true,storeId:plan.storeId,confirmado:true};
}
async function registrar({db,meta,order,actor,secret,body,comprobarRevision,detalleDistribucion}){
 const plan=validar(body.plan,detalleDistribucion);
 if(body.sinAbonoRectificado!==true||body.abonoRestante!==plan.montoRestante)
  throw fail(400,'Confirma el importe que realmente entró al banco.');
 const recibo=firmar(secret,plan,{responsable:body.responsable,motivo:body.motivo,actor});
 await comprobarRevision();
 if(!plan.id)return {ok:true,storeId:plan.storeId,recibo};
 if(!order||order.orderId!==plan.id||order.storeId!==plan.storeId||order.estado!=='aceptada'||order.total!==plan.total)
  throw fail(409,'La solicitud original no coincide. No se modificó el pago.');
 let datos;try{datos=JSON.parse(order.snapshotDatos)}catch{throw fail(409,'Pago original no disponible.');}
 if(datos.seguimientoGuardado?.estado==='Cancelado')
  throw fail(409,'Este pedido está cancelado.');
 const scope="s.id=$1::uuid AND s.branch=$2 AND s.pedido_interno=$4::text AND s.estado='aceptada' AND s.total_indicado=$5::integer AND s.datos=$6::jsonb"+
  (meta.uki?" AND $3::text='uki:'||s.branch":" AND s.store_id=$3");
 const bank='t.solicitud_id=$1::uuid AND t.store_id=$3'+(meta.uki?' AND t.branch=$2':'');
 const args=[plan.id,meta.branch,plan.storeId,plan.pedidoInterno,plan.total,order.snapshotDatos];
 const rows=await db.query('SELECT t.estado_pago,t.monto_transferencia,t.confirmada_en,t.confirmada_por,t.abono_verificado_en FROM '+
  meta.source+' s LEFT JOIN '+meta.payment+' t ON '+bank+' WHERE '+scope+' LIMIT 2',args);
 if(rows.length!==1)throw fail(409,'El pedido cambió o no está vinculado a este registro.');
 const row=rows[0],prev=datos.rectificacionTransferenciaV2;
 if(prev?.recibo&&same(canonical(prev.plan),canonical(plan))){
  verificar({secret,body:{plan,recibo:prev.recibo},actor,detalleDistribucion});
  return {ok:true,storeId:plan.storeId,recibo:prev.recibo};
 }
 const antes=detalleDistribucion(datos.pagos||(!order.pagoSinDeterminar?[{medio:order.metodoPago,
  monto:plan.total-plan.montoOtroLocal}]:[]),plan.total,plan.montoOtroLocal,plan.propinaTransferencia);
 if(!antes||Number(datos.montoOtroLocalSeguimiento||0)!==plan.montoOtroLocal||
    Number(datos.propinaTransferenciaSeguimiento||0)!==plan.propinaTransferencia||
    order.montoTransferencia!==plan.montoAnterior||!same(antes.pagos,plan.pagosAntes))
  throw fail(409,'El reparto original en la carta no coincide con el de este pedido.');
 const original=prev?.confirmacionOriginal||datos.rectificacionTransferenciaDeliveryV1?.confirmacionOriginal||
  (isOriginal(row,plan.montoAnterior)?{en:row.confirmada_en,por:row.confirmada_por,monto:plan.montoAnterior}:null);
 if(row.estado_pago==='confirmada'&&(!original||!isOriginal(row,original.monto)||row.confirmada_por!==original.por))
  throw fail(409,'La verificación bancaria original cambió. No se modificó el pago.');
 if(plan.montoRestante>0&&!original)
  throw fail(409,'La parte que sigue en transferencia no estaba verificada. Revisa primero ese abono.');
 const patch={pagos:plan.pagos,medioPago:plan.pagos.length===1?plan.pagos[0].medio:'mixto',
  medioPagoConfirmadoTotal:plan.total,
  rectificacionTransferenciaV2:{plan,recibo,confirmacionOriginal:original,montoRestante:plan.montoRestante,
   anterior:prev?.recibo?.id||datos.rectificacionTransferenciaDeliveryV1?.id||null}};
 if(datos.seguimientoGuardado&&datos.seguimientoGuardado.total===plan.total&&
    datos.seguimientoGuardado.montoTransferencia===plan.montoAnterior)
  patch.seguimientoGuardado={...datos.seguimientoGuardado,montoTransferencia:plan.montoRestante};
 const fields=['estado_pago','monto_transferencia','confirmada_en','confirmada_por','abono_verificado_en'];
 const checks=fields.map((k,i)=>'t.'+k+'::text IS NOT DISTINCT FROM $'+(i+8)+'::text').join(' AND ');
 // Las fechas que devuelve el driver no reproducen necesariamente la forma SQL de timestamp.
 const changed=await db.query('UPDATE '+meta.source+' s SET datos=s.datos||$7::jsonb,actualizado_en=now() WHERE '+scope+
  (row.estado_pago?' AND EXISTS (SELECT 1 FROM '+meta.payment+' t WHERE '+bank+
   ' AND '+checks.replace('t.confirmada_en::text IS NOT DISTINCT FROM $10::text','t.confirmada_en IS NOT DISTINCT FROM $10::timestamptz')
   .replace('t.abono_verificado_en::text IS NOT DISTINCT FROM $12::text','t.abono_verificado_en IS NOT DISTINCT FROM $12::timestamptz')+')':
   ' AND NOT EXISTS (SELECT 1 FROM '+meta.payment+' t WHERE '+bank+')')+' RETURNING s.id',
  [...args,JSON.stringify(patch),...(row.estado_pago?fields.map(k=>row[k]??null):[])]);
 if(changed.length!==1)throw fail(409,'El pedido o la verificación cambiaron. Revisa y vuelve a guardar.');
 return {ok:true,storeId:plan.storeId,recibo};
}
module.exports={registrar,verificar,validar,estadoRectificado};
