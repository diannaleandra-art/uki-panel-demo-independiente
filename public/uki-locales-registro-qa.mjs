/**
 * Registro de sucursales del panel único Uki; SOLO lectura de QA.
 * La configuración de un local no transmite ventas ni concede permisos.
 */
export const TIENDAS_EXISTENTES_QA=Object.freeze([
 Object.freeze({storeId:'uki:arica',nombre:'Uki Regimiento Arica',estado:'existente'}),
 Object.freeze({storeId:'uki:serena',nombre:'Uki La Serena',estado:'existente'}),
 Object.freeze({storeId:'romo:serena',nombre:'Romo’s Sushi La Serena',estado:'integracion'})
]);
const ids=new Set(TIENDAS_EXISTENTES_QA.map(x=>x.storeId));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=x=>{throw Error(x)};
const mod=['carta','pedidos','caja','inventario','timbres','cierres','publicado'];
export function resolverLocalQA(ficha){
 if(!ficha||typeof ficha!=='object'||Array.isArray(ficha))fail('Ficha inválida');
 const id=String(ficha.store_id||'');
 if(!ids.has(id)&&!(id.startsWith('local:')&&uuid.test(id.slice(6))))
  fail('Identificador ajeno o inválido');
 if(!uuid.test(String(ficha.sucursal_id||''))||!uuid.test(String(ficha.negocio_id||'')))
  fail('Sucursal y negocio inválidos');
 if(ficha.estado!=='borrador'||!Number.isSafeInteger(ficha.revision)||ficha.revision<1)
  fail('Solo borradores pendientes');
 const c=ficha.configuracion;
 if(!c||c.motor!=='uki-panel-unico'||c.version!==1||c.copiarDatos!==false||
   !['uki-motor','carta-vacia'].includes(c.plantilla)||
   !c.modulos||Object.keys(c.modulos).length!==mod.length||
   mod.some(k=>c.modulos[k]!==false))
  fail('La ficha no puede activar ni copiar operaciones');
 const actual=TIENDAS_EXISTENTES_QA.find(x=>x.storeId===id);
 return Object.freeze({
  storeId:id,tipo:actual?.estado||'nuevo',nombre:String(c.nombre||'').slice(0,90),
  plantilla:c.plantilla,motor:'uki-panel-unico',
  color:c.color,logoUrl:c.logoUrl||'',portadaUrl:c.portadaUrl||'',
  estado:'borrador',revision:ficha.revision,copiarDatos:false,
  puedeRegistrarPedidos:false,puedePublicarCarta:false
 });
}
export function listarLocalesSeparadosQA(fichas){
 if(!Array.isArray(fichas)||fichas.length>100)fail('Lista incorrecta');
 const stores=new Set(),branches=new Set();
 return Object.freeze(fichas.map(f=>{
  const d=resolverLocalQA(f);
  if(stores.has(d.storeId)||branches.has(f.sucursal_id))
   fail('La tienda o sucursal ya está registrada');
  stores.add(d.storeId);branches.add(f.sucursal_id);
  return d;
 }));
}
