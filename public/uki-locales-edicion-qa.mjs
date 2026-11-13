/**
 * Conservar los recursos visuales de una ficha al modificar solo su texto.
 * Las nuevas fotos elegidas en el iPhone son previsualización, no subida.
 */
const validImage=value=>{
 if(value==='')return true;
 if(typeof value!=='string'||value.length>500)return false;
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;
 }catch{return false}
};
export function prepararFichaParaGuardarQA(formulario,registro){
 if(!formulario||typeof formulario!=='object'||Array.isArray(formulario))
  throw Error('Formulario inválido');
 const prev=registro?.configuracion;
 if(registro&&(
  registro.negocio_id!==formulario.negocio_id||
  registro.sucursal_id!==formulario.sucursal_id||
  registro.estado!=='borrador'
 ))throw Error('Ficha de otra sucursal; actualiza antes de editar');
 const logoUrl=prev?.logoUrl||'',portadaUrl=prev?.portadaUrl||'';
 if(!validImage(logoUrl)||!validImage(portadaUrl))
  throw Error('La foto guardada no cumple validaciones de seguridad');
 return Object.freeze({...formulario,logoUrl,portadaUrl});
}
