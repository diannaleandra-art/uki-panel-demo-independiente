/* Uki Sushi: detalle histórico inmutable por cierre. No escribe en la nube. */
(function(){
"use strict";
function capturar(S,caja,delSucHoy){
 const copia=(arr,campos)=>delSucHoy(arr||[]).map(x=>{
  const o={};for(const k of campos)o[k]=x[k]??"";return o;
 });
 const pedidos=delSucHoy(S.pedidos||[]).map(p=>({
  id:p.id,codigoCarta:p.codigoCarta||"",cliente:p.cliente||"Sin nombre",
  fechaISO:p.fechaISO||"",pagado:!!p.pagado,estado:p.estado||"",
  esPremio:!!p.esPremio,medio:p.medio||"",medioEnvio:p.medioEnvio||"",
  modalidad:p.modalidad||"",subtotal:Number(p.subtotal)||0,envio:Number(p.envio)||0,
  total:Number(p.total)||0,
  productos:(p.productos||[]).map(z=>({
    nombre:z.nombre||"",cantidad:Number(z.cantidad)||0,
    precioUnit:Number(z.precioUnit)||0,detalle:z.detalle||""
  }))
 }));
 return {
  version:1,pedidos,
  gastos:copia(S.gastos,["id","fechaISO","concepto","monto","medio"]),
  retiros:copia(S.retiros,["id","fechaISO","motivo","monto"]),
  propinas:copia(S.propinas,["id","fechaISO","monto","medio"]),
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
  r.push(["Pedido",p.fechaISO,p.codigoCarta||p.id,p.cliente,p.total,p.medio,
   (p.pagado?"Pagado":"Sin pago")+"; "+p.modalidad+"; envío "+p.envio+"; "+it]);
 }
 for(const x of d.gastos||[])r.push(["Gasto",x.fechaISO,x.id,x.concepto,x.monto,x.medio,""]);
 for(const x of d.retiros||[])r.push(["Retiro",x.fechaISO,x.id,x.motivo,x.monto,"Efectivo",""]);
 for(const x of d.propinas||[])r.push(["Propina",x.fechaISO,x.id,"Propina",x.monto,x.medio,"Aparte"]);
 for(const x of d.deliveriesManuales||[])r.push(["Delivery manual",x.fechaISO,x.id,x.cliente,x.monto,x.medio,x.nota]);
 for(const x of d.cajaChica?.gastos||[])r.push(["Caja chica","","",x.concepto,x.monto,"Caja chica","No suma al total general de gastos"]);
 for(const [nombre,monto] of Object.entries(d.apps||{}))if(monto)r.push(["Venta app manual","","",nombre,monto,nombre,""]);
 if(d.repartidor?.monto)r.push(["Pago repartidor","","","Repartidor",d.repartidor.monto,d.repartidor.medio,""]);
 return r;
}
function render(c,fmt,esc,index){
 const d=c.detalle;
 if(!d||d.version!==1)return '<p class="muted">Cierre anterior a la mejora: los totales están guardados, pero no se registró una copia detallada de sus conceptos. No se pueden reconstruir con certeza.</p>';
 const row=(a,b)=>'<div class="row"><span>'+esc(a)+'</span><b>'+fmt(b)+'</b></div>';
 const section=(title,rows)=>'<details style="margin:8px 0"><summary style="cursor:pointer"><b>'+esc(title)+'</b> · '+rows.length+'</summary>'+
  (rows.length?rows.join(""):'<p class="muted">Sin movimientos</p>')+'</details>';
 const orders=(d.pedidos||[]).map(p=>row('#'+(p.codigoCarta||p.id)+' · '+p.cliente+' · '+(p.pagado?'Pagado':'Sin pago')+' · '+p.medio,p.total)+
  ((p.productos||[]).length?'<p class="muted" style="margin:0 0 8px 8px">'+esc(p.productos.map(x=>x.cantidad+'x '+x.nombre+(x.detalle?' · '+x.detalle:'')).join('; '))+'</p>':''));
 const expenses=(d.gastos||[]).map(x=>row(x.concepto+' · '+x.medio,x.monto));
 const withdrawals=(d.retiros||[]).map(x=>row(x.motivo||'Retiro',x.monto));
 const tips=(d.propinas||[]).map(x=>row('Propina · '+x.medio,x.monto));
 const deliveries=(d.deliveriesManuales||[]).map(x=>row((x.cliente||'Manual')+(x.nota?' · '+x.nota:'')+' · '+x.medio,x.monto));
 const petty=(d.cajaChica?.gastos||[]).map(x=>row(x.concepto||'Caja chica',x.monto));
 const apps=Object.entries(d.apps||{}).filter(([,v])=>v).map(([name,v])=>row(name,v));
 return '<div style="background:var(--bg);border-radius:10px;padding:12px;margin:12px 0">'+
  '<h3 style="margin:0 0 7px">📋 Movimientos detallados guardados</h3>'+
  '<p class="muted">Información capturada cuando se confirmó este cierre.</p>'+
  section('Pedidos individualizados',orders)+
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
window.ukiDetalleCierre={capturar,render,texto,csv,filas};
})();