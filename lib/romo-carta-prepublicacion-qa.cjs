'use strict';
/**
 * Convierte BORRADORES Romo a un paquete de prepublicación PRIVADO.
 * No tiene funciones de escritura ni firma de publicación. Publicable siempre FALSE.
 * Contrato de las APIs actuales de carta QA:
 *  sku prefix kind, group entradas para dish personalizado y promos para monthly.
 */
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const SAFE=/^[a-z0-9][a-z0-9-]{1,44}$/;
const INT=x=>Number.isSafeInteger(x);
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
function prepararCartaRomoQA(vista,admin){
 if(!OBJ(vista)||vista.ok!==true||vista.storeId!==STORE||
    vista.readOnly!==true||vista.draftOnly!==true||vista.publishable!==false||
    !INT(vista.revisionComercial)||!INT(vista.revisionAdministracion)||
    !Array.isArray(vista.products)||vista.products.length<40||
    !Array.isArray(vista.categories)||!Array.isArray(vista.ingredients))
  throw Error('Prepublicación: carta Romo QA no verificada');
 const blockers=[],items=[],seen=new Set();
 const pushBlocker=(msg)=>{if(!blockers.includes(msg))blockers.push(msg)};
 const categories=[];
 for(const x of vista.categories){
  if(!OBJ(x)||!SAFE.test(x.slug)||typeof x.nombre!=='string'||x.nombre.trim().length<2||
     x.nombre.length>45||categories.some(c=>c.slug===x.slug))
   throw Error('Prepublicación: categoría incompatible');
  categories.push({slug:x.slug,nombre:x.nombre});
 }
 if(categories.length>50)pushBlocker('La carta pública admite como máximo 50 categorías');
 const data=admin?.data||{};
 if(!OBJ(data))throw Error('Estado administrativo incompatible');
 if((data.ingredients||[]).length||Object.keys(data.ingredientOverrides||{}).length)
  pushBlocker('Conectar recargos e ingredientes editados con el armado de la carta pública');
 for(const product of vista.products){
  if(!OBJ(product)||typeof product.sku!=='string'||
     !INT(product.precioOriginal)||product.precioOriginal<1||
     !INT(product.precioFinal)||product.precioFinal<1)
   throw Error('Prepublicación: producto inválido');
  const custom=product.sku.startsWith('custom:');
  const promo=product.sku.startsWith('promo:');
  let sku=product.sku,kind=product.kind;
  if(custom){
   if(!uuid.test(product.sku.slice(7)))throw Error('Identificador de producto propio inválido');
   kind='dish';sku='dish:romoq-'+product.sku.slice(7).toLowerCase();
  }else if(promo){
   if(!uuid.test(product.sku.slice(6)))throw Error('Identificador de promoción propia inválido');
   kind='monthly';sku='monthly:romoq-'+product.sku.slice(6).toLowerCase();
  }
  if(!['classic','premium','dish','monthly','topping','extra'].includes(kind)||
     !sku.startsWith(kind+':')||!/^[a-z]+:[a-z0-9-]+$/.test(sku)||
     seen.has(sku))throw Error('Prepublicación: SKU incompatible o duplicado');
  seen.add(sku);
  const row={sku,kind,name:product.name,price:product.precioOriginal,
   description:product.description||'',available:product.available!==false,
   visible:product.available!==false,
   categoriaSlug:product.categoriaSlug||'',
   group:promo?'promos':custom?'entradas':product.categoriaSlug||'',
   custom:custom||promo};
  if(promo){
   row.config={
    promoType:product.promoType||'sushi',
    rollCount:product.rollCount,piecesPerRoll:product.piecesPerRoll,
    size:product.promoType==='sushi'?product.rollCount*product.piecesPerRoll:0,
    sauceCount:product.sauceCount,korokes:product.korokes,
    customizable:product.promoType==='sushi',
    payments:product.payments
   };
   if(!['sushi','combo','gohan'].includes(row.config.promoType)||
      !INT(row.config.rollCount)||!INT(row.config.sauceCount)||
      !Array.isArray(row.config.payments))
    throw Error('Prepublicación: promoción incompleta');
   if(row.config.payments.includes('junaeb'))
    pushBlocker('Falta incorporar Junaeb al guardado público de promociones nuevas');
   if(product.photoVersion===0)
    pushBlocker('Las promociones nuevas necesitan una foto real antes de mostrarse a clientes');
  }
  if(product.descuentoPorcentaje>0)
   pushBlocker('Mostrar el precio original tachado y el descuento en la carta pública');
  if(product.photoVersion>0)
   pushBlocker('Vincular fotografías privadas con el almacenamiento comercial seguro de Romo');
  if(product.available===false)
   pushBlocker('Revisar agotados sin retirar definitivamente productos de la carta');
  items.push(row);
 }
 if(items.length>600)pushBlocker('La carta pública admite hasta 600 productos');
 pushBlocker('Probar entrega, retiro, consumo, pagos y recepción en el panel antes de publicar');
 pushBlocker('Falta revisión final y autorización explícita de dueños');
 return {
  ok:true,storeId:STORE,readOnly:true,draftOnly:true,publishable:false,
  action:'prepublicacion-solo-lectura',
  revisionComercial:vista.revisionComercial,
  revisionAdministracion:vista.revisionAdministracion,
  summary:{productos:items.length,categorias:categories.length,
   nuevos:items.filter(x=>x.custom).length,bloqueos:blockers.length},
  categorias:categories,items,
  pendientes:blockers,
  aviso:'Contrato de adaptación validado solo en memoria. No crea, modifica ni publica una carta y no activa pedidos.'
 };
}
module.exports={prepararCartaRomoQA};
