/**
 * Romo — cálculo SOLO DE CONSULTA previo a corregir un pedido pagado.
 * Reutiliza las reglas de monto del formulario oficial de Uki:
 * productos, envío, propina opcional y métodos de pago individuales/mixtos.
 * NO registra nuevos ingresos, devoluciones, propinas, caja ni pedidos.
 * La corrección financiera permanecerá bloqueada hasta conciliación CAS.
 */
export const ROMO_DIFERENCIAS_SOLO_LECTURA_QA=true;
const SUC='Romo’s Sushi La Serena';
const MEDIOS=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const APP=new Set(['Uber Eats','PedidosYa','Rappi']);
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
const group=rows=>{
 const ret=Object.fromEntries(MEDIOS.map(k=>[k,0]));
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
export function calcularDiferenciaPagadaRomoQA(p,d){
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
 const productosPerm=MEDIOS;
 const deliveryPerm=MEDIOS.filter(x=>!APP.has(x));
 const oldSale=[
  ...toLines(p,'productos',antesSub,productosPerm),
  ...toLines(p,'delivery',antesEnv,deliveryPerm)
 ];
 const newSale=[
  ...toLines(d,'productos',despuesSub,productosPerm,true),
  ...toLines(d,'delivery',despuesEnv,deliveryPerm,true)
 ];
 const oldBy=group(oldSale),newBy=group(newSale);
 const diferencias=MEDIOS.map(m=>({
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
