/* Uki Sushi: preparación sin escritura de la migración de cierres.
 * No llama API, no accede a Firebase y no toca los datos actuales.
 * Necesita los permisos separados del servidor ANTES de activarse.
 */
import {separarEstadoPorAcceso,revisarPaqueteOperativo} from './uki-separacion-cierres-v1.mjs';
const FINANZAS=Object.freeze([
 'cierres','cajasDiarias','gastos','retiros','propinas','ajustesHistoricos',
 'base','apps','pagoDelivery','pagoDeliveryMedio','cajaChica'
]);
const SUCURSALES=new Map([['Uki Regimiento Arica','arica'],['Uki La Serena','serena']]);
const copy=value=>structuredClone(value);
export function prepararMigracionSinGuardarQA(estado){
 if(!estado||!SUCURSALES.has(estado.suc))throw Error('Sucursal no reconocida.');
 const {operacion,administracion}=separarEstadoPorAcceso(estado);
 revisarPaqueteOperativo(operacion);
 const finanzas={},adicionales={};
 for(const key of FINANZAS){
  // No inventar ceros ante campos ausentes: se perdería información antigua.
  if(!Object.hasOwn(administracion,key))
   throw Error('Falta campo financiero en el respaldo: '+key);
  finanzas[key]=copy(administracion[key]);
 }
 for(const [key,value] of Object.entries(administracion)){
  if(key!=='suc'&&!FINANZAS.includes(key))adicionales[key]=copy(value);
 }
 const branch=SUCURSALES.get(estado.suc);
 for(const field of ['cierres','gastos','retiros','propinas','ajustesHistoricos']){
  if(!Array.isArray(finanzas[field]))throw Error('Registro financiero inválido: '+field);
  for(const row of finanzas[field]){
   if(!row||typeof row!=='object'||Array.isArray(row)||
      (Object.hasOwn(row,'suc')&&row.suc!==estado.suc))
    throw Error('Se mezclaron registros de otra sucursal: '+field);
  }
 }
 if(!finanzas.cajasDiarias||typeof finanzas.cajasDiarias!=='object'||
    Array.isArray(finanzas.cajasDiarias))
  throw Error('Cajas del día inválidas.');
 for(const key of Object.keys(finanzas.cajasDiarias)){
  if(key.includes('|')&&!key.startsWith(estado.suc+'|'))
   throw Error('Una caja pertenece a otra sucursal.');
 }
 return {branch,operacion,finanzas,adicionales};
}
export function reconstruirMigracionSinGuardarQA(paquete){
 if(!paquete||!SUCURSALES.has(paquete.operacion?.suc)||
    SUCURSALES.get(paquete.operacion.suc)!==paquete.branch)
  throw Error('La prueba pertenece a otra sucursal.');
 revisarPaqueteOperativo(paquete.operacion);
 if(!paquete.finanzas||!paquete.adicionales||
    typeof paquete.finanzas!=='object'||typeof paquete.adicionales!=='object')
  throw Error('Faltan datos para reconstruir la copia.');
 for(const key of FINANZAS)if(!Object.hasOwn(paquete.finanzas,key))
  throw Error('Falta información financiera.');
 for(const key of Object.keys(paquete.adicionales))
  if(key==='suc'||FINANZAS.includes(key)||Object.hasOwn(paquete.operacion,key))
   throw Error('El respaldo de prueba tiene campos duplicados.');
 return {...copy(paquete.adicionales),...copy(paquete.finanzas),...copy(paquete.operacion)};
}
export const CAMPOS_FINANZAS_QA=FINANZAS;

/*
 * Compatibilidad con la API QA financiera.
 * Los metadatos que no son pedidos se guardan en el mismo sobre privado;
 * sin esto, filtros, ajustes futuros y campos de otras versiones se perderían.
 * Estas funciones NO envían el sobre al servidor.
 */
export function crearPaquetePrivadoSinGuardarQA(paquete){
 if(!paquete||!paquete.finanzas||!paquete.adicionales||
    typeof paquete.finanzas!=='object'||typeof paquete.adicionales!=='object'||
    Array.isArray(paquete.adicionales))throw Error('Falta respaldo administrativo.');
 const keys=Object.keys(paquete.finanzas);
 if(keys.length!==FINANZAS.length||keys.some(k=>!FINANZAS.includes(k)))
  throw Error('El respaldo financiero tiene campos inesperados.');
 for(const key of Object.keys(paquete.adicionales))
  if(key==='suc'||FINANZAS.includes(key)||Object.hasOwn(paquete.operacion||{},key))
   throw Error('Campo administrativo duplicado: '+key);
 return {...copy(paquete.finanzas),adicionales:copy(paquete.adicionales)};
}
export function reconstruirDesdePaquetePrivadoQA({branch,operacion,privado}){
 if(!privado||!Object.hasOwn(privado,'adicionales')||
    typeof privado.adicionales!=='object'||Array.isArray(privado.adicionales))
  throw Error('Falta respaldo de metadatos privados.');
 const {adicionales,...finanzas}=privado;
 return reconstruirMigracionSinGuardarQA({branch,operacion,finanzas,adicionales});
}
