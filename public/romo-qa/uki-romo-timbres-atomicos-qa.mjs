/**
 * Timbre de Romo La Serena: registrar la confirmación MANUAL de WhatsApp
 * sólo tras guardado cifrado y CAS en Neon. Nunca envía mensajes por sí mismo.
 * Nunca actualiza la caja, el pago ni los datos de Uki.
 */
export const ROMO_TIMBRES_ATOMICOS_HABILITADOS_QA=false;
const SUC='Romo’s Sushi La Serena';
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
/** Igual que ukiNumeroTimbreWhatsApp del panel de Uki, sin usar datos externos. */
export function telefonoTimbreRomoValidoQA(value){
 const raw=String(value||'').trim(),digits=raw.replace(/\D/g,'');
 const normal=/^09\d{8}$/.test(digits)?'56'+digits.slice(1):
  /^9\d{8}$/.test(digits)?'56'+digits:digits;
 return /^569\d{8}$/.test(normal)||
  (/^\+/.test(raw)&&/^[1-9]\d{9,14}$/.test(normal));
}
const stamp=(value,label)=>{
 const v=String(value||'');
 check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&
  Number.isFinite(Date.parse(v)),label+' inválido');
 return v;
};
export class RomoTimbreInciertoQA extends Error{
 constructor(){super('No se confirmó el timbre en Neon; consulta el pedido antes de repetir.');
  this.code='ROMO_TIMBRE_REVISAR_NEON';}
}
export class RomoTimbreConfirmadoReleerQA extends Error{
 constructor(){super('Neon guardó el timbre, pero la pantalla cambió; recarga sin reenviar.');
  this.code='ROMO_TIMBRE_CONFIRMADO_RECARGAR';}
}
export function prepararTimbreRomoQA(estado,{
 pedidoId,responsable,whatsappAbiertoEn,whatsappConfirmadoEn,envioConfirmado=false
}={}){
 check(estado?.suc===SUC&&Array.isArray(estado.pedidos),
  'El pedido no corresponde a Romo La Serena');
 const id=Number(pedidoId),actor=String(responsable??'').trim();
 check(Number.isSafeInteger(id)&&id>0,'Número de pedido Romo inválido');
 check(actor.length>=2&&actor.length<=80,'Indica quién envió el timbre');
 check(envioConfirmado===true,'Confirma el envío real del timbre por WhatsApp');
 const pedido=estado.pedidos.find(p=>p?.id===id&&p.suc===SUC);
 check(pedido,'Pedido Romo no encontrado');
 check(pedido.pagado===true&&pedido.estado!=='Cancelado'&&!pedido.esPremio,
  'El pedido debe estar pagado y no cancelado');
 // Un pedido entregado antes del cobro igualmente gana su timbre
 // cuando se verifica el pago, sin reabrir caja ni modificar la entrega.
 check(!pedido.productosPagadosOtroLocal,'Ese timbre se gestiona en el local que recibió el pago');
 check(telefonoTimbreRomoValidoQA(pedido.telefono),'El pedido no tiene WhatsApp válido');
 check(!pedido.timbreEnviadoEn&&!pedido.timbreEnviadoPor&&
  (!Array.isArray(pedido.timbreEventos)||
   !pedido.timbreEventos.some(x=>x?.tipo==='declarado_enviado')),
  'Este pedido ya tiene timbre; no se debe enviar dos veces');
 const apertura=stamp(whatsappAbiertoEn,'Apertura de WhatsApp');
 const confirmacion=stamp(whatsappConfirmadoEn,'Confirmación de timbre');
 check(Date.parse(apertura)<=Date.parse(confirmacion),
  'Primero abre WhatsApp y después confirma el envío');
 const eventos=Array.isArray(pedido.timbreEventos)?pedido.timbreEventos.slice():[];
 pedido.timbreWhatsAppAbiertoEn=apertura;
 pedido.timbreWhatsAppAbiertoPor=actor;
 pedido.timbreEnviadoEn=confirmacion;
 pedido.timbreEnviadoPor=actor;
 pedido.timbreReglaObligatoria=true;
 pedido.timbreEventos=[...eventos,
  {tipo:'whatsapp_abierto',fecha:apertura,responsable:actor},
  {tipo:'declarado_enviado',fecha:confirmacion,responsable:actor}].slice(-60);
 return Object.freeze({pedidoId:id,timbreEnviadoEn:confirmacion,responsable:actor});
}
export function crearGuardadoTimbreRomoQA({
 habilitado=ROMO_TIMBRES_ATOMICOS_HABILITADOS_QA,
 servidor,estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado
}={}){
 let ocupado=false;
 const disponible=()=>habilitado===true&&servidor?.disponible?.()===true&&
  typeof servidor.guardarSobreCifrado==='function';
 return Object.freeze({
  disponible,
  async confirmar(datos){
   check(disponible(),'Timbres Romo todavía no habilitados');
   check(!ocupado,'Ya hay un timbre Romo en proceso');
   check([estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado].every(f=>
    typeof f==='function'),'Falta conectar el panel Romo');
   const visible=estadoVisible(),revision=visible?.revision;
   check(Number.isSafeInteger(revision)&&revision>=0&&
    validarEstado(visible?.estado,SUC),'Primero carga Romo desde Neon');
   ocupado=true;
   try{
    const original=JSON.stringify(visible.estado),copia=JSON.parse(original);
    const cambio=prepararTimbreRomoQA(copia,datos);
    check(validarEstado(copia,SUC),'Timbre pertenece a otra sucursal');
    const intacto=()=>{
     const r=estadoVisible();
     return r?.revision===revision&&JSON.stringify(r.estado)===original;
    };
    check(intacto(),'Romo cambió durante la revisión del timbre');
    const snapshot=await cifrarEstado(copia);
    check(snapshot?.formato==='uki-v813-browser'&&snapshot?.sucursal===SUC,
     'No se cifró el timbre de Romo');
    check(intacto(),'Romo cambió antes de confirmar el timbre');
    let guardado;
    try{guardado=await servidor.guardarSobreCifrado({snapshot,revision})}
    catch{throw new RomoTimbreInciertoQA()}
    if(guardado?.revision!==revision+1)throw new RomoTimbreInciertoQA();
    if(!intacto())throw new RomoTimbreConfirmadoReleerQA();
    try{await aplicarConfirmado({estado:copia,revision:guardado.revision,cambio})}
    catch{throw new RomoTimbreConfirmadoReleerQA()}
    return Object.freeze({ok:true,revision:guardado.revision,cambio});
   }finally{ocupado=false}
  }
 });
}
