/* Romo La Serena: los siete movimientos oficiales de Uki, usando únicamente
   la sesión cifrada CAS de Romo. No enlazar jamás con las APIs de Uki. */
(function(){
'use strict';
let ocupado=false;
const SUC='Romo’s Sushi La Serena';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dinero=n=>'$'+Number(n||0).toLocaleString('es-CL');
const opcionesMedio=['Efectivo','Transferencia','Débito','Edenred','Otros'];
const medios=opcionesMedio.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
const form=(titulo,contenido)=>'<details class="card" open><summary><b>'+titulo+'</b></summary>'+contenido+'</details>';
const boton=(tipo,texto)=>'<button type="button" class="big" style="background:#b51c30;color:#fff" onclick="romoMovimientosGuardarQA(\''+tipo+'\')">'+texto+'</button>';
function formularioApp(caja){
 const items=(caja?.movimientosApps||[]).slice(-10).reverse().map(x=>
  '<p class="muted">'+esc(x.medio)+' · '+esc(x.concepto)+' · '+dinero(x.monto)+'</p>').join('');
 return form('💳 Ventas manuales por app',
  '<p class="muted">Solo si no se registraron como pedido. Se incorporan a la venta una sola vez.</p>'+
  '<label>Plataforma</label><select id="romoAppTipoParidad"><option>Uber Eats</option><option>PedidosYa</option><option>Rappi</option><option>Otros</option></select>'+
  '<label>Concepto</label><input id="romoAppConceptoParidad" maxlength="180" placeholder="Venta externa no registrada como pedido">'+
  '<label>Monto recibido</label><input id="romoAppMontoParidad" type="number" inputmode="numeric" min="1" max="100000000">'+
  boton('app_manual','Guardar venta manual en Romo')+
  (items||'<p class="muted">Sin movimientos manuales de apps en el turno.</p>'));
}
function formularioPropina(){
 return form('💰 Propina manual',
  '<p class="muted">No se suma como venta. Usa el folio de un pedido real pagado de Romo, todavía sin cierre. No se duplica la propina del pedido.</p>'+
  '<label>Número de pedido (Carta o Interno)</label><input id="romoPropinaPedidoParidad" maxlength="90" placeholder="Carta 457 o Interno 244">'+
  '<label>Concepto</label><input id="romoPropinaConceptoParidad" maxlength="180" placeholder="Propina del cliente">'+
  '<label>Medio recibido</label><select id="romoPropinaMedioParidad">'+medios+'</select>'+
  '<label>Monto</label><input id="romoPropinaMontoParidad" type="number" inputmode="numeric" min="1" max="10000000">'+
  '<label>Responsable</label><input id="romoPropinaResponsableParidad" maxlength="80" placeholder="Nombre de quien registra">'+
  boton('propina_manual','Guardar propina real'));
}
function formularioCajaChica(caja){
 const chica=caja?.cajaChica||{},gastado=(chica.gastos||[]).reduce((s,x)=>s+Number(x.monto||0),0);
 const libre=Math.max(0,Number(chica.inicial||0)-gastado);
 return form('🧰 Caja chica',
  '<p class="muted">Disponible declarado: <b>'+dinero(libre)+'</b>. No es una venta ni se resta dos veces de Caja.</p>'+
  '<label>Concepto del gasto</label><input id="romoChicaConceptoParidad" maxlength="180" placeholder="Insumo pagado con caja chica">'+
  '<label>Importe</label><input id="romoChicaMontoParidad" type="number" inputmode="numeric" min="1" max="100000000">'+
  boton('caja_chica','Registrar gasto de caja chica'));
}
function tramo(markup){
 const container=document.createElement('div');container.innerHTML=markup;
 const grupos={gastos:[],apps:[],delivery:[],repartidor:[],propinas:[],retiros:[],chica:[]};
 const base=[];
 let encontradas=0;
 for(const node of [...container.children]){
  const titulo=(node.querySelector('summary')?.textContent||'').trim().toLocaleLowerCase('es-CL');
  const html=node.outerHTML;
  if(titulo.includes('establecer base'))base.push(html);
  else if(titulo.includes('gastos del local')){grupos.gastos.push(html);encontradas++;}
  else if(titulo.includes('retiros de efectivo')){grupos.retiros.push(html);encontradas++;}
  else if(titulo.includes('deliverys manuales')){grupos.delivery.push(html);encontradas++;}
  else if(titulo.includes('pago al repartidor')){grupos.repartidor.push(html);encontradas++;}
  else grupos.delivery.push(html); // Conserva el desglose oficial de repartos.
 }
 return {grupos,base,encontradas};
}
window.romoMovimientosParidadQA=function(markup){
 if(S.suc!==SUC)return markup;
 const {grupos,base,encontradas}=tramo(markup);
 if(encontradas<4)return markup; // Nunca ocultar el formulario previo si cambia el HTML.
 const caja=cajaDelDia();
 grupos.apps=[formularioApp(caja)];
 grupos.propinas=[formularioPropina()];
 grupos.chica=[formularioCajaChica(caja)];
 const elegido=MOV_TABS.some(([k])=>k===movimientoTab)?movimientoTab:'gastos';
 const menu='<div class="card uki-navegacion-compacta uki-navegacion-movimientos">'+
  '<label for="romoMovimientoIrA"><b>Elegir tipo de movimiento</b></label>'+
  '<select id="romoMovimientoIrA" onchange="cambiarMovimientoTab(this.value)">'+
  MOV_TABS.map(([k,l])=>'<option value="'+esc(k)+'"'+(elegido===k?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>'+
  '<div class="movement-tabs" role="group" aria-label="Siete movimientos de Caja">'+
  MOV_TABS.map(([k,l])=>'<button type="button" class="'+(k===elegido?'selected':'')+
    '" onclick="cambiarMovimientoTab(\''+k+'\')">'+esc(l)+'</button>').join('')+'</div></div>';
 return menu+base.join('')+((grupos[elegido]||[]).join('')||
  '<div class="card">El formulario de esta sección todavía no está disponible. No se modificó Caja.</div>');
};
function campo(id,min=1,max=100000000){
 const v=String(document.getElementById(id)?.value??'').trim(),n=Number(v);
 if(v===''||!Number.isSafeInteger(n)||n<min||n>max)throw Error('Indica un monto correcto.');
 return n;
}
function texto(id,max=180,min=2){
 const t=String(document.getElementById(id)?.value||'').trim().replace(/\s+/g,' ');
 if(t.length<min||t.length>max)throw Error('Completa los datos de este movimiento.');
 return t;
}
function elegirPedido(){
 const raw=texto('romoPropinaPedidoParidad',90,1);
 const tipo=/^carta\b/i.test(raw)?'carta':/^(?:interno|pedido\s+interno)\b/i.test(raw)?'interno':'auto';
 const ref=raw.replace(/^(?:carta|pedido\s+interno|interno)\s*#?\s*/i,'').replace(/^#/,'').trim();
 if(!ref)throw Error('Indica el folio del pedido.');
 const coinciden=(S.pedidos||[]).filter(p=>p?.suc===SUC&&(
  tipo==='carta'?String(p.codigoCarta||'')===ref:
  tipo==='interno'?String(p.id)===ref:
  String(p.id)===ref||String(p.codigoCarta||'')===ref
 ));
 if(coinciden.length!==1)throw Error(coinciden.length?'Folio ambiguo: utiliza Carta o Interno.':'No se encontró el pedido real de Romo.');
 return coinciden[0];
}
window.romoMovimientosGuardarQA=async function(tipo){
 if(!['app_manual','propina_manual','caja_chica'].includes(tipo)||ocupado||
    S.suc!==SUC||ukiRomoOperacionesEnCursoQA())return;
 const sesion=window.ukiRomoSesionRemotaQA;
 let copia,datos,descripcion;
 try{
  if(!sesion?.disponible()||sesion.estado().conflicto)
   throw Error('Reabre Romo con Google de dueños y revisa la última revisión de Neon.');
  const fechaOperativa=fechaOperativaActual(),caja=S.cajasDiarias?.[SUC+'|'+fechaOperativa];
  if(caja?.turnoAbierto!==true||caja.baseConfirmada!==true)
   throw Error('Primero abre el turno y confirma la base de caja real. No se guardó nada.');
  const registradoEn=Date.now(),fechaISO=new Date(registradoEn).toISOString();
  datos={registradoEn,fechaISO,fechaOperativa};
  if(tipo==='app_manual'){
   datos.medioApp=String(document.getElementById('romoAppTipoParidad')?.value||'');
   datos.concepto=texto('romoAppConceptoParidad');
   datos.monto=campo('romoAppMontoParidad');
   descripcion='Venta manual de '+datos.medioApp+' · '+dinero(datos.monto);
  }else if(tipo==='propina_manual'){
   const p=elegirPedido();
   if(Number(p.propina||0)>0||(S.propinas||[]).some(x=>x.suc===SUC&&Number(x.pedidoId)===Number(p.id)))
    throw Error('Este pedido ya tiene propina; no se debe duplicar.');
   if(typeof ukiCierreConfirmadoPedido==='function'&&ukiCierreConfirmadoPedido(p))
    throw Error('El pedido pertenece a un cierre definitivo. No se altera un cierre anterior.');
   datos.pedidoId=p.id;
   datos.concepto=texto('romoPropinaConceptoParidad');
   datos.medio=String(document.getElementById('romoPropinaMedioParidad')?.value||'');
   datos.monto=campo('romoPropinaMontoParidad',1,10000000);
   datos.responsable=texto('romoPropinaResponsableParidad',80);
   descripcion='Propina para pedido #'+p.id+' · '+dinero(datos.monto);
  }else{
   datos.concepto=texto('romoChicaConceptoParidad');
   datos.monto=campo('romoChicaMontoParidad');
   descripcion='Gasto de caja chica · '+dinero(datos.monto);
  }
  copia=datosSoloSucursal();
  const modulo=await import('./uki-romo-movimientos-atomicos-qa.mjs');
  const cambio=modulo.moverCajaRomoCandidatoQA(copia,{tipo,datos});
  if(!cambio||!validarEstadoSucursal(copia,SUC))
   throw Error('El movimiento no pasó la revisión de datos propios de Romo.');
  if(!window.confirm('ROMO LA SERENA · CONFIRMAR MOVIMIENTO REAL\n'+
    descripcion+'\n¿Confirmas que este dinero realmente corresponde a Romo?'))return;
 }catch(error){aviso('No se guardó: '+String(error?.message||error));return;}
 ocupado=true;ukiRomoOperandoPedidoQA=true;
 try{await ukiRomoGuardarOperacionQA(copia,descripcion,null,'caja');}
 catch(error){aviso('Movimiento sin confirmación. No lo repitas hasta volver a leer Caja y Neon: '+String(error?.message||error));}
 finally{ocupado=false;ukiRomoOperandoPedidoQA=false;}
};
})();