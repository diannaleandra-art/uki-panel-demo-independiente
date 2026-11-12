/**
 * ROMO SERENA: un único adaptador para el MISMO panel ya existente de Uki.
 *
 * Reúne tres servicios QUE YA EXISTEN: motor operativo cifrado, carta con
 * promociones/categorías, e inventario. No duplica HTML ni claves, no
 * despliega una API ni toca bases. Se construye en el servidor con identidad
 * Google verificada y la base privada Romo, jamás desde body del cliente.
 *
 * La caja/pedidos/timbres/cierres permanecen en el estado cifrado operativo.
 * Otras operaciones del router ("orders","cash","stamps","owners") NO están
 * habilitadas como endpoints individuales: se manejan en el motor original
 * de Uki y el estado operativo Romo, una vez se active su persistencia.
 */
import {crearAlmacenamientoOperativoRomoQA} from './romo-almacenamiento-operativo-panel-qa.mjs';
import {crearAlmacenamientoCatalogoRomoQA} from './romo-almacenamiento-catalogo-panel-qa.mjs';
import {crearAlmacenamientoInventarioRomoQA} from './romo-almacenamiento-inventario-panel-qa.mjs';

const STORE='romo:serena';
const AREAS=Object.freeze(['operativo','catalog','inventory']);
export function crearAlmacenamientoUnicoRomoQA({db,identity}={}){
 if(!db||typeof db.query!=='function')
  throw Error('Falta conexión independiente de Romo');
 if(!identity||identity.brand!=='romo'||
    !Array.isArray(identity.branches)||identity.branches.length!==1||
    identity.branches[0]!=='serena')
  throw Error('Requiere sesión Romo verificada por servidor');
 const services=Object.freeze({
  operativo:crearAlmacenamientoOperativoRomoQA({db,identity}),
  catalog:crearAlmacenamientoCatalogoRomoQA({db,identity}),
  inventory:crearAlmacenamientoInventarioRomoQA({db,identity})
 });
 function service(request){
  if(!request||request.storeId!==STORE||
     !AREAS.includes(request.area))
   throw Error('El panel no tiene permiso para conectar otra sucursal o servicio');
  return services[request.area];
 }
 return Object.freeze({
  storeId:STORE,
  async read(request){
   const result=await service(request).read(request);
   if(result?.storeId!==STORE)throw Error('Respuesta de otra sucursal bloqueada');
   return result;
  },
  async write(request){
   const result=await service(request).write(request);
   if(result?.storeId!==STORE)throw Error('Escritura de otra sucursal bloqueada');
   return result;
  }
 });
}
export const ROMO_PANEL_UNICO_ALMACENAMIENTO_NO_PUBLICADO=true;
