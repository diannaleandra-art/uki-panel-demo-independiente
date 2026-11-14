/**
 * Sincronización cerrada de cierres Romo para Mi Administración (QA).
 * NO recibe importes del navegador: lee constancias creadas con CAS en
 * Neon Romo y las importa una sola vez en Neon finanzas QA, usando PIN+Google.
 * Solo invocar desde el servidor, nunca publicar URLs/credenciales.
 */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {guardarCierreRomoDuenosQA} from './romo-cierres-duenos-repositorio-qa.mjs';

export const ROMO_FIN_SYNC_QA_DEFAULT_ENABLED=false;
const QA_BRANCH='qa/integracion-panel-unico-romo-serena-20261112';
const QA_FIN_HOST='ep-lucky-band-b5j3itkw.c-7.us-east-2.aws.neon.tech';
const QA_ROMO_HOST='ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech';
const dateRegex=/^\d{4}-\d{2}-\d{2}$/;
const check=(x,message)=>{if(!x)throw Error(message)};
const date=x=>typeof x==='string'&&dateRegex.test(x)&&
 !Number.isNaN(Date.parse(x+'T12:00:00Z'))&&
 new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
export function configurarSincronizacionRomoQA(env={}){
 if(env.VERCEL_ENV!=='production'||
   env.ROMO_FIN_SYNC_QA_ENABLED!=='true')
  return null;
 // Nunca utilizar la URL financiera operativa ni Neon productivo de Romo.
 const open=(raw,host,name)=>{
  let url;try{url=new URL(String(raw||''))}catch{return null}
  if(!['postgres:','postgresql:'].includes(url.protocol)||
    url.hostname!==host||url.pathname!=='/'+name||
    !url.username||!url.password||url.searchParams.has('options')||
    url.hash)return null;
  return url.toString();
 };
 const fin=open(env.ROMO_FIN_QA_DATABASE_URL,QA_FIN_HOST,'neondb');
 const romo=open(env.ROMO_CIERRES_QA_DATABASE_URL,QA_ROMO_HOST,'romos_sushi');
 if(!fin||!romo||fin===romo)return null;
 if(env.ROMO_FIN_SYNC_QA_BRANCH!==QA_BRANCH)return null;
 return Object.freeze({financeUrl:fin,romoUrl:romo});
}
/**
 * Lectura aislada de la tabla Romo en finanzas QA.
 * El propietario ya debe haber iniciado Google + PIN en Mi Administración.
 * La bandera de LECTURA nunca activa escrituras ni operaciones comerciales.
 */
export function configurarLecturaCierresRomoQA(env={}){
 if(env.VERCEL_ENV!=='production'||
   env.ROMO_FIN_CIERRES_LECTURA_QA_ENABLED!=='true'||
   env.ROMO_FIN_SYNC_QA_BRANCH!==QA_BRANCH)
  return null;
 let url;
 try{url=new URL(String(env.ROMO_FIN_QA_DATABASE_URL||''))}
 catch{return null}
 if(!['postgres:','postgresql:'].includes(url.protocol)||
   url.hostname!==QA_FIN_HOST||url.pathname!=='/neondb'||
   !url.username||!url.password||url.searchParams.has('options')||
   url.hash)return null;
 return Object.freeze({financeUrl:url.toString(),soloLectura:true});
}
export async function sincronizarCierresRomoDuenosQA({
 dbFin,dbRomo,identity,pinVerified=false,desde,hasta
}={}){
 check(pinVerified===true,'Se requiere sesión privada PIN de dueños');
 authorizeRomoOperation(identity,'romo','serena','owners.write');
 check(typeof dbFin?.query==='function'&&typeof dbRomo?.query==='function'&&
  dbFin!==dbRomo,'Se requieren dos bases de datos aisladas');
 check(date(desde)&&date(hasta)&&desde<=hasta,
  'Rango de fechas no válido');
 const span=(Date.parse(hasta+'T12:00:00Z')-
   Date.parse(desde+'T12:00:00Z'))/86400000;
 check(span>=0&&span<=31,'Consulta máximo 32 días por vez');
 const rows=await dbRomo.query(
  'SELECT store_id,source_key,turno_ref,fecha_operativa::text AS fecha_operativa,'+
  'revision_neon,resumen FROM public.romo_cierres_constancia_v1 '+
  'WHERE store_id=$1 AND fecha_operativa BETWEEN $2::date AND $3::date '+
  'ORDER BY fecha_operativa,turno_ref LIMIT 101',
  ['romo:serena',desde,hasta]);
 check(Array.isArray(rows)&&rows.length<=100,
  'Hay más de 100 cierres; utiliza un rango menor');
 let importados=0,existentes=0;
 for(const row of rows){
  check(row&&row.store_id==='romo:serena'&&
   row.source_key==='romo:serena|'+row.turno_ref&&
   row.turno_ref?.slice(0,10)===String(row.fecha_operativa).slice(0,10)&&
   Number.isSafeInteger(Number(row.revision_neon))&&Number(row.revision_neon)>0,
   'Constancia Romo inconsistente');
  const raw=typeof row.resumen==='string'?JSON.parse(row.resumen):row.resumen;
  check(raw&&raw.estado==='pendiente_confirmacion_neon'&&
   raw.turno_ref===row.turno_ref&&
   raw.fuente_unica===row.source_key,
   'Constancia no corresponde al turno');
  const resumen={...raw,estado:'confirmado_en_romo_pendiente_de_sincronizar_duenos',
   revision_neon:Number(row.revision_neon)};
  // El repositorio vuelve a consultar Neon Romo y exige constancia íntegra.
  // El INSERT financiero utiliza ON CONFLICT DO NOTHING y comprueba cifras.
  const saved=await guardarCierreRomoDuenosQA({
   db:dbFin,dbRomo,identity,privateOwnerSessionVerified:true,resumen
  });
  if(saved.registrado)importados++;
  else if(saved.duplicado)existentes++;
  else check(false,'No se confirmó el cierre en finanzas');
 }
 return Object.freeze({
  sincronizado:true,origen:'romo:serena',importados,existentes,
  revisados:rows.length,desde,hasta,sinModificarUki:true
 });
}
