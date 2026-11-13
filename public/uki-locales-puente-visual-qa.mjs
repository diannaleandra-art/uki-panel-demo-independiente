/**
 * Puente de diseño privado → carta Romo. No envía tokens, PIN, pedidos ni caja.
 * Solo perfil visual permitido y siempre en modo QA.
 */
import {validarVinculoRomoQA} from './uki-locales-motor-qa.mjs';
export const ROMO_VISUAL_PREVIEW_QA_ENABLED=false;
const CAMPOS=['color','direccion','horarios','instagram','logoUrl','nombre','portadaUrl','whatsapp'];
const fail=msg=>{throw Error(msg)};
const safeUrl=x=>{
 if(x==='')return '';
 if(typeof x!=='string'||x.length>500)fail('Imagen inválida');
 let u;try{u=new URL(x)}catch{fail('URL de imagen inválida')}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search)
  fail('Enlace de imagen no permitido');
 return u.href;
};
export function crearMensajeVisualRomoQA(vinculo){
 validarVinculoRomoQA(vinculo);
 const c=vinculo.carta.identidad;
 if(!c||typeof c!=='object'||Array.isArray(c)||
    Object.keys(c).sort().join('|')!==CAMPOS.join('|'))
  fail('La carta solo recibe los campos visuales autorizados');
 const identidad={
  nombre:c.nombre,direccion:c.direccion,whatsapp:c.whatsapp,
  instagram:c.instagram,horarios:c.horarios,color:c.color,
  logoUrl:safeUrl(c.logoUrl),portadaUrl:safeUrl(c.portadaUrl)
 };
 if(typeof identidad.nombre!=='string'||identidad.nombre.trim().length<3||
    typeof identidad.direccion!=='string'||identidad.direccion.length<5||
    !/^#[0-9a-f]{6}$/i.test(identidad.color))
  fail('Identidad visual incompleta');
 return Object.freeze({
  protocolo:'uki-romo-vista-qa-v1',
  storeId:'romo:serena',
  revision:vinculo.revision,
  soloVistaPrevia:true,
  identidad:Object.freeze(identidad)
 });
}
export function enviarVistaRomoQA({
 mensaje,ventanaDestino,origenDestino='https://uki-sushi-pedidos.vercel.app',
 habilitada=ROMO_VISUAL_PREVIEW_QA_ENABLED
}={}){
 if(habilitada!==true)fail('Vista externa todavía deshabilitada');
 if(origenDestino!=='https://uki-sushi-pedidos.vercel.app')fail('Destino desconocido');
 if(!ventanaDestino||typeof ventanaDestino.postMessage!=='function')
  fail('Ventana de prueba no disponible');
 // Aplicar el esquema estricto antes del envío; no puede viajar un objeto
 // de sesión, facturas, timbres, pedidos ni credenciales.
 if(!mensaje||Object.keys(mensaje).sort().join('|')!==
    ['identidad','protocolo','revision','soloVistaPrevia','storeId'].join('|')||
   mensaje.protocolo!=='uki-romo-vista-qa-v1'||mensaje.storeId!=='romo:serena'||
   mensaje.soloVistaPrevia!==true||!Number.isSafeInteger(mensaje.revision))
  fail('Mensaje de vista previa inválido');
 if(Object.keys(mensaje.identidad||{}).sort().join('|')!==CAMPOS.join('|'))
  fail('El mensaje contiene campos privados');
 ventanaDestino.postMessage(mensaje,origenDestino);
 return true;
}
