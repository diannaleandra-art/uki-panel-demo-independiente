/*
 * UKI SUSHI | PROTOTIPO V1 DE SEPARACIÓN DE DATOS.
 * No conectado a producción ni al almacenamiento real.
 * PRECONDICIÓN DE SEGURIDAD: usar claves CIFRADAS DISTINTAS y autorizaciones
 * de servidor distintas para OPERACIÓN y FINANZAS antes de hacer el corte.
 *
 * Los trabajadores que registran pedidos pueden conocer el precio/total
 * de esos pedidos. Esta separación protege cierres, cajas y reportes,
 * no oculta todo dato monetario del trabajo de ventas.
 */
const SUCURSALES=new Set(['Uki Regimiento Arica','Uki La Serena']);
const OPERACION=Object.freeze([
 'suc','pedidos','clientes','borradores','incidencias',
 'deliveriesManuales','nextId','nextIncidenciaId','fechaOperativa'
]);
// Nunca permitir que nuevos campos se añadan automáticamente a la operación.
// Todos los campos no identificados permanecen en el conjunto administrativo.
const PROHIBIDOS=Object.freeze([
 'cierres','cajasDiarias','gastos','retiros','propinas','ajustesHistoricos',
 'base','apps','pagoDelivery','pagoDeliveryMedio','cajaChica',
 'repartidores','totalCaja','totales','reportes','historialCierres'
]);
function validar(state){
 if(!state||typeof state!=='object'||Array.isArray(state)||!SUCURSALES.has(state.suc))
  throw Error('Sucursal operativa no válida.');
 for(const [key,val] of Object.entries(state)){
  if(typeof val==='function'||typeof val==='symbol'||typeof val==='bigint')
   throw Error('Estado contiene valores incompatibles: '+key);
 }
}
function copia(x){return structuredClone(x)}
export function separarEstadoPorAcceso(state){
 validar(state);
 const operacion={},administracion={};
 for(const [key,val] of Object.entries(state)){
  if(OPERACION.includes(key))operacion[key]=copia(val);
  else administracion[key]=copia(val);
 }
 // El estado administrativo guarda también la sucursal para cotejo,
 // pero ese campo se valida al unir sin duplicarse.
 administracion.suc=state.suc;
 return {operacion,administracion};
}
export function recomponerEstadoAdministracion({operacion,administracion}){
 validar(operacion);validar(administracion);
 if(operacion.suc!==administracion.suc)throw Error('Los datos pertenecen a sucursales distintas.');
 for(const key of Object.keys(administracion)){
  if(key!=='suc'&&OPERACION.includes(key))
   throw Error('Campo operativo duplicado: '+key);
 }
 return {...copia(administracion),...copia(operacion)};
}
export function revisarPaqueteOperativo(operacion){
 validar(operacion);
 for(const key of Object.keys(operacion))
  if(!OPERACION.includes(key)||PROHIBIDOS.includes(key))
   throw Error('Campo administrativo dentro del paquete de trabajador: '+key);
 return true;
}
export const CAMPOS_FINANCIEROS_RESERVADOS=PROHIBIDOS;
