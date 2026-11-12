/**
 * Adaptadores QA Romo -> lectura del mismo panel Uki.
 * No importan las funciones operativas Uki, ni escriben, ni activan ventas.
 */
import {normalizeRomoCatalog,ROMO_STORE_ID} from './romo-catalogo-integracion-qa.mjs';
import {normalizeRomoInventory} from './romo-inventario-integracion-qa.mjs';
function version(n){if(!Number.isSafeInteger(n)||n<0)throw Error('Revisión Romo inválida');return n;}
function product(p,group){return {storeId:ROMO_STORE_ID,sku:p.sku,kind:p.kind,group,
 name:p.name,description:p.description,price:p.price,available:p.available,
 visible:p.visible,custom:true,soloLecturaQA:true};}
export function romoPanelCartaLecturaQA({revision,catalog}={}){
 const c=normalizeRomoCatalog(catalog),v=version(revision);
 const items=[...c.productos.map(p=>product(p,'productos')),
 ...c.promociones.map(p=>({...product(p,'promos'),kind:'monthly',promoType:p.kind,
 pieces:p.pieces,rollCount:p.rollCount,piecesPerRoll:p.piecesPerRoll,
 sauceCount:p.sauceCount,korokes:p.korokes,photoId:p.photoId||null,payments:Array.isArray(p.payments)?p.payments:[]}))];
 return {brand:'romo',branch:'serena',storeId:ROMO_STORE_ID,revision:v,
 soloLecturaQA:true,puedeRegistrarPedidos:false,items,
 ingredientes:c.ingredientes.map(p=>({...product(p,p.kind),kind:'ingredient',ingredientType:p.kind})),
 totalProductos:c.productos.length,totalPromociones:c.promociones.length,totalIngredientes:c.ingredientes.length};
}
export function romoPanelInventarioLecturaQA({revision,inventory}={}){
 const data=normalizeRomoInventory(inventory);
 return {brand:'romo',branch:'serena',storeId:ROMO_STORE_ID,revision:version(revision),
 soloLecturaQA:true,puedeModificarCaja:false,articulos:data.items.map(i=>({
 ...i,diferencia:Number((i.recibido-i.hay).toFixed(3)),
 reponer:Number(Math.max(0,i.minimo-i.hay).toFixed(3))}))};
}
export function romoCartaPublicaVistaQA({revision,catalog}={}){
 const data=romoPanelCartaLecturaQA({revision,catalog});
 return {storeId:ROMO_STORE_ID,revision:data.revision,ventaHabilitada:false,
 productos:data.items.filter(p=>p.visible&&p.available),
 ingredientes:data.ingredientes.filter(p=>p.visible&&p.available)};
}
export function romoCatalogoListoParaRevisarQA({revision,catalog,fotosPorSku={}}={}){
 const view=romoCartaPublicaVistaQA({revision,catalog});
 const promos=view.productos.filter(x=>x.kind==='monthly');
 const faltanFotos=promos.filter(x=>fotosPorSku[x.sku]!==true).map(x=>x.sku);
 return {storeId:ROMO_STORE_ID,revision:view.revision,
 productosPublicados:view.productos.length,promocionesPublicadas:promos.length,
 faltanFotos,listaParaRevision:view.productos.length>0&&faltanFotos.length===0,
 ventaHabilitada:false};
}
