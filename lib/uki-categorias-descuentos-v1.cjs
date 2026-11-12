'use strict';
// Cálculos puros y validaciones para Carta Uki. No alteran caja, pedido ni inventario.
// El precio guardado en las tablas existentes sigue siendo el precio ORIGINAL.
function precioConDescuento(precioOriginal,porcentaje){
  if(!Number.isSafeInteger(precioOriginal)||precioOriginal<1||precioOriginal>1000000)
    throw Error('Precio original inválido');
  if(!Number.isSafeInteger(porcentaje)||porcentaje<0||porcentaje>99)
    throw Error('El descuento debe estar entre 0 y 99%');
  return Math.max(1,Math.round(precioOriginal*(100-porcentaje)/100));
}
function nombreCategoria(valor){
  if(typeof valor!=='string')return '';
  const limpio=valor.trim().replace(/\s+/g,' ');
  return limpio.length>=2&&limpio.length<=45&&!/[<>\u0000-\u001f]/.test(limpio)?limpio:'';
}
function claveCategoria(nombre){
  const valid=nombreCategoria(nombre);if(!valid)return '';
  return valid.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45);
}
function descuentoValido(pct){return Number.isSafeInteger(pct)&&pct>=0&&pct<=99;}
function categoriaValida(slug){return typeof slug==='string'&&/^[a-z0-9][a-z0-9-]{1,44}$/.test(slug);}
function mostrarDescuento(item,metadata){
  const pct=Number(metadata?.discount_percent||0);
  const precioOriginal=Number(item.price);
  if(!Number.isSafeInteger(precioOriginal)||precioOriginal<1||precioOriginal>1000000
   ||!descuentoValido(pct))return {...item,precioOriginal:item.price,descuentoPorcentaje:0};
  return {...item,precioOriginal,descuentoPorcentaje:pct,precioFinal:precioConDescuento(precioOriginal,pct),
    price:precioConDescuento(precioOriginal,pct),
    descuentoVersion:Number(metadata?.version||0)};
}
module.exports={precioConDescuento,nombreCategoria,claveCategoria,descuentoValido,categoriaValida,mostrarDescuento};
