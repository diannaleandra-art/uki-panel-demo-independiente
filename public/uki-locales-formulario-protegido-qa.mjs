/**
 * Evita que una consulta automática borre una ficha que el dueño está editando.
 * Los datos se conservan solo en la memoria de la pantalla.
 */
const TEXTOS=['ownerLocBiz','ownerLocBranch','ownerLocExisting','ownerLocNewBranch',
 'ownerLocName','ownerLocAddress','ownerLocWhatsApp','ownerLocInstagram',
 'ownerLocSchedule','ownerLocTemplate','ownerLocColor'];
const FOTOS=['ownerLocLogo','ownerLocCover'];
export function firmaFormularioLocalQA(obtener){
 if(typeof obtener!=='function')throw Error('Formulario no disponible');
 const textos=TEXTOS.map(id=>String(obtener(id)?.value??''));
 const fotos=FOTOS.map(id=>{
  const file=obtener(id)?.files?.[0];
  return file?[String(file.name||''),Number(file.size||0),Number(file.lastModified||0)]:null;
 });
 return JSON.stringify([textos,fotos]);
}
export function permiteRecargaFormularioQA({
 firmaActual,firmaCargada,conflictoPendiente=false,forzar=false
}={}){
 if(forzar===true)return true;
 return conflictoPendiente!==true&&(firmaCargada===null||firmaActual===firmaCargada);
}
