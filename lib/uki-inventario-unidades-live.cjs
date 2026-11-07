'use strict';
// Conversión exacta para inventario aislado. No convierte unidades a peso/volumen.
const FACTORES=Object.freeze({kg:1000,g:1,l:1000,ml:1,un:1,porciones:1});
const GRUPOS=Object.freeze({kg:'peso',g:'peso',l:'volumen',ml:'volumen',un:'unidad',porciones:'porcion'});
const OPCIONES=Object.freeze({kg:['kg','g'],g:['g','kg'],l:['l','ml'],ml:['ml','l'],un:['un'],porciones:['porciones']});
function error(m){return Object.assign(Error(m),{status:400});}
function cantidad(valor,unidad){
 if(typeof valor!=='number'||!Number.isFinite(valor)||valor<0||valor>100000)
  throw error('La cantidad debe ser un número válido entre 0 y 100.000.');
 if(!Object.hasOwn(FACTORES,unidad))throw error('Selecciona una unidad válida.');
 const precision=Math.round(valor*1000);
 if(Math.abs(valor*1000-precision)>1e-7)throw error('Escribe como máximo tres decimales.');
 if((unidad==='un'||unidad==='porciones')&&!Number.isInteger(valor))
  throw error('Las unidades y porciones se cuentan con números enteros.');
 return precision/1000;
}
function convertir(valor,origen,destino){
 const n=cantidad(valor,origen);
 if(!Object.hasOwn(FACTORES,destino))throw error('La unidad configurada no es válida.');
 if(GRUPOS[origen]!==GRUPOS[destino]||!OPCIONES[destino].includes(origen))
  throw error('No se pueden mezclar '+origen+' y '+destino+'. Administración debe configurar la unidad real del artículo.');
 const convertido=n*FACTORES[origen]/FACTORES[destino];
 if(convertido>100000)throw error('La cantidad convertida supera el límite del artículo.');
 const mil=Math.round(convertido*1000);
 if(Math.abs(convertido*1000-mil)>1e-7)
  throw error('La conversión requiere más precisión que tres decimales; usa otra unidad de inventario.');
 return mil/1000;
}
module.exports={FACTORES,GRUPOS,OPCIONES,cantidad,convertir};
