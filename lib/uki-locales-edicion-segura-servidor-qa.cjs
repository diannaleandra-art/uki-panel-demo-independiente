'use strict';
/*
 * Edición segura de fichas privadas QA. No crea ventas, URLs, locales
 * adicionales ni cambios en catálogo; no habilita publicaciones.
 * Nunca confía en que el navegador conservará las imágenes existentes.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class ConflictoFichaQA extends Error{
 constructor(message='La ficha fue modificada desde otro teléfono. Revisa y actualiza antes de guardar.'){
  super(message);this.code='FICHA_QA_CONFLICTO';
 }
}
const validarUrl=v=>{
 if(v==='')return '';
 if(typeof v!=='string'||v.length>500)throw Error('Enlace de imagen guardado inválido');
 let url;try{url=new URL(v)}catch{throw Error('Enlace de imagen guardado inválido')}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||
  url.hostname==='localhost')throw Error('Enlace de imagen guardado inseguro');
 return url.href;
};
function prepararEdicionSeguraQA({existente,configuracion,negocioId,sucursalId,revision}={}){
 if(!existente||typeof existente!=='object'||Array.isArray(existente)||
    !UUID.test(negocioId)||!UUID.test(sucursalId)||
    !UUID.test(String(existente.id||''))||
    typeof existente.store_id!=='string'||existente.store_id.length>100||
    existente.estado!=='borrador'||!Number.isSafeInteger(revision)||revision<1)
  throw Error('No se puede editar una ficha inválida');
 if(Number(existente.revision)!==revision)throw new ConflictoFichaQA();
 const original=existente.configuracion;
 if(!original||original.copiarDatos!==false||original.modulos?.publicado!==false||
    !configuracion||configuracion.copiarDatos!==false||configuracion.modulos?.publicado!==false)
  throw Error('Sólo se pueden editar fichas de borrador');
 const campos=['carta','pedidos','caja','inventario','timbres','cierres','publicado'];
 if(campos.some(c=>original.modulos?.[c]!==false||configuracion.modulos?.[c]!==false))
  throw Error('Los módulos deben permanecer desactivados');
 // Las imágenes se modifican en un flujo independiente de subida autorizada.
 // Dejar en blanco no las elimina; intentar sustituirlas directamente se rechaza.
 const oldLogo=validarUrl(original.logoUrl||'');
 const oldCover=validarUrl(original.portadaUrl||'');
 const incomingLogo=validarUrl(configuracion.logoUrl||'');
 const incomingCover=validarUrl(configuracion.portadaUrl||'');
 if((incomingLogo&&incomingLogo!==oldLogo)||
    (incomingCover&&incomingCover!==oldCover))
  throw Error('Las fotografías deben modificarse desde el cargador autorizado');
 const merged=Object.freeze({...configuracion,logoUrl:oldLogo,portadaUrl:oldCover});
 // Historial privado: solo cambios de campos visuales, sin credenciales.
 const camposAuditables=['nombre','direccion','whatsapp','instagram','horarios','plantilla','color'];
 const anteriorDiff={},nuevoDiff={};
 for(const campo of camposAuditables){
  const antes=String(original[campo]??''),despues=String(merged[campo]??'');
  if(antes!==despues){anteriorDiff[campo]=antes;nuevoDiff[campo]=despues;}
 }
 return Object.freeze({
  storeId:existente.store_id,revision,configuracion:merged,
  negocioId,sucursalId,
  // CAS también exige store_id inmutable; no se asigna otra identidad.
  auditAnterior:Object.freeze({revision,campos:Object.freeze(anteriorDiff)}),
  auditNuevo:Object.freeze({revision:revision+1,storeId:existente.store_id,campos:Object.freeze(nuevoDiff)}),
  // La auditoría y la edición usan la misma sentencia y transacción PostgreSQL.
  sql:"WITH actualizado AS ("+
   " UPDATE public.fin_locales_operativos_qa"+
   " SET configuracion=$4::jsonb,revision=revision+1,actualizado_por=$5,actualizado_en=now()"+
   " WHERE negocio_id=$1 AND sucursal_id=$2 AND store_id=$3"+
   " AND revision=$6 AND estado='borrador'"+
   " RETURNING id,store_id,revision,estado"+
   "), auditado AS ("+
   " INSERT INTO public.fin_auditoria(entidad,entidad_id,accion,anterior,nuevo,actor_uid)"+
   " SELECT 'local_qa',a.id::text,'editar_borrador',$7::jsonb,$8::jsonb,$5"+
   " FROM actualizado a RETURNING id"+
   ") SELECT a.id,a.store_id,a.revision,a.estado"+
   " FROM actualizado a JOIN auditado b ON true"
 });
}
async function guardarEdicionSeguraQA({db,preparada,actor}={}){
 if(!db||typeof db.query!=='function'||!preparada||!UUID.test(preparada.negocioId)||
  !UUID.test(preparada.sucursalId)||!Number.isSafeInteger(preparada.revision)||
  typeof actor!=='string'||actor.length<4||actor.length>256)
  throw Error('No se autorizó la edición');
 const rows=await db.query(preparada.sql,[
  preparada.negocioId,preparada.sucursalId,preparada.storeId,
  JSON.stringify(preparada.configuracion),actor,preparada.revision,
  JSON.stringify(preparada.auditAnterior),JSON.stringify(preparada.auditNuevo)
 ]);
 if(!Array.isArray(rows)||rows.length!==1||
  rows[0].store_id!==preparada.storeId||Number(rows[0].revision)!==preparada.revision+1)
  throw new ConflictoFichaQA();
 return rows[0];
}
module.exports={ConflictoFichaQA,prepararEdicionSeguraQA,guardarEdicionSeguraQA};
