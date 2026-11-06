/*
 * UKI SUSHI — revisión de corte sin tocar datos reales.
 * No usa red, Firebase, Neon, almacenamiento local ni credenciales.
 * No habilita producción. Solo prueba que una COPIA sintética conserva
 * información y enumera condiciones para una migración posterior.
 */
import {prepararMigracionSinGuardarQA,reconstruirMigracionSinGuardarQA}
 from './uki-migracion-cierres-seca-qa.mjs';

const EVIDENCIAS=Object.freeze([
 ['respaldoAricaRestaurado','Respaldo cifrado de Regimiento Arica restaurado y comparado'],
 ['respaldoSerenaRestaurado','Respaldo cifrado de La Serena restaurado y comparado'],
 ['revisionesCongeladas','Sin pedidos pendientes ni revisiones remotas distintas durante el corte'],
 ['operacionNuevaValidada','Los trabajadores registran pedidos con el nuevo acceso operativo'],
 ['finanzasPrivadasValidadas','Los cierres privados se leen y guardan solo con credenciales administrativas'],
 ['accesoLegadoRevocado','Trabajadores no pueden leer el snapshot antiguo en Firebase'],
 ['equiposLegadosTratados','Se gestionó explícitamente el respaldo cifrado antiguo en los teléfonos'],
 ['restauracionVerificada','Se verificó la recuperación y el retroceso de ambas sucursales'],
 ['aprobacionPublicacion','La propietaria autorizó expresamente el cambio de producción']
]);
function normalizar(data) {
 if(data===null||typeof data==='string'||typeof data==='boolean')return data;
 if(typeof data==='number'&&Number.isFinite(data))return data;
 if(Array.isArray(data))return data.map(normalizar);
 if(!data||typeof data!=='object'||Object.getPrototypeOf(data)!==Object.prototype)
  throw Error('La simulación solo admite registros JSON.');
 return Object.fromEntries(Object.keys(data).sort().map(k=>[k,normalizar(data[k])]));
}
function texto(data){return JSON.stringify(normalizar(data));}
async function firma(data,cryptoImpl) {
 const crypto=cryptoImpl||globalThis.crypto;
 if(!crypto?.subtle)throw Error('No hay SHA-256 disponible para validar el respaldo.');
 const bytes=new TextEncoder().encode(texto(data));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function rep(data){return JSON.parse(JSON.stringify(data));}
export async function comprobarMigracionEnSecoQA(estado,{cryptoImpl}={}) {
 const comienzo=rep(estado);
 const origin=await firma(comienzo,cryptoImpl);
 const paquetes=prepararMigracionSinGuardarQA(comienzo);
 // Los 3 paquetes son copias independientes; simula su serialización y
 // posterior recuperación, sin escribir ninguno a la nube.
 const transferidos=rep(paquetes);
 const reconstruido=reconstruirMigracionSinGuardarQA(transferidos);
 const final=await firma(reconstruido,cryptoImpl);
 if(origin!==final||texto(comienzo)!==texto(reconstruido))
  throw Error('La prueba detectó pérdida o cambio de registros.');
 for(const campo of ['cierres','cajasDiarias','gastos','retiros','propinas',
  'ajustesHistoricos','base','apps','pagoDelivery','pagoDeliveryMedio','cajaChica']){
  if(Object.hasOwn(transferidos.operacion,campo))
   throw Error('Un dato privado apareció en la operación: '+campo);
 }
 return Object.freeze({
  sucursal:comienzo.suc,branch:transferidos.branch,
  pedidos:transferidos.operacion.pedidos.length,
  cierres:transferidos.finanzas.cierres.length,
  gastos:transferidos.finanzas.gastos.length,
  mismoContenido:true,firmaSHA256:origin,
  puedeActivarseEnProduccion:false // Incluso una prueba perfecta NO autoriza el corte.
 });
}
export function revisarPreparacionDeCorteQA(evidencias={}) {
 const faltantes=EVIDENCIAS.filter(([id])=>evidencias[id]!==true)
  .map(([id,descripcion])=>({id,descripcion}));
 return Object.freeze({
  verificadas:EVIDENCIAS.length-faltantes.length,
  total:EVIDENCIAS.length,
  faltantes,
  puedeSolicitarAutorizacion:!faltantes.length,
  puedeActivarseEnProduccion:false
 });
}
export const CONDICIONES_DE_CORTE_QA=EVIDENCIAS;
