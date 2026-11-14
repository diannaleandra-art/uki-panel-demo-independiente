/**
 * Romo La Serena: confirmar entrega de un pedido. MISMA regla Uki:
 * sólo Pendiente y no premios; timbre obligatorio si corresponde.
 * No cambia pagado, importes ni caja. Historial de modificación y
 * persistencia CAS + AES-GCM, sin escribir en Uki.
 */
export const ROMO_ENTREGAS_HABILITADAS_QA=false;
const SUC='Romo’s Sushi La Serena';
const fail=msg=>{throw Error(msg)};
export class RomoEntregaInciertaQA extends Error{
 constructor(){super('No se confirmó la entrega. Consulta Neon antes de repetir.');
  this.code='ROMO_ENTREGA_REVISAR_NEON';}
}
export class RomoEntregaConfirmadaReleerQA extends Error{
 constructor(){super('Entrega confirmada pero la pantalla cambió; recarga sin duplicar.');
  this.code='ROMO_ENTREGA_CONFIRMADA_RECARGAR';}
}
export function prepararEntregaRomoQA(estado,{pedidoId,responsable,registradoEn}={}){
 if(estado?.suc!==SUC||!Array.isArray(estado.pedidos))fail('No es el estado de Romo');
 const id=Number(pedidoId),actor=String(responsable||'').trim();
 if(!Number.isSafeInteger(id)||id<=0)fail('Pedido de Romo inválido');
 if(actor.length<2||actor.length>80)fail('Responsable de entrega obligatorio');
 if(!Number.isSafeInteger(registradoEn)||registradoEn<=0||
    !Number.isFinite(new Date(registradoEn).getTime()))
  fail('Fecha de entrega inválida');
 const pedido=estado.pedidos.find(x=>x?.suc===SUC&&x.id===id);
 if(!pedido||pedido.estado!=='Pendiente'||pedido.esPremio)
  fail('Solo se puede entregar un pedido pendiente de Romo');
 const numero=String(pedido.telefono||'').replace(/\D/g,'');
 if(pedido.timbreReglaObligatoria===true&&pedido.pagado===true&&
    numero.length>=8&&!pedido.timbreEnviadoEn)
  fail('Primero envía y confirma el timbre WhatsApp');
 const anterior=pedido.estado;
 if(pedido.historialCambios!==undefined&&!Array.isArray(pedido.historialCambios))
  fail('Historial del pedido inválido');
 pedido.estado='Entregado';
 pedido.entregadoEn=new Date(registradoEn).toISOString();
 pedido.entregadoPor=actor;
 pedido.historialCambios=[...(pedido.historialCambios||[]),{
  tipo:'entrega_confirmada',fecha:pedido.entregadoEn,responsable:actor,
  anterior,nuevo:'Entregado'
 }].slice(-100);
 return Object.freeze({pedidoId:id,estado:'Entregado',responsable:actor});
}
export function crearGuardadoEntregaRomoQA({
 habilitado=ROMO_ENTREGAS_HABILITADAS_QA,
 servidor,estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado
}={}){
 let ocupado=false;
 const disponible=()=>habilitado===true&&servidor?.disponible?.()===true&&
  typeof servidor.guardarSobreCifrado==='function';
 return Object.freeze({
  disponible,
  async entregar(datos){
   if(!disponible())fail('Entregas de Romo no habilitadas');
   if(ocupado)fail('Ya hay una entrega Romo en curso');
   if([estadoVisible,validarEstado,cifrarEstado,aplicarConfirmado]
       .some(f=>typeof f!=='function'))fail('Falta conectar el panel de Romo');
   const v=estadoVisible(),revision=v?.revision;
   if(!Number.isSafeInteger(revision)||revision<0||
      !validarEstado(v?.estado,SUC))fail('Carga Romo desde Neon antes de entregar');
   ocupado=true;
   try{
    const antes=JSON.stringify(v.estado),copia=JSON.parse(antes);
    const cambio=prepararEntregaRomoQA(copia,datos);
    if(!validarEstado(copia,SUC))fail('Copia de Romo inválida');
    const intacto=()=>{
     const ahora=estadoVisible();
     return ahora?.revision===revision&&JSON.stringify(ahora.estado)===antes;
    };
    if(!intacto())fail('El pedido cambió antes de confirmar');
    const snapshot=await cifrarEstado(copia);
    if(snapshot?.formato!=='uki-v813-browser'||snapshot?.sucursal!==SUC)
     fail('Cifrado de entrega Romo incorrecto');
    if(!intacto())fail('El pedido cambió mientras se cifraba');
    let res;
    try{res=await servidor.guardarSobreCifrado({snapshot,revision})}
    catch{throw new RomoEntregaInciertaQA()}
    if(res?.revision!==revision+1)throw new RomoEntregaInciertaQA();
    if(!intacto())throw new RomoEntregaConfirmadaReleerQA();
    try{await aplicarConfirmado({estado:copia,revision:res.revision,cambio})}
    catch{throw new RomoEntregaConfirmadaReleerQA()}
    return Object.freeze({ok:true,revision:res.revision,cambio});
   }finally{ocupado=false}
  }
 });
}
