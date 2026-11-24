/* Revisión humana de transferencias. No consulta bancos ni registra dinero.
 * El panel clásico y los módulos de operaciones usan la misma regla. */
(function(root){
 'use strict';
 const texto=x=>String(x??'').trim();
 const entero=(x,nombre)=>{
  const n=Number(x??0);
  if(!Number.isSafeInteger(n)||n<0||n>100000000)throw Error('Revisa '+nombre+'.');
  return n;
 };
 const copia=x=>JSON.parse(JSON.stringify(x));
 function distribucion(p){
  const sub=entero(p.subtotal,'el subtotal'),env=p.modalidad==='Delivery'?entero(p.envio,'el delivery'):0;
  const fuera=(flag,raw,total)=>flag?Math.min(total,entero(raw===''||raw==null?total:raw,'el pago en otro local')):0;
  const prodFuera=fuera(p.productosPagadosOtroLocal,p.montoProductosOtroLocal,sub);
  const rawFuera=Number(p.montoProductosOtroLocal)||0;
  const envFuera=p.envioPagadoOtroLocal===undefined&&p.productosPagadosOtroLocal&&rawFuera>sub&&rawFuera<=sub+env?
   rawFuera-sub:fuera(p.envioPagadoOtroLocal,p.montoEnvioOtroLocal,env);
  const grupo=(total,medio,rows)=>{
   if(!total){if(rows?.some(x=>Number(x.monto)>0))throw Error('Revisa los pagos de un importe sin cobro local.');return [];}
   const lista=Array.isArray(rows)&&rows.length?rows:[{medio:medio||'Efectivo',monto:total}];
   const suma={};
   for(const x of lista){const m=texto(x.medio),n=entero(x.monto,'el monto por medio');if(!m||n<=0)throw Error('Completa los medios y montos de pago.');suma[m]=(suma[m]||0)+n;}
   if(Object.values(suma).reduce((a,x)=>a+x,0)!==total)throw Error('Los medios de pago deben sumar el importe local.');
   return Object.entries(suma).sort(([a],[b])=>a.localeCompare(b)).map(([medio,monto])=>({medio,monto}));
  };
  const productos=grupo(sub-prodFuera,p.medio,p.pagosProductos);
  const delivery=grupo(env-envFuera,p.medioEnvio,p.pagosEnvio);
  const propina=entero(p.propina,'la propina');
  const tip=propina?[{medio:texto(p.medioPropina||'Efectivo'),monto:propina}]:[];
  const monto=[...productos,...delivery,...tip].filter(x=>x.medio==='Transferencia').reduce((a,x)=>a+x.monto,0);
  const firmaDistribucion=JSON.stringify({version:1,subtotal:sub,envio:env,productos,delivery,
   productosOtroLocal:prodFuera,envioOtroLocal:envFuera,propina:tip});
  return {monto,firmaDistribucion};
 }
 function resumen(p){
  try{
   const d=distribucion(p),v=p.transferenciaVerificacion;
   const vigente=d.monto>0&&!p.transferenciaVerificacionInvalidadaEn&&v?.version===1&&v.tipo==='manual'&&
    Number(v.monto)===d.monto&&v.firmaDistribucion===d.firmaDistribucion&&
    texto(v.responsable).length>=2&&texto(v.responsable).length<=80&&Number.isFinite(Date.parse(v.confirmadoEn));
   return {...d,vigente,error:''};
  }catch(e){return {monto:0,firmaDistribucion:'',vigente:false,error:String(e.message||e)};}
 }
 function preparar(p,datos,registradoEn){
  const d=distribucion(p);
  if(!d.monto)return null;
  if(datos?.confirmoRevision!==true||datos.firmaDistribucion!==d.firmaDistribucion)
   throw Error('Revisa la transferencia en la cuenta bancaria y confirma los importes actuales.');
  if(datos.monto===''||datos.monto==null||entero(datos.monto,'el importe transferido')!==d.monto)
   throw Error('El importe revisado debe coincidir con la parte pagada por transferencia.');
  const responsable=texto(datos.responsable),referencia=texto(datos.referencia);
  if(responsable.length<2||responsable.length>80)throw Error('Indica quién revisó la transferencia en el banco.');
  if(referencia.length>160)throw Error('La referencia de transferencia admite hasta 160 caracteres.');
  if(!Number.isSafeInteger(registradoEn)||registradoEn<=0||!Number.isFinite(new Date(registradoEn).getTime()))throw Error('Fecha de revisión inválida.');
  return {version:1,tipo:'manual',monto:d.monto,responsable,confirmadoEn:new Date(registradoEn).toISOString(),referencia,firmaDistribucion:d.firmaDistribucion};
 }
 function registrar(p,revision){
  if(!revision)return;
  if(p.historialTransferencias!==undefined&&!Array.isArray(p.historialTransferencias))throw Error('Historial de transferencias inválido.');
  if(p.historialCambios!==undefined&&!Array.isArray(p.historialCambios))throw Error('Historial del pedido inválido.');
  const anterior=p.transferenciaVerificacion;
  p.historialTransferencias=[...(p.historialTransferencias||[]),...(anterior?[copia(anterior)]:[])];
  p.transferenciaVerificacion=copia(revision);
  delete p.transferenciaVerificacionInvalidadaEn;
  delete p.transferenciaVerificacionInvalidadaMotivo;
  p.historialCambios=[...(p.historialCambios||[]),{tipo:'transferencia_revisada_manual',fecha:revision.confirmadoEn,
   responsable:revision.responsable,motivo:'Revisión manual de '+revision.monto+' pesos en la cuenta bancaria; sin nuevo cobro.',
   anterior:anterior?copia(anterior):null,nuevo:copia(revision)}];
 }
 function validarReferencia(pedidos,pedidoId,revision,suc){
  const clave=x=>texto(x).normalize('NFKC').replace(/\s+/g,'').toLocaleUpperCase('es-CL');
  const ref=clave(revision?.referencia);if(!ref)return;
  const duplicado=(pedidos||[]).find(p=>p.suc===suc&&Number(p.id)!==Number(pedidoId)&&
   [p.transferenciaVerificacion,...(Array.isArray(p.historialTransferencias)?p.historialTransferencias:[])]
    .some(v=>v&&clave(v.referencia)===ref));
  if(duplicado)throw Error('Ese número de operación ya está registrado en el pedido #'+duplicado.id+'. Revisa el abono antes de confirmarlo otra vez.');
 }
 function invalidar(anterior,nuevo,registradoEn){
  const a=resumen(anterior),b=resumen(nuevo);
  const retiroPago=anterior.pagado===true&&nuevo.pagado!==true;
  const cambio=!!b.error||a.firmaDistribucion!==b.firmaDistribucion||retiroPago;
  if(anterior.transferenciaVerificacion&&cambio){
   nuevo.transferenciaVerificacionInvalidadaEn=nuevo.transferenciaVerificacionInvalidadaEn||new Date(registradoEn).toISOString();
   nuevo.transferenciaVerificacionInvalidadaMotivo=retiroPago?'Se retiró la confirmación de pago. Requiere nueva revisión.':'Cambió el importe o la distribución de pago. Requiere nueva revisión.';
  }
  if(anterior.estado==='Entregado'&&(cambio||(!anterior.ajusteCobroPendiente&&nuevo.ajusteCobroPendiente))&&bloqueo(nuevo)){
   nuevo.estado='Pendiente';
   nuevo.entregaReabiertaEn=new Date(registradoEn).toISOString();
   nuevo.motivoReapertura='Corrección de pago: resolver diferencia o revisión de transferencia antes de finalizar.';
  }
 }
 function bloqueo(p){
  if(p?.estado==='Cancelado'||p?.esPremio)return '';
  if(p?.ajusteCobroPendiente)return 'Regulariza la diferencia de cobro antes de entregar o cerrar este pedido.';
  const r=resumen(p);
  if(r.error)return r.error;
  if(!r.monto)return '';
  if(p.pagado!==true)return 'Confirma el pago y revisa la transferencia de '+r.monto.toLocaleString('es-CL')+' pesos antes de entregar o cerrar.';
  return r.vigente?'':'Falta revisar manualmente la transferencia de '+r.monto.toLocaleString('es-CL')+' pesos para los importes actuales.';
 }
 root.ukiRomoTransferenciasQA=Object.freeze({distribucion,resumen,preparar,registrar,invalidar,bloqueo,validarReferencia});
})(globalThis);
