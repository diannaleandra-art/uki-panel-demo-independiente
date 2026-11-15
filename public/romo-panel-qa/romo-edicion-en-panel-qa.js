/* Romo La Serena · módulo del mismo panel Uki.
   Edición exclusiva de pedidos pendientes sin pago y turno abierto.
   No escribe fuera de la sesión CAS cifrada de Romo. */
(function(){
 "use strict";
 const SUC="Romo’s Sushi La Serena";
 const e=(x)=>esc(x);
 function editor(p){
  if(!p||p.suc!==SUC||p.estado!=="Pendiente"||p.pagado||
     p.esPremio||p.productosPagadosOtroLocal||p.envioPagadoOtroLocal||
     p.timbreEnviadoEn||p.timbreEnviadoPor)return "";
  const id=Number(p.id);
  if(!Number.isSafeInteger(id)||id<1)return "";
  const productos=(p.productos||[]).map((x,i)=>
   '<div class="card" style="padding:10px">'+
   '<p><b>Producto '+e(i+1)+'</b></p>'+
   '<label>Nombre</label><input id="romoEditarNombre'+id+'_'+i+'" maxlength="100" value="'+e(x.nombre||"")+'">'+
   '<label>Cantidad</label><input id="romoEditarCantidad'+id+'_'+i+'" type="number" min="1" max="100" step="1" value="'+e(x.cantidad)+'">'+
   '<label>Precio unitario</label><input id="romoEditarPrecio'+id+'_'+i+'" type="number" min="1" max="1000000" step="1" value="'+e(x.precioUnit)+'">'+
   '<label>Ingredientes / detalles</label><textarea id="romoEditarDetalle'+id+'_'+i+'" rows="2" maxlength="12000">'+e(x.detalle||"")+'</textarea></div>'
  ).join("");
  return '<details class="inner-details" id="romoEditarPedido'+id+'">'+
   '<summary><b>✏️ Editar pedido pendiente</b></summary>'+
   '<p class="muted">Requiere turno original abierto; no modifica caja, folio, timbre ni un pedido pagado. Conserva la misma cantidad de líneas de producto.</p>'+
   productos+
   (p.modalidad==="Delivery"?'<label>Delivery confirmado</label><input id="romoEditarEnvio'+id+'" type="number" min="0" max="100000" step="1" value="'+e(p.envio||0)+'">':"")+
   '<label>Responsable obligatorio</label><input id="romoEditarResponsable'+id+'" maxlength="80">'+
   '<label>Motivo obligatorio del cambio</label><textarea id="romoEditarMotivo'+id+'" maxlength="300" rows="2"></textarea>'+
   '<button type="button" class="sm ok" onclick="ukiRomoGuardarEdicionPendienteQA('+id+')">Guardar cambio en Neon Romo</button></details>';
 }
 function historial(p){
  const eventos=Array.isArray(p?.historialCambios)?p.historialCambios.filter(x=>
   x?.tipo==="edicion_pedido_sin_pago"):[];
  if(!eventos.length)return "";
  return '<details class="inner-details"><summary>📝 Historial de ediciones · '+eventos.length+'</summary>'+
   eventos.slice(-20).reverse().map(x=>
    '<div class="card" style="padding:10px"><p><b>'+e(x.fecha||"Sin fecha")+
    ' · '+e(x.responsable||"Sin responsable")+'</b></p>'+
    '<p>Motivo: '+e(x.motivo||"Sin registrar")+'</p>'+
    '<p>Antes: '+fmt(Number(x.anterior?.total)||0)+
    ' · Después: '+fmt(Number(x.nuevo?.total)||0)+'</p>'+
    '<details><summary>Ver productos antes y después</summary>'+
    '<p>Antes: '+e((x.anterior?.productos||[]).map(z=>
     z.cantidad+'× '+z.nombre+' ($'+z.precioUnit+')').join(" | "))+'</p>'+
    '<p>Después: '+e((x.nuevo?.productos||[]).map(z=>
     z.cantidad+'× '+z.nombre+' ($'+z.precioUnit+')').join(" | "))+'</p>'+
    '</details></div>'
   ).join("")+'</details>';
 }
 async function guardar(id){
  if(S.suc!==SUC||ukiRomoOperacionesEnCursoQA())return;
  const pedidoId=Number(id),p=S.pedidos.find(x=>x.suc===SUC&&x.id===pedidoId);
  const node=document.getElementById("romoEditarPedido"+pedidoId);
  if(!node||!p||p.estado!=="Pendiente"||p.pagado)
   return window.alert("Este pedido ya no se puede editar por esta vía.");
  const responsable=String(document.getElementById("romoEditarResponsable"+pedidoId)?.value||"").trim();
  const motivo=String(document.getElementById("romoEditarMotivo"+pedidoId)?.value||"").trim();
  if(responsable.length<2||responsable.length>80||motivo.length<4||motivo.length>300)
   return window.alert("Completa responsable y motivo del cambio.");
  const productos=(p.productos||[]).map((item,i)=>({
   nombre:String(document.getElementById("romoEditarNombre"+pedidoId+"_"+i)?.value||"").trim(),
   cantidad:document.getElementById("romoEditarCantidad"+pedidoId+"_"+i)?.value,
   precioUnit:document.getElementById("romoEditarPrecio"+pedidoId+"_"+i)?.value,
   detalle:String(document.getElementById("romoEditarDetalle"+pedidoId+"_"+i)?.value||"").trim()
  }));
  const envio=p.modalidad==="Delivery"?
   document.getElementById("romoEditarEnvio"+pedidoId)?.value:0;
  if(!window.confirm("¿Confirmas modificar el pedido #"+pedidoId+
    "? Debe guardarse en Neon Romo y quedará registrado el responsable."))return;
  ukiRomoOperandoPedidoQA=true;
  try{
   const copia=datosSoloSucursal();
   const mod=await import("./uki-romo-edicion-atomica-qa.mjs");
   const res=mod.prepararEdicionPendienteRomoQA(copia,{
    pedidoId,responsable,motivo,registradoEn:Date.now(),productos,envio
   });
   if(res.pedidoId!==pedidoId)throw Error("La edición no coincide con el pedido.");
   await ukiRomoGuardarOperacionQA(copia,"Edición auditada guardada",pedidoId,"pedidos");
  }catch(error){
   window.alert("No se confirmó la edición. Revisa el pedido en Neon antes de repetir: "+
    String(error?.message||error));
  }finally{ukiRomoOperandoPedidoQA=false;}
 }
 window.ukiRomoEditorPedidoQA=editor;
 window.ukiRomoHistorialEdicionQA=historial;
 window.ukiRomoGuardarEdicionPendienteQA=guardar;
})();