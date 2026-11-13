/**
 * Romo La Serena: transforma la solicitud de SU carta al mismo borrador
 * de «Nuevo pedido» del panel Uki. NO registra venta ni cobra.
 * Los precios NO se deducen del mensaje de WhatsApp; requieren revisión.
 */
const STORE='romo:serena';
const BRANCH='Romo’s Sushi La Serena';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const phone=s=>String(s||'').replace(/\D/g,'');
function mensajeRomoValido(row){
 const msg=row.mensaje;
 if(typeof msg!=='string'||msg.length<40||msg.length>12000||
    !/\*ROMO[’']S SUSHI\*/i.test(msg)||
    !msg.includes('*COCINA*')||!msg.includes('*ENTREGA*')||
    !msg.includes('*PAGO*'))return false;
 const code=msg.match(/^N\.º de pedido:\s*([A-Za-z0-9_-]{3,60})\s*$/m)?.[1]||'';
 const customer=msg.match(/^Cliente:\s*(.+)\s*$/m)?.[1]?.trim()||'';
 const mobile=msg.match(/^WhatsApp:\s*(\+?[\d ()-]{8,24})\s*$/m)?.[1]||'';
 const store=msg.match(/^Sucursal:\s*(.+)\s*$/m)?.[1]?.trim()||'';
 return code===row.codigo_pedido&&customer===row.cliente.trim()&&
  phone(mobile)===phone(row.telefono)&&
  /^\s*Romo[’']s Sushi La Serena\s*$/i.test(store);
}
export function prepararBorradorSolicitudRomoQA(row,registrados=[]){
 if(!row||typeof row!=='object'||Array.isArray(row)||row.store_id!==STORE||
    !UUID.test(row.id||'')||row.estado!=='pendiente'||row.en_reserva===true||
    String(row.pedido_interno||'').trim()||
    !/^[A-Za-z0-9_-]{3,60}$/.test(row.codigo_pedido||'')||
    typeof row.cliente!=='string'||row.cliente.trim().length<2||
    typeof row.telefono!=='string'||phone(row.telefono).length<9||
    !mensajeRomoValido(row))
  throw Error('La solicitud de Romo cambió o no coincide con su carta');
 if(!Array.isArray(registrados)||registrados.some(p=>
    p?.suc===BRANCH&&String(p.cartaSolicitudRemotaId||'')===row.id))
  throw Error('Esta solicitud de Romo ya está registrada en el historial');
 const kitchen=row.mensaje.split('*COCINA*')[1]?.split('*ENTREGA*')[0]||'';
 const headings=[...kitchen.matchAll(/^\*[−-]\s*(\d{1,2})\s*[×x]\s*([^*\r\n]{2,140})\*$/gm)];
 if(!headings.length||headings.length>40)
  throw Error('El mensaje no contiene productos reconocibles; revisa la solicitud original');
 const items=headings.map((match,i)=>{
  const cant=Number(match[1]),nombre=match[2].trim();
  if(!Number.isSafeInteger(cant)||cant<1||cant>20||!nombre||/pizza/i.test(nombre))
   throw Error('Romo recibió un producto o cantidad inválidos');
  const inicio=match.index+match[0].length;
  const fin=i+1<headings.length?headings[i+1].index:kitchen.length;
  return Object.freeze({nombre:nombre.slice(0,120),cant,precio:0,
   det:kitchen.slice(inicio,fin).trim().slice(0,1400)});
 });
 const delivery=/\*ENTREGA\*\s*\nDelivery(?:\r?\n|$)/i.test(row.mensaje);
 const consume=/\*ENTREGA\*\s*\nCONSUMO/i.test(row.mensaje);
 const shipping=row.mensaje.match(/^Delivery:\s*\$\s*([\d.]+)\s*$/m)?.[1];
 const envio=delivery&&shipping?Number(shipping.replace(/\./g,'')):0;
 if(!Number.isSafeInteger(envio)||envio<0||envio>100000)
  throw Error('Monto de delivery Romo inválido');
 const medio=/^Pago:\s*(Efectivo|Transferencia|Débito|Edenred)\b/im.exec(row.mensaje)?.[1]||'Efectivo';
 const result={
  texto:row.mensaje,cliente:row.cliente.trim(),telefono:row.telefono,
  codigoCarta:row.codigo_pedido,codigoCliente:phone(row.telefono).slice(-4),
  cartaSolicitudRemotaId:row.id,cartaReservaToken:'',
  sucursalCarta:BRANCH,modalidad:delivery?'Delivery':consume?'Consumo en local':'Retiro',
  envio,medio,medioEnvio:medio,pagado:false,editando:null,items,
  necesitaRevisarPrecios:true,confirmoPago:false
 };
 return Object.freeze(result);
}
export const ROMO_BORRADOR_PENDIENTE_NO_ES_VENTA=true;
