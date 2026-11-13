'use strict';
/**
 * Diagnóstico de la única base de finanzas habilitada para dueños.
 * Solo consulta metadatos públicos de esquema DESPUÉS de Google + PIN.
 * Nunca crea, copia ni publica locales.
 */
const SCHEMA_CHECK_SQL=[
 "SELECT",
 " (to_regclass('public.fin_negocios') IS NOT NULL) AS negocios,",
 " (to_regclass('public.fin_sucursales') IS NOT NULL) AS sucursales,",
 " (to_regclass('public.fin_sesiones') IS NOT NULL) AS sesiones,",
 " (to_regclass('public.fin_auditoria') IS NOT NULL) AS auditoria,",
 " (to_regclass('public.fin_locales_operativos_qa') IS NOT NULL) AS registro"
].join(' ');
async function diagnosticarRegistroLocalesQA({db,habilitado=false}={}){
 if(!db||typeof db.query!=='function')throw Error('Conexión financiera privada no verificada');
 const filas=await db.query(SCHEMA_CHECK_SQL);
 if(!Array.isArray(filas)||filas.length!==1)throw Error('No se pudo verificar el esquema');
 const v=filas[0];
 const prerequisitos=['negocios','sucursales','sesiones','auditoria'];
 const finance=prerequisitos.every(k=>v[k]===true);
 const tabla=v.registro===true;
 const listo=finance&&tabla&&habilitado===true;
 return Object.freeze({
  tipo:'registro_de_locales',privado:true,soloLectura:true,
  finanzasComprobadas:finance,tablaBorradoresPreparada:tabla,
  registroHabilitado:listo,publicacionHabilitada:false,
  operacionesHabilitadas:false,
  siguiente:!finance?'Verificar base financiera privada':
    !tabla?'Preparar migración de borradores con autorización':
    !habilitado?'Habilitar guardado privado tras autorización':'Guardar solo borradores privados'
 });
}
module.exports={SCHEMA_CHECK_SQL,diagnosticarRegistroLocalesQA};
