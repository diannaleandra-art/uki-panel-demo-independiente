/**
 * Contrato de la misma sección «Carta y precios» de Uki para la tercera sucursal.
 * SOLO QA sin endpoint, sin claves ni conexión automática. Se llama únicamente
 * desde un backend que verificó en servidor la sesión Google y el permiso Romo.
 * Nunca sustituir autenticación por el nombre del local enviado por el cliente.
 */
import {leerEditorRomoQA,guardarAccionCartaRomoQA,guardarAccionCategoriaRomoQA} from './romo-editor-carta-repositorio-qa.mjs';

const STORE = 'romo:serena';
const AREAS = Object.freeze({productos:'products',ingredientes:'ingredients',promociones:'promotions',categorias:'categories'});
const ACTIONS = Object.freeze({
  'crear-producto':'crear','crear-ingrediente':'crear','crear-promocion':'crear',
  'editar-producto':'editar','editar-precio':'editar','editar-ingrediente':'editar','editar-promocion':'editar',
  'retirar-producto':'retirar','retirar-ingrediente':'retirar','retirar-promocion':'retirar',
  'restaurar-producto':'restaurar','restaurar-ingrediente':'restaurar','restaurar-promocion':'restaurar',
  'marcar-agotado':'agotado','marcar-disponible':'disponible',
  'editar-descuento':'editar',
  'crear-categoria':'crear','renombrar-categoria':'renombrar',
  'retirar-categoria':'retirar','restaurar-categoria':'restaurar'
});
function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype}
function validInt(x){return Number.isSafeInteger(x)&&x>=0}
function cleanPayload(input,section,action){
  if(section==='categories'){
   if(!plain(input)||!validInt(input.expectedRevision)||typeof input.slug!=='string')
    throw Error('Actualiza las categorías antes de guardar');
   const mapped={storeId:STORE,action,expectedRevision:input.expectedRevision,slug:input.slug};
   if(action==='crear'||action==='renombrar'){
    if(typeof input.nombre!=='string')throw Error('Nombre de categoría obligatorio');
    mapped.nombre=input.nombre;
   }
   if(action!=='crear'){
    if(!validInt(input.expectedVersion)||input.expectedVersion<1)
     throw Error('La categoría cambió; actualiza antes de guardar');
    mapped.expectedVersion=input.expectedVersion;
   }
   return mapped;
  }
  if(!plain(input)||!validInt(input.expectedRevision)||typeof input.sku!=='string')
    throw Error('Actualiza la lista antes de guardar');
  const mapped={storeId:STORE,section,action,expectedRevision:input.expectedRevision,sku:input.sku};
  if(action==='crear'){
    if(!plain(input.item)||input.item.sku!==input.sku)throw Error('Completa el registro');
    mapped.item=input.item;
    return mapped;
  }
  if(!validInt(input.expectedVersion)||input.expectedVersion<1)
    throw Error('El registro cambió; actualiza antes de editar');
  mapped.expectedVersion=input.expectedVersion;
  if(action==='editar'){
    if(input.action==='editar-descuento'){
      if(!Number.isSafeInteger(input.discountPercent)||input.discountPercent<0||
         input.discountPercent>99)throw Error('Descuento inválido');
      mapped.patch={discountPercent:input.discountPercent};
    }else if(input.action==='editar-precio'){
      if(!Number.isSafeInteger(input.price)||input.price<0)throw Error('Precio inválido');
      mapped.patch={price:input.price};
    }else{
      if(!plain(input.patch)||Object.keys(input.patch).length<1)throw Error('Revisa el cambio');
      mapped.patch=input.patch;
    }
  }
  return mapped;
}
export function validarDestinoPanelRomoQA(storeId,area,action){
  if(storeId!==STORE)throw Error('No se permite acceder a datos de Uki desde Romo');
  if(!Object.hasOwn(AREAS,area))throw Error('Sección de carta no permitida');
  if(action!=='listar'&&!Object.hasOwn(ACTIONS,action))throw Error('Acción de carta no permitida');
  if(action==='crear-producto'&&area!=='productos'||action==='crear-ingrediente'&&area!=='ingredientes'||action==='crear-promocion'&&area!=='promociones')
    throw Error('Acción de otra sección');
  if(action.includes('promocion')&&area!=='promociones'||action.includes('ingrediente')&&area!=='ingredientes'||action.includes('producto')&&area!=='productos')
    throw Error('Acción de otra sección');
  if(action==='editar-precio'&&area==='ingredientes')throw Error('Usa el editor de recargos de ingredientes');
  if(action.endsWith('-categoria')&&area!=='categorias')throw Error('Categoría fuera de su sección');
  if(area==='categorias'&&action!=='listar'&&!action.endsWith('-categoria'))
   throw Error('En categorías sólo se puede crear, renombrar, retirar o restaurar');
  if(action==='editar-descuento'&&!['productos','promociones'].includes(area))
   throw Error('Descuento sólo para productos o promociones');
  return AREAS[area];
}
export async function ejecutarCartaDesdePanelUnicoRomoQA({storeId,area,action,data={},db,identity}={}){
  const section=validarDestinoPanelRomoQA(storeId,area,action);
  if(action==='listar'){
    const snapshot=await leerEditorRomoQA({db,identity});
    return Object.freeze({ok:true,storeId:STORE,area,revision:snapshot?.revision??0,
      initialized:!!snapshot,items:Object.freeze(snapshot?.[section]?.map(x=>Object.freeze({...x}))??[])});
  }
  // Los roles se verifican OTRA VEZ al guardar dentro del repositorio.
  // No se acepta nunca identidad o permisos en data ni se escribe en Uki.
  if(!plain(data))throw Error('Formulario inválido');
  const mutation=cleanPayload({...data,action},section,ACTIONS[action]);
  const result=section==='categories'
    ?await guardarAccionCategoriaRomoQA({db,identity,mutation})
    :await guardarAccionCartaRomoQA({db,identity,mutation});
  return Object.freeze({ok:true,storeId:STORE,area,revision:result.revision});
}
export const ROMO_PANEL_CARTA_QA_NO_PUBLICADO=true;
