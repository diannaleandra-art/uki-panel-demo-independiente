/* Corrección de la marca Pagado en la caja Romo. No llama bancos ni pasarelas. */
const SUC='Romo’s Sushi La Serena';
const MEDIOS=new Set(['Efectivo','Débito','Edenred','Junaeb','Otros']);
const fail=m=>{throw Error(m);};
const need=(condition,msg)=>{if(!condition)fail(msg);};
const copy=x=>JSON.parse(JSON.stringify(x));
const n=(v)=>Number(v??0);
const valido=v=>Number.isSafeInteger(v)&&v>=0&&v<=3000000;
const trim=s=>String(s??'').trim();
const fecha=stamp=>{
 need(Number.isSafeInteger(stamp)&&stamp>0&&stamp<8640000000000000,'Fecha de corrección inválida.');
 return new Date(stamp).toISOString();
};
function pedidoTurno(estado,id){
 need(estado?.suc===SUC&&Array.isArray(estado.pedidos)&&estado.pedidos.every(x=>x?.suc===SUC)&&
  Array.isArray(estado.propinas)&&Array.isArray(estado.cierres),'Abre el estado confirmado de Romo.');
 const matches=estado.pedidos.filter(p=>Number(p.id)===id);
 need(Number.isSafeInteger(id)&&id>0&&matches.length===1,'Pedido no identificado o duplicado.');
 const p=matches[0],turno=trim(p.turnoClave),dia=turno.slice(0,10);
 const caja=estado.cajasDiarias?.[SUC+'|'+dia];
 const activa=trim(estado.fechaOperativa);
 need(/^\d{4}-\d{2}-\d{2}@\d+$/.test(turno)&&caja?.turnoAbierto===true&&
  caja.baseConfirmada===true&&caja.turnoId===turno&&(!activa||activa===dia)&&
  !estado.cierres.some(c=>c.suc===SUC&&c.turnoClave===turno),'Solo se corrige el pago del turno abierto.');
 need(['Pendiente','Entregado'].includes(p.estado)&&!p.esPremio&&
  !/^PRUEBA\b/i.test(trim(p.cliente))&&!/^QA-ROMO-/i.test(trim(p.codigoCarta)),'Este pedido no admite corrección de pago.');
 return p;
}
function validarSinCasosEspeciales(estado,p){
 need(!p.productosPagadosOtroLocal&&!p.envioPagadoOtroLocal&&
  !(Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length),'Los pagos de otro local o de mesa QR se concilian por separado.');
 need(n(p.propina)===0&&!estado.propinas.some(x=>Number(x.pedidoId)===Number(p.id)),
  'El pedido tiene propina registrada. Revisa primero su conciliación en Caja.');
 need(!p.transferenciaManualQA,'La transferencia verificada requiere revisar el registro bancario.');
}
function sumaCuenta(p){
 const sub=n(p.subtotal),env=p.modalidad==='Delivery'?n(p.envio):0;
 need(valido(sub)&&sub>0&&valido(env)&&valido(sub+env)&&n(p.total)===sub+env,
  'El importe original no cuadra. Revisa el pedido antes de corregir.');
 return {sub,env,total:sub+env};
}
function recibidos(p,sub,env){
 const pagos={};
 for(const [importe,filas,base] of [[sub,p.pagosProductos,p.medio],[env,p.pagosEnvio,p.medioEnvio]]){
  need(filas===undefined||filas===null||Array.isArray(filas),'Revisa el registro de pagos del pedido.');
  if(!importe){need(!filas?.length,'El pago registrado no coincide con el pedido.');continue;}
  const lineas=filas?.length?filas:[{medio:base,monto:importe}];
  need(lineas.length<=6&&lineas.every(x=>MEDIOS.has(x?.medio)&&valido(n(x.monto))&&n(x.monto)>0),
   'Transferencias y pagos de aplicaciones se concilian por separado.');
  need(lineas.reduce((a,x)=>a+n(x.monto),0)===importe,'El importe por medio no coincide con el pago anterior.');
  for(const x of lineas)pagos[x.medio]=(pagos[x.medio]||0)+n(x.monto);
 }
 // Si era mixto, conservar como medio previsto el principal, no una línea de dinero recibido.
 need(MEDIOS.has(p.medio)&&(!env||MEDIOS.has(p.medioEnvio)),
  'Transferencias y pagos de aplicaciones se concilian por separado.');
 return pagos;
}
function anotar(p,ev,{historial=true}={}){
 if(historial)p.historialCambios=[...(p.historialCambios||[]),ev].slice(-100);
 p.correccionesTurno=[...(p.correccionesTurno||[]),ev].slice(-100);
}
function validarAuditoria(p){
 need((p.historialCambios===undefined||Array.isArray(p.historialCambios))&&
  (p.correccionesTurno===undefined||Array.isArray(p.correccionesTurno)),'No se puede conservar el historial del pedido.');
}
export function prepararQuitarPagadoRomoQA(estado,{pedidoId,responsable,registradoEn}={}){
 const p=pedidoTurno(estado,pedidoId),autor=trim(responsable),en=fecha(registradoEn);
 need(autor.length>=2&&autor.length<=80,'Escribe quién realiza la modificación.');
 need(p.pagado===true&&!p.ajusteCobroPendiente,'El pedido ya no figura pagado o tiene una diferencia pendiente.');
 validarSinCasosEspeciales(estado,p);validarAuditoria(p);
 const {sub,env,total}=sumaCuenta(p),recibido=recibidos(p,sub,env);
 const perfiles=Object.values(estado.clientes||{}).flatMap(c=>
  (Array.isArray(c?.movimientos)?c.movimientos:[]).filter(m=>m.tipo==='venta'&&Number(m.pedidoId)===pedidoId)
   .map(m=>({c,m})));
 need(perfiles.length<=1,'Hay más de un timbre de compra para este pedido. Revisa la tarjeta de cliente.');
 let timbre=null;
 if(perfiles.length){
  const {c,m}=perfiles[0];
  need(Number.isSafeInteger(n(c.pedidos))&&n(c.pedidos)>=1&&Number.isSafeInteger(n(c.gastado))&&n(c.gastado)>=sub,
   'La tarjeta del cliente necesita conciliación antes de quitar el pago.');
  timbre=copy(m);
 }
 const anterior=copy({pagado:p.pagado,estado:p.estado,recibido,
  cobroConfirmadoEn:p.cobroConfirmadoEn,cobroConfirmadoPor:p.cobroConfirmadoPor,
  pagoConfirmadoEn:p.pagoConfirmadoEn,pagoConfirmadoPor:p.pagoConfirmadoPor,
  entregadoEn:p.entregadoEn,entregadoPor:p.entregadoPor,timbreCompra:timbre});
 if(perfiles.length){
  const {c,m}=perfiles[0];
  c.movimientos=c.movimientos.filter(f=>f!==m);
  c.pedidos=n(c.pedidos)-1;c.gastado=n(c.gastado)-sub;
 }
 p.pagado=false;p.estado='Pendiente';p.pagosProductos=[];p.pagosEnvio=[];
 delete p.cobroConfirmadoEn;delete p.cobroConfirmadoPor;
 delete p.pagoConfirmadoEn;delete p.pagoConfirmadoPor;
 delete p.entregadoEn;delete p.entregadoPor;
 p.ajusteCobroPendiente={tipo:'pago_desmarcado',estado:'pendiente',recibido:copy(recibido),saldo:total,fechaISO:en};
 anotar(p,{tipo:'quitar_pagado',fecha:en,fechaISO:en,registradoEn,responsable:autor,
  motivo:'Se quitó Pagado y quedó por aclarar qué ocurrió con el dinero. No se registró una devolución.',
  anterior,nuevo:{pagado:false,estado:p.estado},saldoPendiente:total});
 return Object.freeze({pedidoId,saldo:total});
}
export function revisarAclaracionPagoRomoQA(p){
 const q=p?.ajusteCobroPendiente;
 if(p?.pagado!==false||!['Pendiente','Entregado'].includes(p.estado)||q?.tipo!=='pago_desmarcado'||q.estado!=='pendiente'||
  !q.recibido||typeof q.recibido!=='object'||Array.isArray(q.recibido)||
  !valido(q.saldo)||q.saldo<=0)return null;
 const entries=Object.entries(q.recibido);
 if(!entries.length||entries.some(([m,v])=>!MEDIOS.has(m)||!valido(v)||v<=0)||
  entries.reduce((a,[,v])=>a+v,0)!==q.saldo)return null;
 const {total}=sumaCuenta(p);
 return total===q.saldo?q:null;
}
export function aclararPagoDesmarcadoRomoQA(estado,{pedidoId,responsable,registradoEn,decision,confirmado=false,paraCancelar=false}={}){
 const p=pedidoTurno(estado,pedidoId),autor=trim(responsable),en=fecha(registradoEn);
 need(autor.length>=2&&autor.length<=80,'Identifica quién verificó el dinero.');
 validarSinCasosEspeciales(estado,p);validarAuditoria(p);
 const q=revisarAclaracionPagoRomoQA(p);
 need(q,'No hay un cobro anterior válido por aclarar.');
 need(confirmado===true&&['no_recibido','devuelto'].includes(decision),
  'Aclara si nunca se recibió el dinero o si ya se devolvió. Si falta devolverlo, no se modifica.');
 const accion=decision==='no_recibido'?'pago_erroneo_no_cobrado':'devolucion_cancelacion_confirmada';
 const evento={tipo:'aclaracion_cobro_anterior',accion,fecha:en,fechaISO:en,registradoEn,responsable:autor,
  motivo:decision==='no_recibido'?'Registrar que el dinero nunca se recibió.':'Registrar la devolución ya realizada.',
  importe:q.saldo,recibidoRegistrado:copy(q.recibido),saldoPendiente:0};
 p.ajusteCobroPendiente=null;anotar(p,evento,{historial:!paraCancelar});
 return evento;
}

