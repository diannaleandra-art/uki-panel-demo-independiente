/* Edición pagada en un solo paso: guarda la misma venta, conserva la identidad
   del pedido y el timbre, y deja las diferencias reales pendientes. Copia pura. */
const SUC='Romo’s Sushi La Serena';
const fail=m=>{throw Error(m);};
const t=x=>String(x??'').trim();
const n=x=>Number(x)||0;
const equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const amount=(x,label,max=3000000)=>{
 const v=Number(x);if(x===null||x===undefined||x===''||!Number.isSafeInteger(v)||v<0||v>max)fail('Revisa '+label+'.');
 return v;
};
const phone=x=>String(x??'').replace(/\D/g,'').replace(/^56(?=9\d{8}$)/,'');
const copy=x=>JSON.parse(JSON.stringify(x));
const ordered=x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v>0).sort(([a],[b])=>a.localeCompare(b)));
function afuera(p,sub,env){
 const raw=p.montoProductosOtroLocal;
 const prod=p.productosPagadosOtroLocal?Math.max(0,Math.min(sub,raw===undefined||raw===null||raw===''?sub:n(raw))):0;
 const envio=env===0?0:p.envioPagadoOtroLocal===true?
  Math.max(0,Math.min(env,p.montoEnvioOtroLocal===undefined||p.montoEnvioOtroLocal===null||p.montoEnvioOtroLocal===''?env:n(p.montoEnvioOtroLocal))):
  p.envioPagadoOtroLocal===undefined&&p.productosPagadosOtroLocal&&n(raw)>sub&&n(raw)<=sub+env?n(raw)-sub:0;
 return {prod,envio,local:prod||envio?t(p.localPagoExterno):''};
}
function medios(p,sub,env,forDraft,permitidos,delivery){
 const ext=afuera(p,sub,env),ret={},porTipo={};
 for(const [tipo,total] of [['Productos',sub-ext.prod],['Envio',env-ext.envio]]){
  const isEnv=tipo==='Envio',allowed=isEnv?delivery:permitidos,field='pagos'+tipo,flag='mixto'+tipo;
  const rows=forDraft&&!p[flag]?[]:(p[field]||[]);
  if(!Array.isArray(rows))fail('Revisa pagos de '+tipo.toLowerCase()+'.');
  if(!total){porTipo[tipo]=[];continue;}
  if(forDraft&&p[flag]&&rows.length===0)fail('Completa el pago mixto de '+tipo.toLowerCase()+'.');
  const list=rows.length?rows.map(x=>({medio:t(x.medio),monto:amount(x.monto,'monto del pago')})):
   [{medio:t(p[isEnv?'medioEnvio':'medio']||'Efectivo'),monto:total}];
  if(list.length>6||list.some(x=>!allowed.includes(x.medio)||x.monto<=0)||list.reduce((a,x)=>a+x.monto,0)!==total)
   fail(forDraft?'Revisa los medios y montos de '+(isEnv?'delivery':'productos')+': deben sumar 
  for(const x of list)ret[x.medio]=(ret[x.medio]||0)+x.monto;
  porTipo[tipo]=list;
 }
 return {ext,porTipo,totales:ordered(ret)};
}
// Proponer solo cuando el operador no cambió los importes originales.
function proponerMixto(draft,old,sub,env,oldSub,oldEnv){
 const d={...draft},propuestas=[];
 const ext=afuera(draft,sub,env);
 if(old.ext.prod||old.ext.envio||ext.prod||ext.envio||sub+env===oldSub+oldEnv)return {d,propuestas};
 for(const [tipo,total,anterior] of [['Productos',sub,oldSub],['Envio',env,oldEnv]]){
  const key='pagos'+tipo,flag='mixto'+tipo,prev=old.porTipo[tipo];
  if(!d[flag]||prev.length<2||total===anterior||!Array.isArray(d[key]))continue;
  if(!equal(d[key].map(x=>({medio:t(x.medio),monto:Number(x.monto)})),prev))continue;
  const list=prev.map(x=>({...x})),delta=total-anterior;
  if(delta>0)list[list.length-1].monto+=delta;
  else{
   let resta=-delta;
   for(let i=list.length-1;i>=0&&resta>0;i--){
    const quitar=Math.min(resta,list[i].monto);
    list[i].monto-=quitar;resta-=quitar;
   }
  }
  const valid=list.filter(x=>x.monto>0);
  d[key]=valid;d[flag]=valid.length>1;
  if(valid.length===1)d[tipo==='Envio'?'medioEnvio':'medio']=valid[0].medio;
  propuestas.push({tipo,antes:prev,despues:valid});
 }
 return {d,propuestas};
}
function productos(d){
 if(!Array.isArray(d.items))fail('Agrega productos.');
 const items=d.items.filter(x=>t(x.nombre)).map(x=>({nombre:t(x.nombre),cantidad:amount(x.cant,'cantidad',100),precioUnit:amount(x.precio,'precio',1000000),detalle:String(x.det??'')}));
 if(!items.length||items.length>60||items.some(x=>!x.cantidad||!x.precioUnit))fail('Revisa las cantidades y precios.');
 const total=items.reduce((a,x)=>a+x.cantidad*x.precioUnit,0);
 amount(total,'subtotal');
 return {items,total};
}
export function prepararEdicionUnicaRomoQA({estado,pedidoId,draft,responsable,mediosProductos,mediosDelivery,turnoCerrado=false,foto,km,registradoEn=Date.now()}){
 if(estado?.suc!==SUC||!Array.isArray(estado.pedidos)||!estado.pedidos.every(p=>p.suc===SUC)||typeof foto!=='function')fail('Reabre el panel de Romo.');
 const found=estado.pedidos.filter(p=>p.id===pedidoId);
 if(found.length!==1||Number(draft?.editando)!==pedidoId)fail('El pedido ya no está disponible.');
 const p=found[0],autor=t(responsable),turno=t(p.turnoClave),caja=estado.cajasDiarias?.[SUC+'|'+turno.slice(0,10)];
 if(!p.pagado||p.estado==='Cancelado'||p.esPremio||/^PRUEBA\b/i.test(t(p.cliente))||turnoCerrado||!turno||caja?.turnoAbierto!==true||caja.baseConfirmada!==true||caja.turnoId!==turno||(estado.cierres||[]).some(c=>c.suc===SUC&&c.turnoClave===turno))
  fail('Solo puedes editar directamente pedidos pagados de la caja abierta.');
 if(autor.length<2||autor.length>80)fail('Escribe quién realiza la modificación.');
 if(p.ajusteCobroPendiente)fail('Regulariza primero la diferencia pendiente del pedido.');
 if(draft.pagado!==true)fail('Si el pago se marcó por error, utiliza la aclaración de cobro del pedido.');
 if(!equal(p.qrSolicitudes||[],draft.qrSolicitudes||[])||(p.qrSolicitudes||[]).length||t(p.codigoCarta)!==t(draft.codigoCarta)||t(p.sucursalCarta)!==t(draft.sucursalCarta)||String(p.textoOriginal||'')!==String(draft.texto||''))
  fail('Conserva la referencia original de la carta.');
 if(phone(p.telefono)!==phone(draft.telefono)||(!phone(p.telefono)&&t(p.cliente)!==t(draft.cliente)))
  fail('Cambiar la identidad del cliente requiere revisar su tarjeta de timbres.');
 if(t(p.fechaISO)!==t(draft.fecha))fail('Conserva la fecha original del pedido pagado.');
 if(!['Retiro','Delivery','Consumo en local'].includes(draft.modalidad))fail('Revisa la entrega.');
 const {items,total:sub}=productos(draft);
 const oldSub=amount(p.subtotal,'subtotal anterior'),oldEnv=p.modalidad==='Delivery'?amount(p.envio,'delivery anterior',4000):0;
 const env=draft.modalidad==='Delivery'?amount(draft.envio,'delivery',4000):0;
 const oldTip=n(p.propina),tipMode=t(draft.propinaModo||'ninguna');
 const tip=tipMode==='diez'?Math.round(sub*.1):tipMode==='otro'?amount(draft.propinaPersonalizada||0,'propina',1000000):tipMode==='ninguna'?0:NaN;
 if(!Number.isSafeInteger(tip))fail('Revisa la propina.');
 const tipChanged=tip!==oldTip||(tip>0&&t(draft.medioPropina||'Efectivo')!==t(p.medioPropina||'Efectivo'));
 const old=medios(p,oldSub,oldEnv,false,mediosProductos,mediosDelivery);
 const {d:propuesto,propuestas}=proponerMixto(draft,old,sub,env,oldSub,oldEnv);
 const next=medios(propuesto,sub,env,true,mediosProductos,mediosDelivery);
 const canonicalLines=x=>ordered(x.reduce((a,v)=>(a[v.medio]=(a[v.medio]||0)+v.monto,a),{}));
 const payChanged=!equal(canonicalLines(old.porTipo.Productos),canonicalLines(next.porTipo.Productos))||!equal(canonicalLines(old.porTipo.Envio),canonicalLines(next.porTipo.Envio))||!equal(old.ext,next.ext);
 const productChanged=!equal((p.productos||[]).map(x=>({nombre:t(x.nombre),cantidad:n(x.cantidad),precioUnit:n(x.precioUnit),detalle:String(x.detalle||'')})),items);
 const kmCanon=x=>x===null||x===undefined||x===''?null:Number(String(x).replace(',','.'));
 const newKm=draft.modalidad==='Delivery'?kmCanon(km):null;
 const oldKm=p.modalidad==='Delivery'?kmCanon(p.kmRecorrido):null;
 const infoChanged=t(p.cliente)!==t(draft.cliente)||t(p.telefono)!==t(draft.telefono)||p.modalidad!==draft.modalidad||!equal(oldKm,newKm)||t(p.mesaReferencia)!==(draft.modalidad==='Consumo en local'?t(draft.mesaReferencia):'');
 const subtotalChanged=sub!==oldSub||env!==oldEnv;
 if(tipChanged){
  if(productChanged||subtotalChanged||payChanged||infoChanged)fail('Guarda primero el cambio de productos o pago, dejando la propina anterior.');
  if(oldTip<=0)fail('Registra una propina nueva en Caja → Propinas.');
  return {soloPropina:true};
 }
 if(!productChanged&&!subtotalChanged&&!payChanged&&!infoChanged)return {sinCambios:true};
 if(!Number.isFinite(newKm)&&newKm!==null)fail('Revisa los kilómetros de entrega.');
 const externo=old.ext.prod||old.ext.envio||next.ext.prod||next.ext.envio;
 if(externo&&(subtotalChanged||payChanged||p.modalidad!==draft.modalidad))fail('Los importes pagados en otro local deben conciliarse con administración.');
 const nuevo={...p,cliente:t(draft.cliente),telefono:t(draft.telefono),
  modalidad:draft.modalidad,envio:env,kmRecorrido:newKm,mesaReferencia:draft.modalidad==='Consumo en local'?t(draft.mesaReferencia):'',
  productos:items,subtotal:sub,total:sub+env+oldTip};
 if(payChanged||subtotalChanged){
  for(const [tipo,field] of [['Productos','medio'],['Envio','medioEnvio']]){
   const xs=next.porTipo[tipo];
   nuevo[field]=xs[0]?.medio||p[field]||'Efectivo';
   nuevo['pagos'+tipo]=xs.length>=2?xs.map(x=>({...x})):[];
  }
 }
 const oldReceived=old.totales,expected=next.totales,suma=x=>Object.values(x).reduce((a,v)=>a+v,0);
 const saldo=suma(oldReceived)-suma(expected);
 if(saldo)nuevo.ajusteCobroPendiente={estado:'pendiente',recibido:copy(oldReceived),saldo,fechaISO:new Date(registradoEn).toISOString()};
 const reclasificar=saldo===0&&!equal(oldReceived,expected);
 const antes=foto(p),despues=foto(nuevo),fechaISO=new Date(registradoEn).toISOString();
 const ev={tipo:'edicion_unica_turno_abierto',responsable:autor,fecha:fechaISO,fechaISO,registradoEn,
  motivo:'Corrección del mismo pedido; sin nuevo cobro ni timbre',anterior:antes,nuevo:despues,recibidoOriginal:oldReceived,distribucionNueva:expected,saldoPendiente:saldo};
 nuevo.historialCambios=[...(p.historialCambios||[]),ev];
 nuevo.correccionesTurno=[...(p.correccionesTurno||[]),{tipo:ev.tipo,responsable:autor,fechaISO,registradoEn,nota:ev.motivo,antes,despues,saldoPendiente:saldo}];
 // Ajustar solo el acumulado de la tarjeta que realmente tiene este timbre,
 // sin borrar, renovar ni duplicar el movimiento de fidelidad.
 if(sub!==oldSub&&!p.productosPagadosOtroLocal){
  const perfiles=Object.values(estado.clientes||{}).filter(c=>Array.isArray(c?.movimientos)&&c.movimientos.some(m=>m.tipo==='venta'&&Number(m.pedidoId)===pedidoId));
  if(perfiles.length===1)perfiles[0].gastado=Math.max(0,n(perfiles[0].gastado)+sub-oldSub);
  else if(perfiles.length>1)fail('La tarjeta tiene varias referencias al pedido. Revisa el cliente antes de cambiar el importe.');
 }
 estado.pedidos[estado.pedidos.indexOf(p)]=nuevo;
 return {pedidoId,saldo,reclasificar,recibidoOriginal:oldReceived,distribucionNueva:expected,propuestasMixtas:propuestas,ventaUnica:true,noReenviaTimbre:true};
}
+total.toLocaleString('es-CL')+'.':'El pago original de '+(isEnv?'delivery':'productos')+' no cuadra con su importe. Requiere revisión de caja; no se modificó el pedido.');
  for(const x of list)ret[x.medio]=(ret[x.medio]||0)+x.monto;
  porTipo[tipo]=list;
 }
 return {ext,porTipo,totales:ordered(ret)};
}
// Proponer solo cuando el operador no cambió los importes originales.
function proponerMixto(draft,old,sub,env,oldSub,oldEnv){
 const d={...draft},propuestas=[];
 const ext=afuera(draft,sub,env);
 if(old.ext.prod||old.ext.envio||ext.prod||ext.envio||sub+env===oldSub+oldEnv)return {d,propuestas};
 for(const [tipo,total,anterior] of [['Productos',sub,oldSub],['Envio',env,oldEnv]]){
  const key='pagos'+tipo,flag='mixto'+tipo,prev=old.porTipo[tipo];
  if(!d[flag]||prev.length<2||total===anterior||!Array.isArray(d[key]))continue;
  if(!equal(d[key].map(x=>({medio:t(x.medio),monto:Number(x.monto)})),prev))continue;
  const list=prev.map(x=>({...x})),delta=total-anterior;
  if(delta>0)list[list.length-1].monto+=delta;
  else{
   let resta=-delta;
   for(let i=list.length-1;i>=0&&resta>0;i--){
    const quitar=Math.min(resta,list[i].monto);
    list[i].monto-=quitar;resta-=quitar;
   }
  }
  const valid=list.filter(x=>x.monto>0);
  d[key]=valid;d[flag]=valid.length>1;
  if(valid.length===1)d[tipo==='Envio'?'medioEnvio':'medio']=valid[0].medio;
  propuestas.push({tipo,antes:prev,despues:valid});
 }
 return {d,propuestas};
}
function productos(d){
 if(!Array.isArray(d.items))fail('Agrega productos.');
 const items=d.items.filter(x=>t(x.nombre)).map(x=>({nombre:t(x.nombre),cantidad:amount(x.cant,'cantidad',100),precioUnit:amount(x.precio,'precio',1000000),detalle:String(x.det??'')}));
 if(!items.length||items.length>60||items.some(x=>!x.cantidad||!x.precioUnit))fail('Revisa las cantidades y precios.');
 const total=items.reduce((a,x)=>a+x.cantidad*x.precioUnit,0);
 amount(total,'subtotal');
 return {items,total};
}
export function prepararEdicionUnicaRomoQA({estado,pedidoId,draft,responsable,mediosProductos,mediosDelivery,turnoCerrado=false,foto,km,registradoEn=Date.now()}){
 if(estado?.suc!==SUC||!Array.isArray(estado.pedidos)||!estado.pedidos.every(p=>p.suc===SUC)||typeof foto!=='function')fail('Reabre el panel de Romo.');
 const found=estado.pedidos.filter(p=>p.id===pedidoId);
 if(found.length!==1||Number(draft?.editando)!==pedidoId)fail('El pedido ya no está disponible.');
 const p=found[0],autor=t(responsable),turno=t(p.turnoClave),caja=estado.cajasDiarias?.[SUC+'|'+turno.slice(0,10)];
 if(!p.pagado||p.estado==='Cancelado'||p.esPremio||/^PRUEBA\b/i.test(t(p.cliente))||turnoCerrado||!turno||caja?.turnoAbierto!==true||caja.baseConfirmada!==true||caja.turnoId!==turno||(estado.cierres||[]).some(c=>c.suc===SUC&&c.turnoClave===turno))
  fail('Solo puedes editar directamente pedidos pagados de la caja abierta.');
 if(autor.length<2||autor.length>80)fail('Escribe quién realiza la modificación.');
 if(p.ajusteCobroPendiente)fail('Regulariza primero la diferencia pendiente del pedido.');
 if(draft.pagado!==true)fail('Si el pago se marcó por error, utiliza la aclaración de cobro del pedido.');
 if(!equal(p.qrSolicitudes||[],draft.qrSolicitudes||[])||(p.qrSolicitudes||[]).length||t(p.codigoCarta)!==t(draft.codigoCarta)||t(p.sucursalCarta)!==t(draft.sucursalCarta)||String(p.textoOriginal||'')!==String(draft.texto||''))
  fail('Conserva la referencia original de la carta.');
 if(phone(p.telefono)!==phone(draft.telefono)||(!phone(p.telefono)&&t(p.cliente)!==t(draft.cliente)))
  fail('Cambiar la identidad del cliente requiere revisar su tarjeta de timbres.');
 if(t(p.fechaISO)!==t(draft.fecha))fail('Conserva la fecha original del pedido pagado.');
 if(!['Retiro','Delivery','Consumo en local'].includes(draft.modalidad))fail('Revisa la entrega.');
 const {items,total:sub}=productos(draft);
 const oldSub=amount(p.subtotal,'subtotal anterior'),oldEnv=p.modalidad==='Delivery'?amount(p.envio,'delivery anterior',4000):0;
 const env=draft.modalidad==='Delivery'?amount(draft.envio,'delivery',4000):0;
 const oldTip=n(p.propina),tipMode=t(draft.propinaModo||'ninguna');
 const tip=tipMode==='diez'?Math.round(sub*.1):tipMode==='otro'?amount(draft.propinaPersonalizada||0,'propina',1000000):tipMode==='ninguna'?0:NaN;
 if(!Number.isSafeInteger(tip))fail('Revisa la propina.');
 const tipChanged=tip!==oldTip||(tip>0&&t(draft.medioPropina||'Efectivo')!==t(p.medioPropina||'Efectivo'));
 const old=medios(p,oldSub,oldEnv,false,mediosProductos,mediosDelivery);
 const {d:propuesto,propuestas}=proponerMixto(draft,old,sub,env,oldSub,oldEnv);
 const next=medios(propuesto,sub,env,true,mediosProductos,mediosDelivery);
 const canonicalLines=x=>ordered(x.reduce((a,v)=>(a[v.medio]=(a[v.medio]||0)+v.monto,a),{}));
 const payChanged=!equal(canonicalLines(old.porTipo.Productos),canonicalLines(next.porTipo.Productos))||!equal(canonicalLines(old.porTipo.Envio),canonicalLines(next.porTipo.Envio))||!equal(old.ext,next.ext);
 const productChanged=!equal((p.productos||[]).map(x=>({nombre:t(x.nombre),cantidad:n(x.cantidad),precioUnit:n(x.precioUnit),detalle:String(x.detalle||'')})),items);
 const kmCanon=x=>x===null||x===undefined||x===''?null:Number(String(x).replace(',','.'));
 const newKm=draft.modalidad==='Delivery'?kmCanon(km):null;
 const oldKm=p.modalidad==='Delivery'?kmCanon(p.kmRecorrido):null;
 const infoChanged=t(p.cliente)!==t(draft.cliente)||t(p.telefono)!==t(draft.telefono)||p.modalidad!==draft.modalidad||!equal(oldKm,newKm)||t(p.mesaReferencia)!==(draft.modalidad==='Consumo en local'?t(draft.mesaReferencia):'');
 const subtotalChanged=sub!==oldSub||env!==oldEnv;
 if(tipChanged){
  if(productChanged||subtotalChanged||payChanged||infoChanged)fail('Guarda primero el cambio de productos o pago, dejando la propina anterior.');
  if(oldTip<=0)fail('Registra una propina nueva en Caja → Propinas.');
  return {soloPropina:true};
 }
 if(!productChanged&&!subtotalChanged&&!payChanged&&!infoChanged)return {sinCambios:true};
 if(!Number.isFinite(newKm)&&newKm!==null)fail('Revisa los kilómetros de entrega.');
 const externo=old.ext.prod||old.ext.envio||next.ext.prod||next.ext.envio;
 if(externo&&(subtotalChanged||payChanged||p.modalidad!==draft.modalidad))fail('Los importes pagados en otro local deben conciliarse con administración.');
 const nuevo={...p,cliente:t(draft.cliente),telefono:t(draft.telefono),
  modalidad:draft.modalidad,envio:env,kmRecorrido:newKm,mesaReferencia:draft.modalidad==='Consumo en local'?t(draft.mesaReferencia):'',
  productos:items,subtotal:sub,total:sub+env+oldTip};
 if(payChanged||subtotalChanged){
  for(const [tipo,field] of [['Productos','medio'],['Envio','medioEnvio']]){
   const xs=next.porTipo[tipo];
   nuevo[field]=xs[0]?.medio||p[field]||'Efectivo';
   nuevo['pagos'+tipo]=xs.length>=2?xs.map(x=>({...x})):[];
  }
 }
 const oldReceived=old.totales,expected=next.totales,suma=x=>Object.values(x).reduce((a,v)=>a+v,0);
 const saldo=suma(oldReceived)-suma(expected);
 if(saldo)nuevo.ajusteCobroPendiente={estado:'pendiente',recibido:copy(oldReceived),saldo,fechaISO:new Date(registradoEn).toISOString()};
 const reclasificar=saldo===0&&!equal(oldReceived,expected);
 const antes=foto(p),despues=foto(nuevo),fechaISO=new Date(registradoEn).toISOString();
 const ev={tipo:'edicion_unica_turno_abierto',responsable:autor,fecha:fechaISO,fechaISO,registradoEn,
  motivo:'Corrección del mismo pedido; sin nuevo cobro ni timbre',anterior:antes,nuevo:despues,recibidoOriginal:oldReceived,distribucionNueva:expected,saldoPendiente:saldo};
 nuevo.historialCambios=[...(p.historialCambios||[]),ev];
 nuevo.correccionesTurno=[...(p.correccionesTurno||[]),{tipo:ev.tipo,responsable:autor,fechaISO,registradoEn,nota:ev.motivo,antes,despues,saldoPendiente:saldo}];
 // Ajustar solo el acumulado de la tarjeta que realmente tiene este timbre,
 // sin borrar, renovar ni duplicar el movimiento de fidelidad.
 if(sub!==oldSub&&!p.productosPagadosOtroLocal){
  const perfiles=Object.values(estado.clientes||{}).filter(c=>Array.isArray(c?.movimientos)&&c.movimientos.some(m=>m.tipo==='venta'&&Number(m.pedidoId)===pedidoId));
  if(perfiles.length===1)perfiles[0].gastado=Math.max(0,n(perfiles[0].gastado)+sub-oldSub);
  else if(perfiles.length>1)fail('La tarjeta tiene varias referencias al pedido. Revisa el cliente antes de cambiar el importe.');
 }
 estado.pedidos[estado.pedidos.indexOf(p)]=nuevo;
 return {pedidoId,saldo,reclasificar,recibidoOriginal:oldReceived,distribucionNueva:expected,ventaUnica:true,noReenviaTimbre:true};
}
