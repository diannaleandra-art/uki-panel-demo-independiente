/* Uki Sushi: detalle histórico inmutable por cierre. No escribe en la nube. */
(function(){
"use strict";
// Los pedidos antiguos conservan su importe original. Los nuevos pueden registrar
// pago mixto o productos cobrados por otro local (sin sumar ese ingreso a Uki).
function pagoExternoDetalle(p,sub,env){
 const raw=p.productosPagadosOtroLocal?Number(p.montoProductosOtroLocal):0;
 const productos=p.productosPagadosOtroLocal?
   (p.montoProductosOtroLocal===undefined||p.montoProductosOtroLocal===null||p.montoProductosOtroLocal===""?sub:Math.max(0,Math.min(sub,raw||0))):0;
 const declarado=Number(p.montoEnvioOtroLocal);
 const delivery=p.modalidad!=="Delivery"?0:Number.isFinite(declarado)&&p.montoEnvioOtroLocal!==undefined?
   Math.min(env,Math.max(0,declarado)):p.envioPagadoOtroLocal===true?env:
   p.envioPagadoOtroLocal===undefined&&p.productosPagadosOtroLocal&&Number.isFinite(raw)&&raw>sub&&raw<=sub+env?raw-sub:0;
 return {productos,delivery};
}
function cobroLocalPedido(p){
 if(!p.pagado||p.estado==="Cancelado"||p.esPremio)return 0;
 const env=p.modalidad==="Delivery"?Math.max(0,Number(p.envio)||0):0;
 const sub=Math.max(0,Number(p.subtotal)||0);
 const fuera=pagoExternoDetalle(p,sub,env);
 const suma=(items,base)=>Array.isArray(items)&&items.length?
   items.reduce((n,x)=>n+(Number(x.monto)||0),0):base;
 return suma(p.pagosProductos,Math.max(0,sub-fuera.productos))+
   suma(p.pagosEnvio,Math.max(0,env-fuera.delivery));
}
function notaPagoPedido(p){
 const cobrado=Object.prototype.hasOwnProperty.call(p,"cobradoLocal")?Number(p.cobradoLocal):(!p.pagado||p.estado==="Cancelado"||p.esPremio?0:Number(p.total)||0);
 const notas=["Cobrado en esta sucursal (productos y delivery): $"+cobrado];
 if((Number(p.propina)||0)>0)notas.push("Propina voluntaria aparte: $"+Number(p.propina)+" · "+String(p.medioPropina||"Efectivo"));
 const fuera=pagoExternoDetalle(p,Number(p.subtotal)||0,Number(p.envio)||0);
 if(fuera.productos)notas.push("Productos $"+fuera.productos+" pagados en "+String(p.localPagoExterno||"otro local"));
 if(fuera.delivery)notas.push("Delivery de Uki $"+fuera.delivery+" cobrado en "+String(p.localPagoExterno||"otro local")+"; se contabiliza para repartidor");
 for(const [titulo,lista] of [["Productos",p.pagosProductos],["Delivery",p.pagosEnvio]]){
  if(Array.isArray(lista)&&lista.length>1)notas.push(titulo+": "+lista.map(x=>String(x.medio)+" $"+Number(x.monto)).join(" + "));
 }
 return notas.join("; ");
}
function capturar(S,caja,delSucHoy){
 const copia=(arr,campos)=>delSucHoy(arr||[]).map(x=>{
  const o={};for(const k of campos)o[k]=x[k]??"";return o;
 });
 const pedidos=delSucHoy(S.pedidos||[]).map(p=>({
  id:p.id,codigoCarta:p.codigoCarta||"",cliente:p.cliente||"Sin nombre",
  codigoClienteUltimos4:String(p.codigoCliente||p.telefono||"").replace(/\D/g,"").slice(-4),
  timbreEnviadoEn:String(p.timbreEnviadoEn||""),
  timbreEnviadoPor:String(p.timbreEnviadoPor||""),
  timbreWhatsAppAbiertoEn:String(p.timbreWhatsAppAbiertoEn||""),
  timbreWhatsAppAbiertoPor:String(p.timbreWhatsAppAbiertoPor||""),
  timbreEventos:(Array.isArray(p.timbreEventos)?p.timbreEventos.slice(-12):[])
   .map(e=>({tipo:String(e.tipo||""),fecha:String(e.fecha||""),responsable:String(e.responsable||"")})),
  fechaISO:p.fechaISO||"",pagado:!!p.pagado,estado:p.estado||"",
  esPremio:!!p.esPremio,medio:p.medio||"",medioEnvio:p.medioEnvio||"",
  modalidad:p.modalidad||"",subtotal:Number(p.subtotal)||0,envio:Number(p.envio)||0,
  total:Number(p.total)||0,cobradoLocal:cobroLocalPedido(p),propina:Number(p.propina)||0,medioPropina:p.medioPropina||"",
  productosPagadosOtroLocal:!!p.productosPagadosOtroLocal,
  montoProductosOtroLocal:pagoExternoDetalle(p,Math.max(0,Number(p.subtotal)||0),Math.max(0,Number(p.envio)||0)).productos,
  envioPagadoOtroLocal:pagoExternoDetalle(p,Math.max(0,Number(p.subtotal)||0),Math.max(0,Number(p.envio)||0)).delivery>0,
  montoEnvioOtroLocal:pagoExternoDetalle(p,Math.max(0,Number(p.subtotal)||0),Math.max(0,Number(p.envio)||0)).delivery,
  localPagoExterno:p.localPagoExterno||"",
  pagosProductos:(p.pagosProductos||[]).map(x=>({medio:x.medio,monto:Number(x.monto)||0})),
  pagosEnvio:(p.pagosEnvio||[]).map(x=>({medio:x.medio,monto:Number(x.monto)||0})),
  productos:(p.productos||[]).map(z=>({
    nombre:z.nombre||"",cantidad:Number(z.cantidad)||0,
    precioUnit:Number(z.precioUnit)||0,detalle:z.detalle||""
  }))
 }));
 return {
  version:1,pedidos,
  gastos:copia(S.gastos,["id","fechaISO","concepto","monto","medio"]),
  retiros:copia(S.retiros,["id","fechaISO","motivo","monto"]),
  propinas:copia(S.propinas,["id","pedidoId","fechaISO","monto","medio"]),
  deliveriesManuales:copia(S.deliveriesManuales,["id","fechaISO","cliente","nota","monto","medio"]),
  cajaChica:{inicial:Number(caja.cajaChica?.inicial)||0,
   gastos:(caja.cajaChica?.gastos||[]).map(x=>({concepto:x.concepto||"",monto:Number(x.monto)||0}))},
  apps:Object.fromEntries(Object.entries(caja.apps||{}).map(([k,v])=>[k,Number(v)||0])),
  repartidor:{monto:Number(caja.pagoDelivery)||0,medio:caja.pagoDeliveryMedio||"Efectivo"},
  baseDelivery:Number(caja.base)||0
 };
}
function filas(c){
 const d=c.detalle;if(!d||d.version!==1)return [];
 const r=[];
 for(const p of d.pedidos||[]){
  const it=(p.productos||[]).map(z=>z.cantidad+"x "+z.nombre+(z.detalle?" ("+z.detalle+")":"")).join(", ");
  r.push(["Pedido",p.fechaISO,p.codigoCarta?"Carta #"+p.codigoCarta+" · Interno #"+p.id:"Interno #"+p.id,p.cliente,p.total,
   p.productosPagadosOtroLocal?"Pagado en otro local":((p.pagosProductos||[]).length>1?"Mixto":p.medio),
   (p.pagado?"Pagado":"Sin pago")+"; "+p.modalidad+"; envío "+p.envio+"; "+notaPagoPedido(p)+"; "+it]);
 }
 for(const x of d.gastos||[])r.push(["Gasto",x.fechaISO,x.id,x.concepto,x.monto,x.medio,""]);
 for(const x of d.retiros||[])r.push(["Retiro",x.fechaISO,x.id,x.motivo,x.monto,"Efectivo",""]);
 for(const x of d.propinas||[])r.push(["Propina",x.fechaISO,x.pedidoId?"Pedido "+x.pedidoId:x.id,"Propina",x.monto,x.medio,"Aparte de ventas"]);
 for(const x of d.deliveriesManuales||[])r.push(["Delivery manual",x.fechaISO,x.id,x.cliente,x.monto,x.medio,x.nota]);
 for(const x of d.cajaChica?.gastos||[])r.push(["Caja chica","","",x.concepto,x.monto,"Caja chica","No suma al total general de gastos"]);
 for(const [nombre,monto] of Object.entries(d.apps||{}))if(monto)r.push(["Venta app manual","","",nombre,monto,nombre,""]);
 if(d.repartidor?.monto)r.push(["Pago repartidor","","","Repartidor",d.repartidor.monto,d.repartidor.medio,""]);
 return r;
}
// Los movimientos individuales anteriores al historial detallado aún pueden existir
// en el estado cifrado de la sucursal. Esta es una consulta de solo lectura:
// NO altera cierres ni pretende que esos conceptos hayan sido congelados al cerrar.
function recuperarGastosAnteriores(c,estado){
 if(!c||c.detalle?.version===1||!estado||c.suc!==estado.suc)return null;
 const ms=x=>{
  if(Number.isFinite(x?.fechaMs))return x.fechaMs;
  if(Number.isFinite(x?.registradoEn))return x.registradoEn;
  if(Number.isFinite(x?.id)&&x.id>1e12&&x.id<1e14)return x.id;
  const d=new Date(x?.fechaISO||"");return Number.isFinite(d.getTime())?d.getTime():0;
 };
 const fin=ms(c);
 if(!fin)return null;
 const fecha=/^\d{4}-\d{2}-\d{2}$/.test(c.fechaOperativa||"")?c.fechaOperativa:null;
 // No atribuir a un turno antiguo una fecha que no consta en el cierre.
 if(!fecha)return null;
 const inicio=new Date(fecha+"T00:00:00").getTime();
 if(!Number.isFinite(inicio)||inicio>fin)return null;
 const anteriores=(estado.cierres||[]).filter(x=>x!==c&&x.suc===c.suc&&ms(x)>0&&ms(x)<fin);
 const corte=Math.max(inicio-1,...anteriores.map(ms));
 const gastos=(estado.gastos||[]).filter(x=>{
  if(x.suc!==c.suc)return false;
  const t=ms(x);
  return t>corte&&t<=fin&&Number.isFinite(Number(x.monto))&&Number(x.monto)>0;
 }).sort((a,b)=>ms(a)-ms(b));
 const sum=gastos.reduce((n,x)=>n+Number(x.monto),0);
 const esperado=Number(c.gastos);
 if(!Number.isFinite(esperado)||esperado<0)return null;
 // Coincidencia contable necesaria, pero no reemplaza la instantánea histórica.
 return {gastos,cuadra:Math.abs(sum-esperado)<0.001,esperado,encontrado:sum};
}
function renderGastosAnteriores(c,estado,fmt,esc){
 const r=recuperarGastosAnteriores(c,estado);
 if(!r)return '<p class="muted">Cierre anterior al desglose. Se conservaron los totales, pero no hay una copia inmutable de los conceptos individuales.</p>';
 if(!r.cuadra)return '<p class="muted">Cierre anterior al desglose. Se conservó el gasto total de '+fmt(r.esperado)+
  ', pero los movimientos originales actualmente disponibles suman '+fmt(r.encontrado)+
  '. No se muestran conceptos como comprobados porque no coinciden con el cierre.</p>';
 if(!r.gastos.length)return '<p class="muted">Cierre anterior al desglose: sin gastos individualizados que recuperar. Total guardado: '+fmt(r.esperado)+'.</p>';
 return '<div style="padding:12px;background:var(--bg);border-radius:10px;margin-top:12px">'+
  '<h3 style="margin:0 0 7px">🧾 Gastos originales asociados a este cierre</h3>'+
  '<p class="muted">Recuperados de los movimientos de la sucursal: fechas e importes coinciden con el total. No son una copia congelada al cerrar; podrían haber sido modificados después.</p>'+
  r.gastos.map(x=>'<div class="row"><span>'+esc(String(x.concepto||"Sin concepto")+
    ' · '+String(x.medio||"Sin medio"))+'</span><b>'+fmt(Number(x.monto))+'</b></div>').join("")+
  '<div class="row"><b>Total de gastos</b><b>'+fmt(r.esperado)+'</b></div></div>';
}
// Auditoría histórica de cobros: muestra cada importe tal como se congeló
// en el cierre. No recalcula ni modifica el total contable del cierre.
function agruparPagosHistoricos(c){
 const grupos=new Map();
 const agregar=(medio,monto,concepto)=>{
  const n=Number(monto);
  if(!Number.isSafeInteger(n)||n<=0)return;
  const m=String(medio||"Otros");
  if(!grupos.has(m))grupos.set(m,[]);
  grupos.get(m).push({concepto,monto:n});
 };
 const d=c?.detalle;
 if(!d||d.version!==1)return grupos;
 for(const p of d.pedidos||[]){
  if(!p.pagado||p.estado==="Cancelado"||p.esPremio)continue;
  const sub=Math.max(0,Number(p.subtotal)||0),env=p.modalidad==="Delivery"?Math.max(0,Number(p.envio)||0):0;
  const externo=pagoExternoDetalle(p,sub,env);
  const base=(p.codigoCarta?"Carta #"+p.codigoCarta+" · ":"")+"Interno #"+p.id+" · "+p.cliente;
  for(const [items,esperado,medio,tipo] of [
   [p.pagosProductos,sub-externo.productos,p.medio,"Productos"],
   [p.pagosEnvio,env-externo.delivery,p.medioEnvio||p.medio,"Delivery"]]){
   if(esperado<=0)continue;
   if(Array.isArray(items)&&items.length){
    for(const item of items)agregar(item.medio,item.monto,base+" · "+tipo);
   }else agregar(medio,esperado,base+" · "+tipo);
  }
 }
 for(const [medio,monto]of Object.entries(d.apps||{}))
  agregar(medio,monto,"Aplicación manual · sin pedido individual");
 for(const x of d.deliveriesManuales||[])
  agregar(x.medio,x.monto,"Delivery manual · "+String(x.cliente||"Sin cliente"));
 return grupos;
}
function renderAuditoriaPagos(c,fmt,esc){
 const d=c?.detalle;
 if(!d||d.version!==1)return "";
 const grupos=agruparPagosHistoricos(c);
 const valores=[...grupos.values()].flat(),total=valores.reduce((n,x)=>n+x.monto,0);
 const esperado=Object.values(c.medios||{}).reduce((n,x)=>n+(Number(x)||0),0);
 const coincide=total===esperado&&[...grupos].every(([medio,items])=>
  items.reduce((n,x)=>n+x.monto,0)===(Number(c.medios?.[medio])||0));
 return '<details style="margin:8px 0"><summary><b>💳 Pedidos por medio de pago</b> · '+fmt(total)+'</summary>'+
  '<p class="muted">Desglose congelado al cerrar. Las ventas manuales se distinguen de los pedidos. Los cobros de otro local no entran aquí.</p>'+
  (coincide?'<p class="muted">✅ Coincide con los totales guardados.</p>':
   '<p style="color:#a42b19">⚠️ El desglose no coincide exactamente con los medios guardados. Revisar.</p>')+
  ([...grupos].map(([medio,items])=>{
   const monto=items.reduce((n,x)=>n+x.monto,0);
   return '<details><summary>'+esc(medio)+' · '+items.length+' · '+fmt(monto)+'</summary>'+
    items.map(x=>'<div class="row"><span>'+esc(x.concepto)+'</span><b>'+fmt(x.monto)+'</b></div>').join("")+
    '</details>';
  }).join("")||'<p class="muted">Sin cobros registrados.</p>')+'</details>';
}
function renderAuditoriaTimbres(c,fmt,esc){
 const d=c?.detalle;
 if(!d||d.version!==1)return "";
 const elegibles=(d.pedidos||[]).filter(p=>p.pagado&&p.estado!=="Cancelado"&&
  !p.esPremio&&!p.productosPagadosOtroLocal&&String(p.cliente||"").trim());
 const enviados=elegibles.filter(p=>!!p.timbreEnviadoEn).length;
 const intentos=elegibles.filter(p=>!p.timbreEnviadoEn&&!!p.timbreWhatsAppAbiertoEn).length;
 return '<details style="margin:8px 0"><summary><b>🎫 Control de timbres del cierre</b> · '+
  elegibles.length+' generados · '+enviados+' marcados enviados</summary>'+
  '<p class="muted">Los eventos y estados fueron guardados al cerrar. Abrir WhatsApp NO es prueba de envío; «enviado» es confirmación declarada por el trabajador.</p>'+
  '<div class="row"><span>WhatsApp abierto, pendiente de confirmar</span><b>'+intentos+'</b></div>'+
  '<div class="row"><span>Timbres sin confirmación de envío</span><b>'+ (elegibles.length-enviados) +'</b></div>'+
  (elegibles.map(p=>{
   const ref=(p.codigoCarta?"Carta #"+p.codigoCarta+" · ":"")+"Interno #"+p.id;
   const estado=p.timbreEnviadoEn?'Marcado enviado por '+(p.timbreEnviadoPor||"Sin turno"):
    p.timbreWhatsAppAbiertoEn?'WhatsApp abierto, sin envío confirmado':'Sin enviar / sin confirmar';
   return '<div style="border-top:1px solid #eee;padding:7px 0"><b>'+esc(ref)+'</b> · '+
    esc(p.cliente)+(p.codigoClienteUltimos4?' · Código '+esc(p.codigoClienteUltimos4):'')+
    '<p class="muted">'+esc(estado)+'</p></div>';
  }).join("")||'<p class="muted">Sin timbres.</p>')+'</details>';
}
function render(c,fmt,esc,index,estado){
 const d=c.detalle;
 if(!d||d.version!==1)return renderGastosAnteriores(c,estado,fmt,esc);
 const row=(a,b)=>'<div class="row"><span>'+esc(a)+'</span><b>'+fmt(b)+'</b></div>';
 const section=(title,rows)=>'<details style="margin:8px 0"><summary style="cursor:pointer"><b>'+esc(title)+'</b> · '+rows.length+'</summary>'+
  (rows.length?rows.join(""):'<p class="muted">Sin movimientos</p>')+'</details>';
 const orders=(d.pedidos||[]).map(p=>row((p.codigoCarta?'Carta #'+p.codigoCarta+' · Interno #'+p.id:'Interno #'+p.id)+' · '+p.cliente+' · '+(p.pagado?'Pagado':'Sin pago')+' · '+(p.productosPagadosOtroLocal?'Cobro externo':p.medio),p.total)+
  '<p class="muted" style="margin:2px 0 5px 8px">'+esc(notaPagoPedido(p))+'</p>'+
  ((p.productos||[]).length?'<p class="muted" style="margin:0 0 8px 8px">'+esc(p.productos.map(x=>x.cantidad+'x '+x.nombre+(x.detalle?' · '+x.detalle:'')).join('; '))+'</p>':''));
 const expenses=(d.gastos||[]).map(x=>row(x.concepto+' · '+x.medio,x.monto));
 const withdrawals=(d.retiros||[]).map(x=>row(x.motivo||'Retiro',x.monto));
 const tips=(d.propinas||[]).map(x=>row('Propina · '+x.medio+(x.pedidoId?' · pedido #'+x.pedidoId:''),x.monto));
 const deliveries=(d.deliveriesManuales||[]).map(x=>row((x.cliente||'Manual')+(x.nota?' · '+x.nota:'')+' · '+x.medio,x.monto));
 const petty=(d.cajaChica?.gastos||[]).map(x=>row(x.concepto||'Caja chica',x.monto));
 const apps=Object.entries(d.apps||{}).filter(([,v])=>v).map(([name,v])=>row(name,v));
 return '<div style="background:var(--bg);border-radius:10px;padding:12px;margin:12px 0">'+
  '<h3 style="margin:0 0 7px">📋 Movimientos detallados guardados</h3>'+
  '<p class="muted">Información capturada cuando se confirmó este cierre.</p>'+
  section('Pedidos individualizados',orders)+
  renderAuditoriaPagos(c,fmt,esc)+
  renderAuditoriaTimbres(c,fmt,esc)+
  section('Gastos por concepto',expenses)+
  section('Retiros',withdrawals)+
  section('Propinas',tips)+
  section('Delivery manual',deliveries)+
  section('Ventas por app ingresadas manualmente',apps)+
  section('Caja chica (aparte)',petty)+
  row('Caja chica inicial',d.cajaChica?.inicial||0)+
  row('Pago al repartidor · '+(d.repartidor?.medio||'Efectivo'),d.repartidor?.monto||0)+
  '<button class="sm ok" onclick="descargarDetalleCierreCSV('+Number(index)+')">📊 Descargar detalle CSV</button></div>';
}
function texto(c){
 if(!c.detalle)return "Detalle individual no guardado en este cierre anterior.\n";
 const cab=["TIPO","FECHA","REFERENCIA","CONCEPTO","MONTO","MEDIO","DETALLE"];
 return [cab,...filas(c)].map(row=>row.map(v=>String(v??"").replace(/[\r\n]+/g," ")).join(" | ")).join("\n")+"\n";
}
function csv(c,seguro){
 const cab=["Tipo","Fecha","Referencia","Concepto","Monto","Medio","Detalle"];
 return [cab,...filas(c)].map(row=>row.map(seguro).join(";")).join("\n");
}
window.ukiDetalleCierre={capturar,render,texto,csv,filas,recuperarGastosAnteriores,agruparPagosHistoricos,renderAuditoriaPagos,renderAuditoriaTimbres};
})();