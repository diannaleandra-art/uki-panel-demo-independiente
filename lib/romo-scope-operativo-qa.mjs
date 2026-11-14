/**
 * Romo's Sushi — reglas compartidas, SIN red ni escrituras.
 * Este módulo NO autentica: el backend deberá obtener 'identity' exclusivamente
 * de un token verificado y de roles guardados por el servidor, NUNCA del body.
 * No habilitar hasta contar con roles/RLS reales y tests de extremo a extremo.
 */
export const BRAND='romo';
export const BRANCHES=Object.freeze(['serena']); // Un solo local Romo aprobado: Balmaceda 1612
export const ROLES=Object.freeze(['duenos','agendador','inventario']);
export const OPERATIONS=Object.freeze({
  'catalog.read': ['duenos','agendador','inventario'],
  'catalog.write': ['duenos'],
  'inventory.read': ['duenos','agendador','inventario'],
  'inventory.write': ['duenos','agendador','inventario'],
  'orders.read': ['duenos','agendador'],
  'orders.accept': ['duenos','agendador'],
  'orders.edit': ['duenos','agendador'],
  'orders.reject': ['duenos','agendador'],
  'cash.read': ['duenos','agendador'],
  'cash.write': ['duenos','agendador'],
  'cash.close': ['duenos','agendador'],
  'owners.read': ['duenos'],
  'owners.write': ['duenos']
});
const SOURCES=Object.freeze(['carta','mesa','whatsapp','manual']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function romoScope(brand,branch){
  if(brand!==BRAND)throw new Error('No se permite mezclar datos de Uki con Romo');
  if(!BRANCHES.includes(branch))throw new Error('Sucursal Romo inválida');
  return BRAND+':'+branch;
}

/** Publica solo el catálogo previamente filtrado y validado en servidor. */
export function publicCatalogScope(brand,branch){
  return romoScope(brand,branch);
}

/**
 * La identidad DEBE proceder del servidor después de verificar la sesión,
 * los roles y las sucursales autorizadas en una fuente confiable.
 * NO pasar req.body, query params, user_metadata ni JWT no verificado aquí.
 */
export function authorizeRomoOperation(identity,brand,branch,operation){
  const scope=romoScope(brand,branch);
  if(!Object.hasOwn(OPERATIONS,operation))throw new Error('Operación no permitida');
  if(!identity || typeof identity!=='object' || typeof identity.userId!=='string' ||
     !/^[A-Za-z0-9_-]{1,128}$/.test(identity.userId))
    throw new Error('Identidad verificada obligatoria');
  if(identity.brand!==BRAND || !ROLES.includes(identity.role))
    throw new Error('La identidad no pertenece a Romo');
  if(identity.role!=='duenos' &&
     (!Array.isArray(identity.branches) || !identity.branches.includes(branch) ||
      identity.branches.some(id=>!BRANCHES.includes(id))))
    throw new Error('Sin permiso para esta sucursal');
  if(!OPERATIONS[operation].includes(identity.role))
    throw new Error('Este rol no tiene permiso');
  return Object.freeze({scope,branch,brand:BRAND,operation,actorId:identity.userId,role:identity.role});
}

/** Genera una clave estable para reintentos del MISMO pedido, no para deduplicar
 * mensajes diferentes ni ingresos manuales sin vínculo al pedido original. */
export function orderRetryKey(brand,branch,source,requestId){
  const scope=romoScope(brand,branch);
  if(!SOURCES.includes(source))throw new Error('Origen de pedido inválido');
  if(typeof requestId!=='string'||!UUID.test(requestId))
    throw new Error('Identificador único de pedido inválido');
  return scope+':'+source+':'+requestId.toLowerCase();
}

export function normalizePendingOrder(brand,branch,source,requestId,items){
  const key=orderRetryKey(brand,branch,source,requestId);
  if(!Array.isArray(items)||items.length<1||items.length>80)
    throw new Error('El pedido debe contener productos');
  // Un pedido recibido no se convierte en venta ni ingreso de caja.
  return Object.freeze({key,brand:BRAND,branch,source,status:'pendiente',
    accepted:false,paid:false,countsAsSale:false});
}
