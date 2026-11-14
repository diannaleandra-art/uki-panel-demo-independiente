/* Romo: un diagnóstico único, solo lectura. Nunca activa caja ni carta. */
export const ROMO_DIAGNOSTICO_STORE_ID='romo:serena';
export const ROMO_DIAGNOSTICO_HABILITADO_QA=false;
const fail=msg=>{throw Error(msg)};
const nonneg=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>1000000000)fail('Recuento Romo inválido');return n};
export function evaluarPreparacionRomoQA({catalogo=null,personal=0,solicitudes=0,estados=0}={}){
 let productosVisibles=0,promocionesVisibles=0;
 if(catalogo){
  if(typeof catalogo!=='object'||catalogo.storeId!=='romo:serena'||
   !Array.isArray(catalogo.products)||!Array.isArray(catalogo.promotions))
   fail('Catálogo ajeno a Romo');
  for(const row of [...catalogo.products,...catalogo.promotions])
   if(!row||typeof row.visible!=='boolean')fail('Visibilidad Romo incorrecta');
  productosVisibles=catalogo.products.filter(x=>x.visible===true).length;
  promocionesVisibles=catalogo.promotions.filter(x=>x.visible===true).length;
 }
 const datos=Object.freeze({
  tieneCatalogo:!!catalogo,productosVisibles,promocionesVisibles,
  empleadosAutorizados:nonneg(personal),solicitudes:nonneg(solicitudes),
  estadosOperativos:nonneg(estados)
 });
 const bloqueos=[];
 if(!catalogo)bloqueos.push('No se encontró el catálogo Romo');
 else if(productosVisibles+promocionesVisibles===0)
  bloqueos.push('No hay productos ni promociones visibles');
 if(datos.empleadosAutorizados===0)bloqueos.push('Sin personal autorizado');
 bloqueos.push('Falta vincular el formulario real con caja, historial y timbres');
 bloqueos.push('Falta prueba integral con dos teléfonos reales');
 bloqueos.push('Falta autorización final de los dueños');
 return Object.freeze({
  storeId:'romo:serena',estado:'en_preparacion',datos,
  bloqueos:Object.freeze(bloqueos),listoParaPublicar:false,listoParaVentas:false
 });
}
export async function consultarPreparacionRomoQA({db,identity}={}){
 if(!identity||identity.brand!=='romo'||identity.role!=='duenos'||
  !Array.isArray(identity.branches)||!identity.branches.includes('serena'))
  fail('Sólo dueños Romo pueden consultar la preparación');
 if(!db||typeof db.query!=='function')fail('Base Romo no disponible');
 const rows=await Promise.all([
  db.query('SELECT contenido FROM public.romo_catalogo_v1 WHERE store_id=$1 LIMIT 1',['romo:serena']),
  db.query('SELECT count(*)::integer AS n FROM public.romo_personal_acceso_v1 WHERE store_id=$1 AND activo=true',['romo:serena']),
  db.query('SELECT count(*)::integer AS n FROM public.romo_solicitudes_carta_v1 WHERE store_id=$1',['romo:serena']),
  db.query('SELECT count(*)::integer AS n FROM public.romo_estado_operativo_v1 WHERE store_id=$1',['romo:serena'])
 ]);
 if(rows.some((v,i)=>!Array.isArray(v)||(i===0?v.length>1:v.length!==1)))
  fail('No se pudo verificar el estado de Romo');
 return evaluarPreparacionRomoQA({
  catalogo:rows[0][0]?.contenido||null,
  personal:rows[1][0].n,solicitudes:rows[2][0].n,estados:rows[3][0].n
 });
}
