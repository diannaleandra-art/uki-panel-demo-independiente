import {comprobarCambio} from './rectificacion-pago-edicion-v2.mjs?v=2';
import {comprobarRectificacionLocal,coincideConstancia} from './uki-rectificar-transferencia-v1.mjs';
/* Control del guardado habitual, no una segunda caja.
 * Firebase y Neon son servicios distintos: esta comprobación en el cliente
 * NO es una transacción distribuida ni protege contra un cliente modificado.
 * No activar hasta completar validación y reglas del servidor.
 */
const STORES=Object.freeze({'Uki Regimiento Arica':'uki:arica','Uki La Serena':'uki:serena'});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/i;
const idOf=p=>String(p?.id??'');
const refOf=p=>String(p?.cartaSolicitudRemotaId||p?.seguimientoSolicitudId||'');
const fields=['medio','medioEnvio','pagosProductos','pagosEnvio','mixtoProductos','mixtoEnvio',
 'productosPagadosOtroLocal','envioPagadoOtroLocal','montoProductosOtroLocal','montoEnvioOtroLocal',
 'subtotal','envio','total','modalidad','propina','propinaModo','medioPropina','cliente','telefono'];
const firma=p=>JSON.stringify(fields.map(k=>p?.[k]??null));
const fail=message=>{throw Object.assign(Error(message),{code:'TRANSFERENCIA_PENDIENTE'});};
function index(estado,suc){
 if(!estado||estado.suc!==suc||!Array.isArray(estado.pedidos))fail('No se pudo comprobar la copia de esta sucursal');
 const map=new Map(),refs=new Set();
 for(const p of estado.pedidos){
  const key=idOf(p),ref=refOf(p);
  if(!p||p.suc!==suc||! /^[1-9][0-9]{0,11}$/.test(key)||map.has(key))fail('Pedido duplicado o de otra sucursal');
  if(ref&&refs.has(ref))fail('La misma solicitud tiene dos pedidos');
  if(ref)refs.add(ref);
  map.set(key,p);
 }
 return map;
}
export async function verificarGuardadoUki({anterior,nuevo,sucursal,importes,hayTransferencia,manualValido,consultar,leerLineasPago,verificarRectificacion}={}){
 const storeId=STORES[sucursal];
 if(!storeId||[importes,hayTransferencia,manualValido,consultar].some(x=>typeof x!=='function'))
  fail('Faltan controles de pago para esta sucursal');
 const old=index(anterior,sucursal),next=index(nuevo,sucursal);
 let checked=0;
 for(const [pedidoInterno,p] of next){
  const prev=old.get(pedidoInterno),ref=refOf(p),oldRef=refOf(prev);
  if(prev&&oldRef!==ref&&(oldRef||prev.pagado===true||prev.estado==='Entregado'))
   fail('No se puede cambiar la identidad de un pedido registrado');
  if(prev?.esPremio!==true&&p.esPremio===true&&prev)fail('Un pedido existente no se convierte en premio');
  if(p.esPremio===true)continue;
  const oldTransfer=!!prev&&hayTransferencia(prev),transfer=hayTransferencia(p);
  const cambioRectificado=JSON.stringify(prev?.rectificacionesTransferenciaV2??[])!==
   JSON.stringify(p.rectificacionesTransferenciaV2??[]);
  if(cambioRectificado){
   const prueba=comprobarCambio(prev,p,leerLineasPago);
   if(!prueba||await verificarRectificacion?.(prueba)!==true)
    fail('No se confirmó la corrección autorizada de este pago');
   checked++;continue;
  }
  const anteriorMonto=oldTransfer?importes(prev)?.montoTransferencia:null;
  const nuevoMonto=transfer?importes(p)?.montoTransferencia:null;
  if(oldTransfer&&transfer&&Number.isSafeInteger(anteriorMonto)&&Number.isSafeInteger(nuevoMonto)&&nuevoMonto<anteriorMonto)
   fail('Reducir una transferencia registrada requiere una corrección autorizada');
  if(oldTransfer&&!transfer){
   const plan=comprobarRectificacionLocal(prev,p);
   if(!plan)fail('La transferencia requiere una corrección autorizada');
   const proof=await consultar({storeId,id:ref,pedidoInterno,requiereTransferencia:false});
   if(!coincideConstancia(plan,proof))fail('No se confirmó la rectificación autorizada para este pedido');
   checked++;continue;
  }
  if(JSON.stringify(prev?.rectificacionTransferenciaDeliveryV1??null)!==
     JSON.stringify(p.rectificacionTransferenciaDeliveryV1??null))
   fail('No se puede modificar el historial de una rectificación');
  // No impedir una cancelación normal sin cobro ni una copia histórica sin cambios.
  if(p.estado==='Cancelado'&&p.pagado!==true)continue;
  const pagar=p.pagado===true&&prev?.pagado!==true;
  const entregar=p.estado==='Entregado'&&prev?.estado!=='Entregado';
  const reclasificar=p.pagado===true&&!!prev&&firma(prev)!==firma(p);
  if(!pagar&&!entregar&&!reclasificar)continue;
  if(!ref&&!transfer)continue;
  const monto=importes(p);
  if(!monto||!Number.isSafeInteger(monto.total)||monto.total<1||
     !Number.isSafeInteger(monto.montoTransferencia)||monto.montoTransferencia<0||
     transfer!== (monto.montoTransferencia>0))
   fail('Los importes no coinciden con el pedido');
  if(transfer&&p.pagado!==true)fail('Confirma el abono antes de finalizar el pedido');
  if(!ref){
   if(transfer&&manualValido(p,monto,'')!==true)fail('Falta la confirmación manual de la transferencia');
   checked++;continue;
  }
  if(!UUID.test(ref))fail('Solicitud de carta sin identificación válida');
  const r=await consultar({storeId,id:ref,pedidoInterno,requiereTransferencia:transfer});
  if(!r||r.ok!==true||r.storeId!==storeId||r.orderId!==ref||r.pedidoInterno!==pedidoInterno)
   fail('No se pudo verificar el pedido original en el servidor');
  if(r.sinEnlaceAnterior===true){
   if(transfer?(r.requiereConfirmacionManual!==true||manualValido(p,monto,ref)!==true):r.permitido!==true)
    fail('Pedido anterior: falta verificar el pago');
  }else if(r.permitido!==true||r.total!==monto.total||r.montoTransferencia!==monto.montoTransferencia)
   fail('Transferencia pendiente o importe modificado. No se confirmó el guardado.');
  checked++;
 }
 return {ok:true,checked};
}
