/* Romo La Serena · módulo del mismo panel Uki.
   Edición exclusiva de pedidos pendientes sin pago y turno abierto.
   No escribe fuera de la sesión CAS cifrada de Romo. */
(function(){
 "use strict";
 const SUC="Romo’s Sushi La Serena";
 const e=(x)=>esc(x);
 function filaProductoHTML(x,indice){
  // Una fila conserva su origen: quitarla no hereda metadatos de otra línea.
  const origen=Number.isSafeInteger(indice)&&indice>=0?indice:-1;
  return '<div class="card" data-romo-linea="1" data-romo-origen="'+origen+
   '" style="padding:10px">'+
   '<p><b>Producto del pedido</b></p>'+
   '<label>Nombre</label><input data-romo-campo="nombre" maxlength="100" value="'+e(x?.nombre||'')+'">'+
   '<label>Cantidad</label><input data-romo-campo="cantidad" type="number" min="1" max="100" step="1" value="'+e(x?.cantidad??1)+'">'+
   '<label>Precio unitario</label><input data-romo-campo="precio" type="number" min="1" max="1000000" step="1" value="'+e(x?.precioUnit??'')+'">'+
   '<label>Ingredientes / detalles</label><textarea data-romo-campo="detalle" rows="2" maxlength="12000">'+e(x?.detalle||'')+'</textarea>'+
   '<button type="button" class="sm" onclick="ukiRomoQuitarLineaPendienteQA(this)">Quitar este producto</button>'+
   '</div>';
 }
 function editor(p){
  if(!p||p.suc!==SUC||p.estado!=="Pendiente"||p.pagado||
     p.esPremio||p.productosPagadosOtroLocal||p.envioPagadoOtroLocal||
     p.timbreEnviadoEn||p.timbreEnviadoPor)return "";
  const id=Number(p.id);
  if(!Number.isSafeInteger(id)||id<1)return "";
  const productos=(p.productos||[]).map((x,i)=>filaProductoHTML(x,i)).join("");
  return '<details class="inner-details" id="romoEditarPedido'+id+'">'+
   '<summary><b>✏️ Editar pedido pendiente</b></summary>'+
   '<p class="muted">Igual que el editor de productos Uki: puedes cambiar cantidades, precios, agregar o quitar líneas. Solo antes del pago y con el turno abierto. No modifica caja, folio ni timbres.</p>'+
   '<div data-romo-productos="1">'+productos+'</div>'+
   '<button type="button" class="sm" onclick="ukiRomoAgregarLineaPendienteQA('+id+')">＋ Agregar otro producto</button>'+
   (p.modalidad==="Delivery"?
    '<label>Delivery confirmado</label><input id="romoEditarEnvio'+id+'" type="number" min="1" max="4000" step="1" value="'+e(p.envio||0)+'">':"")+
   '<label>Responsable obligatorio</label><input id="romoEditarResponsable'+id+'" maxlength="80">'+
   '<label>Motivo obligatorio del cambio</label><textarea id="romoEditarMotivo'+id+'" maxlength="300" rows="2"></textarea>'+
   '<button type="button" class="sm ok" onclick="ukiRomoGuardarEdicionPendienteQA('+id+')">Guardar cambio en Neon Romo</button></details>';
 }
 function agregarLinea(id){
  if(S.suc!==SUC||ukiRomoOperacionesEnCursoQA())return;
  const node=document.getElementById('romoEditarPedido'+Number(id));
  const cont=node?.querySelector('[data-romo-productos]');
  if(!cont)return;
  if(cont.querySelectorAll('[data-romo-linea]').length>=80)
   return window.alert('Máximo 80 productos por pedido.');
  cont.insertAdjacentHTML('beforeend',filaProductoHTML({nombre:'',cantidad:1,precioUnit:'',detalle:''},-1));
  const all=cont.querySelectorAll('[data-romo-linea] [data-romo-campo="nombre"]');
  all[all.length-1]?.focus();
 }
 function quitarLinea(boton){
  if(S.suc!==SUC||ukiRomoOperacionesEnCursoQA())return;
  const fila=boton?.closest('[data-romo-linea]');
  const lista=fila?.parentElement;
  if(!fila||!lista||!lista.closest('details[id^="romoEditarPedido"]'))return;
  if(lista.querySelectorAll('[data-romo-linea]').length<=1)
   return window.alert('El pedido debe conservar al menos un producto.');
  fila.remove();
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
  const filas=Array.from(node.querySelectorAll('[data-romo-productos] [data-romo-linea]'));
  if(!filas.length||filas.length>80)return window.alert('Revisa la cantidad de productos.');
  const productos=filas.map(fila=>{
   const origen=Number(fila.dataset.romoOrigen);
   const get=campo=>fila.querySelector('[data-romo-campo="'+campo+'"]')?.value;
   return {
    origenIndice:Number.isSafeInteger(origen)&&origen>=0?origen:null,
    nombre:String(get('nombre')||'').trim(),
    cantidad:get('cantidad'),
    precioUnit:get('precio'),
    detalle:String(get('detalle')||'').trim()
   };
  });
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
 window.ukiRomoAgregarLineaPendienteQA=agregarLinea;
 window.ukiRomoQuitarLineaPendienteQA=quitarLinea;
})();