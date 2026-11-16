/**
 * Romo La Serena: reutilizar el formulario de PROPINA MANUAL oficial Uki.
 * Recibe una COPIA de estado; sin escritura directa. Solo el CAS Neon
 * del panel confirma un registro REAL y único, aparte de ventas/delivery.
 */
const SUC='Romo’s Sushi La Serena';
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const n=x=>String(x??'').trim();
export function prepararPropinaManualRomoQA(estado,{
 referencia,monto,concepto,medio,responsable,registradoEn,
 confirmarRecibida=false
}={}){
 assert(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&
   Array.isArray(estado.propinas)&&Array.isArray(estado.cierres)&&
   estado.cajasDiarias&&typeof estado.cajasDiarias==='object',
   'No existe un estado de caja Romo independiente');
 assert(estado.pedidos.every(p=>p?.suc===SUC)&&
   estado.propinas.every(p=>p?.suc===SUC),
   'Se detectaron datos de otra sucursal');
 assert(confirmarRecibida===true,'No confirmaste haber recibido realmente la propina');
 assert(Number.isSafeInteger(monto)&&monto>=1&&monto<=10000000,
   'Monto de propina inválido');
 assert(MEDIOS.includes(medio),'El medio de la propina no está permitido');
 assert(n(concepto).length>=3&&n(concepto).length<=150,'Escribe el concepto de la propina');
 assert(n(responsable).length>=2&&n(responsable).length<=80,
   'Identifica quién recibió el dinero');
 assert(Number.isSafeInteger(registradoEn)&&registradoEn>0&&
   Number.isFinite(new Date(registradoEn).getTime()),
   'Hora de recepción inválida');
 const text=n(referencia);
 assert(text.length>0&&text.length<=80,'Indica el número del pedido');
 const prefCarta=/^carta\b/i.test(text);
 const prefInterno=/^(?:interno|pedido\s+interno)\b/i.test(text);
 const ref=text.replace(/^(?:carta|pedido\s+interno|interno)\s*#?\s*/i,'')
   .replace(/^#/,'').trim();
 assert(ref&&ref.length<=60,'Escribe el folio de carta o pedido interno');
 const pedidos=estado.pedidos.filter(p=>
   prefCarta?String(p.codigoCarta||'')===ref:
   prefInterno?String(p.id)===ref:
   String(p.id)===ref||String(p.codigoCarta||'')===ref);
 assert(pedidos.length===1,
   pedidos.length?'El número es ambiguo: especifica Carta o Interno':
   'El pedido no existe en Romo La Serena');
 const p=pedidos[0],turno=String(p.turnoClave||'');
 assert(p.pagado===true&&p.estado!=='Cancelado'&&!p.esPremio,
   'Solo un pedido pagado y vigente admite propina manual');
 assert(!p.ajusteCobroPendiente&&
   !(Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length),
   'Revisa los ajustes o las mesas QR antes de registrar otra propina');
 assert(!Number(p.propina||0)&&
   !estado.propinas.some(x=>Number(x.pedidoId)===Number(p.id)),
   'Este pedido ya tiene propina; no registres otra');
 const caja=estado.cajasDiarias[SUC+'|'+turno.slice(0,10)];
 assert(caja?.turnoAbierto===true&&caja.baseConfirmada===true&&
   caja.turnoId===turno&&Number.isSafeInteger(caja.inicioMs)&&
   registradoEn>=caja.inicioMs,
   'El turno del pedido no está abierto o su base no fue confirmada');
 assert(!estado.cierres.some(c=>c?.suc===SUC&&c.turnoClave===turno),
   'El pedido pertenece a un cierre definitivo');
 const oldLength=estado.propinas.length;
 let id=registradoEn;
 while(estado.propinas.some(x=>x.id===id))id++;
 const fila={
  suc:SUC,id,fechaISO:new Date(registradoEn).toISOString(),
  registradoEn,monto,medio,pedidoId:p.id,
  codigoCarta:p.codigoCarta||'',concepto:n(concepto),
  origen:'manual',responsable:n(responsable)
 };
 estado.propinas.push(fila);
 assert(estado.propinas.length===oldLength+1,'No se pudo agregar la propina');
 // No modificar pedido, venta, medios del pedido, fidelidad ni cierre.
 return Object.freeze({pedidoId:p.id,codigoCarta:fila.codigoCarta,monto,
  medio,concepto:fila.concepto,registroId:id,
  propinaUnica:true,noEsVenta:true});
}
