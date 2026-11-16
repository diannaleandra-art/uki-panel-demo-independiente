import {clasificarCorreccionPagadaRomoQA} from './uki-romo-edicion-pagada-qa.mjs';
/**
 * Romo — cálculo SOLO DE CONSULTA previo a corregir un pedido pagado.
 * Reutiliza las reglas de monto del formulario oficial de Uki:
 * productos, envío, propina opcional y métodos de pago individuales/mixtos.
 * NO registra nuevos ingresos, devoluciones, propinas, caja ni pedidos.
 * La corrección financiera permanecerá bloqueada hasta conciliación CAS.
 */
export const ROMO_DIFERENCIAS_SOLO_LECTURA_QA=true;
const SUC='Romo’s Sushi La Serena';
const err=x=>{throw Error(x)};
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const amount=(x,label,max=3000000)=>{
 if(x===null||x===undefined||x===''||!Number.isSafeInteger(Number(x))||
    Number(x)<0||Number(x)>max)err('Importe inválido: '+label);
 return Number(x);
};
const toLines=(item,kind,total,medios,forDraft=false)=>{
 const isDelivery=kind==='delivery';
 const key=isDelivery?'pagosEnvio':'pagosProductos';
 const single=isDelivery?'medioEnvio':'medio';
 const mixed=forDraft?(isDelivery?item.mixtoEnvio:item.mixtoProductos):true;
 const saved=forDraft&&mixed!==true?[]:item[key];
 if(saved!==undefined&&!Array.isArray(saved))err('Los medios del '+kind+' no están verificados');
 if(total===0){
  if(saved?.length)err('No se puede asignar dinero a '+kind+' sin importe');
  return [];
 }
 if(saved?.length){
  if(saved.length<2||saved.length>6)err('Distribución mixta de '+kind+' inválida');
  const rows=saved.map(x=>{
   if(!obj(x)||!medios.includes(x.medio))err('Medio de '+kind+' no permitido');
   return {medio:x.medio,monto:amount(x.monto,'línea '+kind)};
  });
  if(rows.some(x=>x.monto===0)||rows.reduce((s,x)=>s+x.monto,0)!==total)
   err('La distribución de '+kind+' no suma el importe');
  return rows;
 }
 if(forDraft&&mixed===true)err('Falta completar los importes del pago mixto de '+kind);
 const medio=String(item[single]||'');
 if(!medios.includes(medio))err('Selecciona un medio permitido para '+kind);
 return [{medio,monto:total}];
};
const group=(rows,medios)=>{
 const ret=Object.fromEntries(medios.map(k=>[k,0]));
 for(const p of rows)ret[p.medio]+=p.monto;
 return ret;
};
const productSum=products=>{
 if(!Array.isArray(products)||products.length===0||products.length>60)
  err('Productos incompletos o demasiados');
 let subtotal=0;
 for(const p of products){
  const qty=amount(p?.cantidad,'cantidad',100);
  const unit=amount(p?.precioUnit,'precio unitario',1000000);
  if(!qty||!unit)err('Faltan cantidades o precios');
  subtotal+=qty*unit;
  if(!Number.isSafeInteger(subtotal)||subtotal>3000000)err('Subtotal fuera de rango');
 }
 return subtotal;
};
function propinaDraft(d,subtotal){
 const modo=String(d.propinaModo||'ninguna');
 if(modo==='ninguna')return 0;
 if(modo==='diez')return Math.round(subtotal/10);
 if(modo==='otro')return amount(d.propinaPersonalizada,'propina',1000000);
 err('Modo de propina desconocido');
}
/** La salida es un plan comparativo, NO prueba de dinero efectivamente movido. */
export function calcularDiferenciaPagadaRomoQA(p,d,{
 mediosProductos,mediosDelivery
}={}){
 // Una única fuente de medios permitidos: las constantes ya existentes
 // de la bandeja operativa Romo, NO una lista comercial alternativa.
 if(!Array.isArray(mediosProductos)||!Array.isArray(mediosDelivery)||
    !mediosProductos.length||!mediosDelivery.length||
    new Set(mediosProductos).size!==mediosProductos.length||
    new Set(mediosDelivery).size!==mediosDelivery.length||
    !mediosDelivery.every(m=>mediosProductos.includes(m)))
   err('Faltan medios autorizados de la sucursal Romo');
 if(!obj(p)||p.suc!==SUC||p.pagado!==true||p.esPremio||p.estado==='Cancelado'||
   !obj(d)||Number(d.editando)!==Number(p.id))
  err('Selecciona un pedido pagado de Romo');
 if((Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length)||
    p.productosPagadosOtroLocal||p.envioPagadoOtroLocal||
    d.productosPagadosOtroLocal||d.envioPagadoOtroLocal||
    p.ajusteCobroPendiente)
  err('Cuenta QR, cobro de otro local o ajuste pendiente: requiere conciliación especializada');
 if(d.pagado!==true)err('Cambiar un pedido a no pagado requiere conciliación especial');
 if(d.modalidad!==p.modalidad)err('Cambiar la modalidad requiere verificar reparto y caja');
 const antesSub=productSum(p.productos);
 if(antesSub!==amount(p.subtotal,'subtotal original'))
  err('La venta original no coincide con sus productos');
 const antesEnv=p.modalidad==='Delivery'?amount(p.envio,'delivery original',4000):0;
 const antesTip=amount(p.propina??0,'propina original',1000000);
 const antesTotal=amount(p.total,'total de pedido original');
 if(antesTotal!==antesSub+antesEnv+antesTip)
  err('El total original no concuerda con venta, reparto y propina');
 const lineItems=(Array.isArray(d.items)?d.items:[]).filter(x=>String(x?.nombre||'').trim())
   .map(x=>({cantidad:x.cant,precioUnit:x.precio}));
 const despuesSub=productSum(lineItems);
 const despuesEnv=d.modalidad==='Delivery'?amount(d.envio,'delivery propuesto',4000):0;
 const despuesTip=propinaDraft(d,despuesSub);
 const despuesTotal=despuesSub+despuesEnv+despuesTip;
 if(!Number.isSafeInteger(despuesTotal)||despuesTotal>3000000)
  err('El nuevo total no es válido');
 const productosPerm=mediosProductos;
 const deliveryPerm=mediosDelivery;
 const oldSale=[
  ...toLines(p,'productos',antesSub,productosPerm),
  ...toLines(p,'delivery',antesEnv,deliveryPerm)
 ];
 const newSale=[
  ...toLines(d,'productos',despuesSub,productosPerm,true),
  ...toLines(d,'delivery',despuesEnv,deliveryPerm,true)
 ];
 const oldBy=group(oldSale,productosPerm),newBy=group(newSale,productosPerm);
 const diferencias=productosPerm.map(m=>({
   medio:m,registrado:oldBy[m],propuesto:newBy[m],diferencia:newBy[m]-oldBy[m]
 })).filter(x=>x.registrado||x.propuesto||x.diferencia);
 const viejaPropina=antesTip?String(p.medioPropina||'Efectivo'):'';
 const nuevaPropina=despuesTip?String(d.medioPropina||'Efectivo'):'';
 if(viejaPropina&&!deliveryPerm.includes(viejaPropina)||
    nuevaPropina&&!deliveryPerm.includes(nuevaPropina))
  err('El medio de propina no es válido');
 const hasChanges=diferencias.some(x=>x.diferencia!==0)||
   antesTip!==despuesTip||viejaPropina!==nuevaPropina||
   antesSub!==despuesSub||antesEnv!==despuesEnv;
 const oldPaid=antesSub+antesEnv;
 const newPaid=despuesSub+despuesEnv;
 if(diferencias.reduce((n,x)=>n+x.diferencia,0)!==newPaid-oldPaid)
  err('La diferencia por medio no cuadra');
 const delta=despuesTotal-antesTotal;
 return Object.freeze({
  storeId:'romo:serena',soloLectura:true,habilitaGuardar:false,
  pedidoId:p.id,
  original:Object.freeze({productos:antesSub,delivery:antesEnv,propina:antesTip,total:antesTotal}),
  propuesto:Object.freeze({productos:despuesSub,delivery:despuesEnv,propina:despuesTip,total:despuesTotal}),
  diferencias:Object.freeze(diferencias.map(x=>Object.freeze(x))),
  saldoTeorico:delta,
  propina:Object.freeze({
   registrada:antesTip,propuesta:despuesTip,
   medioAnterior:viejaPropina,medioPropuesto:nuevaPropina,
   diferencia:despuesTip-antesTip
  }),
  requiereConciliacion:hasChanges,
  bloqueado:true,
  mensaje:'Comparación informativa. No confirma dinero, no genera pagos ni permite guardar cambios financieros.'
 });
}


/**
 * Rectifica exclusivamente el MEDIO DE COBRO que realmente fue recibido,
 * sin volver a cobrar, sin cambiar importe, productos, reparto o propina.
 * Prepara una COPIA de Romo; únicamente el CAS cifrado la hace definitiva.
 */
export function prepararRectificacionMediosRomoQA({
 estado,pedidoId,draft,responsable,foto,mediosProductos,mediosDelivery,
 turnoCerrado=false,registradoEn=Date.now(),fechaISO=new Date(registradoEn).toISOString()
}={}){
 if(!obj(estado)||estado.suc!==SUC||!Array.isArray(estado.pedidos)||
    !Array.isArray(estado.cierres)||!Array.isArray(estado.propinas)||
    !obj(estado.clientes)||!obj(estado.cajasDiarias)||
    !Number.isSafeInteger(pedidoId)||pedidoId<=0||typeof foto!=='function')
  err('Falta el estado propio de Romo o la auditoría aprobada');
 const encontrados=estado.pedidos.filter(p=>p?.suc===SUC&&p.id===pedidoId);
 if(encontrados.length!==1)err('El pedido ya no existe o se duplicó');
 const previo=encontrados[0],turno=String(previo.turnoClave||'');
 const caja=estado.cajasDiarias[SUC+'|'+turno.slice(0,10)];
 if(!previo.pagado||previo.estado==='Cancelado'||previo.esPremio||
    previo.productosPagadosOtroLocal||previo.envioPagadoOtroLocal||
    previo.ajusteCobroPendiente||turnoCerrado||
    (Array.isArray(previo.qrSolicitudes)&&previo.qrSolicitudes.length)||
    !turno||caja?.turnoAbierto!==true||caja.baseConfirmada!==true||
    caja.turnoId!==turno||
    estado.cierres.some(c=>c?.suc===SUC&&c.turnoClave===turno))
  err('Solo pedidos pagados del turno abierto, sin QR ni ajustes anteriores');
 const actor=String(responsable||'').trim();
 if(actor.length<2||actor.length>80||
    !Number.isSafeInteger(registradoEn)||registradoEn<=0||
    !Number.isFinite(Date.parse(fechaISO))||draft?.editando!==pedidoId)
  err('Responsable o formulario de corrección no válido');
 const prev=clasificarCorreccionPagadaRomoQA(previo,draft);
 const mediosEditables=new Set([
  'medio de productos','medio de delivery',
  'pagos mixtos de productos','pagos mixtos de delivery',
  'modo de pagos mixtos'
 ]);
 if(prev.cambios.length||!prev.protegidos.length||
    prev.protegidos.some(k=>!mediosEditables.has(k)))
  err('Se detectaron otros cambios; solo se admite corregir medios realmente recibidos');
 const plan=calcularDiferenciaPagadaRomoQA(previo,draft,{
  mediosProductos,mediosDelivery
 });
 if(plan.saldoTeorico!==0||
    plan.original.productos!==plan.propuesto.productos||
    plan.original.delivery!==plan.propuesto.delivery||
    plan.original.propina!==plan.propuesto.propina||
    plan.propina.medioAnterior!==plan.propina.medioPropuesto||
    !plan.diferencias.some(x=>x.diferencia!==0))
  err('El cobro original debe conservar el importe y propina exactos');
 // Reutilizar la validación de medios del comparador. No hay pago nuevo.
 const prod=toLines(draft,'productos',plan.original.productos,mediosProductos,true);
 const del=toLines(draft,'delivery',plan.original.delivery,mediosDelivery,true);
 const nuevo={...previo,medio:prod[0]?.medio||'Efectivo',
  medioEnvio:del[0]?.medio||'Efectivo',
  pagosProductos:draft.mixtoProductos?prod.map(x=>({...x})):[],
  pagosEnvio:draft.mixtoEnvio?del.map(x=>({...x})):[]
 };
 const antes=foto(previo),despues=foto(nuevo);
 if(JSON.stringify(antes)===JSON.stringify(despues))
  err('No cambió la forma de pago registrada');
 const ev={tipo:'medio_cobro_corregido_sin_nuevo_pago',
  responsable:actor,fecha:fechaISO,registradoEn,
  motivo:'Corrección del medio recibido, sin cobro ni devolución',
  anterior:antes,nuevo:despues,diferenciaMedios:plan.diferencias};
 nuevo.historialCambios=[...(Array.isArray(previo.historialCambios)?
  previo.historialCambios:[]),ev].slice(-100);
 nuevo.correccionesTurno=[...(Array.isArray(previo.correccionesTurno)?
  previo.correccionesTurno:[]),
  {tipo:ev.tipo,fechaISO,registradoEn,responsable:actor,
   nota:ev.motivo,antes,despues,saldoPendiente:0}];
 estado.pedidos[estado.pedidos.indexOf(previo)]=nuevo;
 return Object.freeze({pedidoId,soloClasificacion:true,noRegistraCobro:true,
  ventaIntacta:true,diferencias:plan.diferencias});
}


/**
 * Subconjunto prudente de la edición PAGADA oficial de Uki:
 * modificar ÚNICAMENTE el precio unitario de productos ya existentes.
 * Conservar cantidades, artículos, cliente, timbres, propina y delivery.
 * No registra cobro/devolución ni declara dinero recibido. Solo deja un
 * ajusteCobroPendiente con el dinero REAL anterior, cerrado por separado.
 */
export function prepararDiferenciaPrecioPagadoRomoQA({
 estado,pedidoId,draft,responsable,foto,mediosProductos,mediosDelivery,
 turnoCerrado=false,registradoEn=Date.now(),fechaISO=new Date(registradoEn).toISOString()
}={}){
 if(!obj(estado)||estado.suc!==SUC||!Array.isArray(estado.pedidos)||
    !Array.isArray(estado.cierres)||!obj(estado.cajasDiarias)||
    !Array.isArray(estado.propinas)||!Number.isSafeInteger(pedidoId)||
    pedidoId<=0||typeof foto!=='function')
  err('Estado independiente o auditoría Romo inválidos');
 const list=estado.pedidos.filter(p=>p?.suc===SUC&&p.id===pedidoId);
 if(list.length!==1||estado.pedidos.some(p=>p?.suc!==SUC))
  err('Pedido de Romo inexistente, duplicado o mezclado con Uki');
 const p=list[0],turno=String(p.turnoClave||'');
 const caja=estado.cajasDiarias[SUC+'|'+turno.slice(0,10)];
 if(p.pagado!==true||p.estado==='Cancelado'||p.esPremio||
    /^PRUEBA\b/i.test(String(p.cliente||''))||p.ajusteCobroPendiente||
    p.productosPagadosOtroLocal||p.envioPagadoOtroLocal||
    (Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.length)||
    turnoCerrado||!turno||caja?.turnoAbierto!==true||
    caja.baseConfirmada!==true||caja.turnoId!==turno||
    estado.cierres.some(c=>c?.suc===SUC&&c.turnoClave===turno))
  err('Solo venta real pagada del turno original abierto, sin otro ajuste, QR ni cierre');
 const actor=String(responsable||'').trim();
 if(actor.length<2||actor.length>80||!Number.isSafeInteger(registradoEn)||
    registradoEn<=0||!Number.isFinite(Date.parse(fechaISO))||
    Number(draft?.editando)!==pedidoId)
  err('Responsable, fecha o formulario incorrecto');
 if(!Array.isArray(p.productos)||p.productos.length===0||
    !Array.isArray(draft.items)||draft.items.length!==p.productos.length)
  err('No es posible agregar o retirar productos en este ajuste de precio');
 const precios=draft.items.map((x,i)=>{
  const old=p.productos[i];
  if(String(x.nombre||'')!==String(old.nombre||'')||
     Number(x.cant)!==Number(old.cantidad)||
     String(x.det||'')!==String(old.detalle||''))
   err('Solo cambia el precio: los productos, cantidades y armado deben quedar intactos');
  const precio=amount(x.precio,'precio nuevo',1000000);
  if(precio===0)err('El precio debe ser mayor a cero');
  return precio;
 });
 if(!precios.some((precio,i)=>precio!==Number(p.productos[i].precioUnit)))
  err('No se modificó ningún precio');
 const clas=clasificarCorreccionPagadaRomoQA(p,draft);
 const proteccionAceptada=new Set([
  'armado, productos, cantidades o precios','total o subtotal',
  'pagos mixtos de productos'
 ]);
 if(clas.cambios.length||
    clas.protegidos.some(v=>!proteccionAceptada.has(v)))
  err('La corrección incluye cliente, medio, reparto, propina u otros datos protegidos: '+
   clas.protegidos.filter(v=>!proteccionAceptada.has(v)).join(', '));
 // El método de pago no se reclasifica aquí; eso tiene la corrección
 // oficial de medio realmente recibido. Mixtos pueden redistribuir
 // sus importes, conservando exactamente los medios originales.
 const prevMix=Array.isArray(p.pagosProductos)&&p.pagosProductos.length>0;
 if(prevMix!==Boolean(draft.mixtoProductos)||
    (Array.isArray(p.pagosEnvio)&&p.pagosEnvio.length>0)!==Boolean(draft.mixtoEnvio)||
    String(p.medio||'Efectivo')!==String(draft.medio||'Efectivo')||
    String(p.medioEnvio||'Efectivo')!==String(draft.medioEnvio||'Efectivo'))
  err('Primero corrige por separado el medio de pago original');
 const plan=calcularDiferenciaPagadaRomoQA(p,draft,{mediosProductos,mediosDelivery});
 if(plan.original.delivery!==plan.propuesto.delivery||
    plan.original.propina!==plan.propuesto.propina||
    plan.propina.medioAnterior!==plan.propina.medioPropuesto||
    plan.original.productos===plan.propuesto.productos||
    plan.saldoTeorico!==plan.propuesto.productos-plan.original.productos)
  err('El ajuste debe cambiar solo el importe de los productos, no propinas ni reparto');
 const distribucion=toLines(draft,'productos',plan.propuesto.productos,mediosProductos,true);
 const anterior=toLines(p,'productos',plan.original.productos,mediosProductos);
 if(prevMix){
  const mediosAnteriores=[...new Set(anterior.map(x=>x.medio))].sort();
  const mediosNuevos=[...new Set(distribucion.map(x=>x.medio))].sort();
  if(JSON.stringify(mediosAnteriores)!==JSON.stringify(mediosNuevos))
   err('El ajuste mixto conserva los mismos medios ya utilizados');
 }
 // Los importes realmente cobrados ANTES del ajuste se congelan como en
 // Uki. Una venta corregida no equivale a una devolución hecha.
 const recibido=Object.fromEntries(plan.diferencias
  .filter(x=>x.registrado>0).map(x=>[x.medio,x.registrado]));
 const saldo=-plan.saldoTeorico;
 if(!Number.isSafeInteger(saldo)||saldo===0||Math.abs(saldo)>3000000)
  err('Diferencia inválida; no se generó una devolución o cobro');
 const antes=foto(p);
 const nuevo={...p,
  productos:p.productos.map((x,i)=>({...x,precioUnit:precios[i]})),
  subtotal:plan.propuesto.productos,
  total:plan.propuesto.total,
  pagosProductos:prevMix?distribucion.map(x=>({...x})):[]
 };
 nuevo.ajusteCobroPendiente={
  estado:'pendiente',recibido,saldo,fechaISO
 };
 const despues=foto(nuevo);
 const ev={
  tipo:'correccion_precio_pagado_pendiente',
  responsable:actor,fecha:fechaISO,fechaISO,registradoEn,
  motivo:'Importe corregido sin recibir ni devolver todavía dinero',
  saldoPendiente:saldo,
  recibidoOriginal:{...recibido},
  diferenciaMedios:plan.diferencias,
  anterior:antes,nuevo:despues
 };
 nuevo.historialCambios=[...(Array.isArray(p.historialCambios)?p.historialCambios:[]),ev];
 nuevo.correccionesTurno=[...(Array.isArray(p.correccionesTurno)?p.correccionesTurno:[]),
  {tipo:ev.tipo,accion:'ajuste_financiero_pendiente',
   fechaISO,registradoEn,responsable:actor,nota:ev.motivo,
   antes,despues,recibidoOriginal:{...recibido},
   diferenciaMedios:plan.diferencias,saldoPendiente:saldo}];
 estado.pedidos[estado.pedidos.indexOf(p)]=nuevo;
 return Object.freeze({pedidoId,ajustePendiente:true,ventaConNuevoImporte:true,
  noRegistraCobro:true,saldoPendiente:saldo,
  diferencias:Object.freeze(plan.diferencias.map(x=>Object.freeze({...x})))});
}
