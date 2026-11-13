/**
 * Manejo visible de edición simultánea en Mi Administración.
 * La información que no se pudo guardar se conserva en el formulario,
 * y solo el dueño puede elegir cargar la nueva versión.
 */
export function clasificarErrorFichaQA(message){
 const value=String(message||'').trim().slice(0,260);
 const conflicto=/409|otro teléfono|la ficha cambió|actualiza antes de guardar|otra versi[oó]n|ya tiene una identidad/i.test(value);
 return Object.freeze({
  conflicto,
  mensaje:conflicto?
   'La ficha cambió desde otro teléfono. No se guardaron tus modificaciones. Revísalas y pulsa «Cargar versión actual» cuando quieras reemplazar lo que escribiste.':
   value||'No fue posible guardar la ficha.'
 });
}
export function prepararEstadoConflictoQA({mensaje,formulario,revision}={}){
 const error=clasificarErrorFichaQA(mensaje);
 if(!error.conflicto)return Object.freeze({conflicto:false,mensaje:error.mensaje});
 if(!formulario||typeof formulario!=='object'||Array.isArray(formulario))
  throw Error('Formulario inválido');
 return Object.freeze({
  conflicto:true,mensaje:error.mensaje,
  // Una referencia de datos solo para comparar en tests o avisar en pantalla.
  // No se persiste ni se envía al backend.
  revisionAnterior:Number.isSafeInteger(revision)?revision:null
 });
}
