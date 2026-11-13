/**
 * Único contrato de configuración del dueño para el motor de carta + panel.
 * No enlaza permisos ni abre tiendas: únicamente describe un borrador en QA.
 */
import {resolverLocalQA} from './uki-locales-registro-qa.mjs';
const fail=msg=>{throw Error(msg)};
const known={
 'uki:arica':{nombre:'Uki Regimiento Arica',carta:null,catalogo:null},
 'uki:serena':{nombre:'Uki La Serena',carta:null,catalogo:null},
 'romo:serena':{nombre:'Romo’s Sushi La Serena',carta:'/romo/',catalogo:'romo:serena'}
};
const módulos=Object.freeze(['pedidos','caja','historial','timbres','inventario','cierres','pagos mixtos','delivery']);
export const MOTOR_LOCALES_QA_HABILITADO=false;
export function prepararVinculoLocalQA(registro){
 const local=resolverLocalQA(registro),config=registro.configuracion;
 const datos=known[local.storeId]||{nombre:local.nombre,carta:null,catalogo:null};
 if(typeof config.nombre!=='string'||config.nombre.trim().length<3||
   typeof config.direccion!=='string'||config.direccion.trim().length<5||
   !/^#[0-9a-f]{6}$/i.test(config.color||''))fail('Identidad de tienda inválida');
 const logo=String(config.logoUrl||''),portada=String(config.portadaUrl||'');
 for(const u of [logo,portada].filter(Boolean)){
  let parsed;try{parsed=new URL(u)}catch{fail('Foto inválida')}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash)
   fail('Foto insegura');
 }
 const identidad=Object.freeze({
  nombre:config.nombre,direccion:config.direccion,
  whatsapp:String(config.whatsapp||''),instagram:String(config.instagram||''),
  horarios:String(config.horarios||''),
  color:config.color.toLowerCase(),logoUrl:logo,portadaUrl:portada
 });
 const carta=Object.freeze({storeId:local.storeId,
  ruta:datos.carta,fuenteCatalogo:datos.catalogo,
  identidad,publicada:false,solicitudesHabilitadas:false});
 const panel=Object.freeze({storeId:local.storeId,sucursal:datos.nombre,
  motor:'uki-panel-unico',modulos:módulos,
  operacionesHabilitadas:false,baseConectada:false});
 if(carta.storeId!==panel.storeId)fail('Sucursal cruzada');
 return Object.freeze({version:1,storeId:local.storeId,revision:local.revision,
  estado:'borrador',carta,panel,puedePublicar:false,
  copiarClientes:false,copiarPedidos:false,copiarInventario:false});
}
export function validarVinculoRomoQA(v){
 if(v?.version!==1||v.storeId!=='romo:serena'||
  v.carta?.storeId!=='romo:serena'||v.panel?.storeId!=='romo:serena'||
  v.carta.fuenteCatalogo!=='romo:serena'||v.carta.ruta!=='/romo/'||
  v.carta.publicada!==false||v.carta.solicitudesHabilitadas!==false||
  v.panel.operacionesHabilitadas!==false||v.puedePublicar!==false)
  fail('El vínculo Romo no está aislado y apagado');
 return true;
}
