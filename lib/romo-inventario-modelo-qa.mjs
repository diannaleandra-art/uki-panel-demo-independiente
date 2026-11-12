/**
 * Romo — puente de inventario sólo de validación, sin conexión ni escrituras.
 * Conserva nombres, cantidades, disponibilidad y unidades por sucursal.
 */
export const ROMO_INVENTORY_STORE_ID='romo:serena';
const units=new Set(['unidad','un','g','kg','ml','l','porciones']);
const quantity=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=10000000;
export function reportRomoInventory(storeId,items){
 if(storeId!==ROMO_INVENTORY_STORE_ID)throw Error('Inventario cruzado entre Uki y Romo');
 if(!Array.isArray(items)||items.length>1500)throw Error('Inventario inválido');
 const seen=new Set(),seenNames=new Set();
 return items.map(x=>{
  if(!x||typeof x!=='object'||!(/^[a-z0-9:_-]{1,100}$/.test(x.id||''))||
     !String(x.name||'').trim()||String(x.name).length>100||
     !units.has(x.unit)||/^(?:uki|arica|serena):/i.test(x.id)||!quantity(x.recibido)||!quantity(x.hay)||
     !quantity(x.minimo)||seen.has(x.id)||
     (x.disponible!==undefined&&typeof x.disponible!=='boolean')||
     seenNames.has(x.name.trim().toLocaleLowerCase('es-CL')))
     throw Error('Artículo de inventario inválido');
  seen.add(x.id);seenNames.add(x.name.trim().toLocaleLowerCase('es-CL'));
  // Llegó - Hay: diferencia de conteo, no representa necesariamente una venta.
  const diferencia=Number((x.recibido-x.hay).toFixed(3));
  const reponer=Number(Math.max(0,x.minimo-x.hay).toFixed(3));
  return {id:x.id,name:x.name.trim(),unit:x.unit,recibido:x.recibido,
   hay:x.hay,diferencia,reponer,disponible:x.disponible!==false};
 });
}
