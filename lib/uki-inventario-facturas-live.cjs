'use strict';
const unidades=require('./uki-inventario-unidades-live.cjs');
function err(message,status=400){return Object.assign(Error(message),{status});}
function rutNormalizado(rut){
 const s=String(rut??'').replace(/[.\s]/g,'').toUpperCase();
 if(!/^\d{7,8}-[\dK]$/.test(s))throw err('Revisa el RUT del proveedor para evitar facturas duplicadas.');
 const [digits,dv]=s.split('-');let sum=0,f=2;
 for(let i=digits.length-1;i>=0;i--){sum+=Number(digits[i])*f;f=f===7?2:f+1;}
 const mod=11-(sum%11),calculated=mod===11?'0':mod===10?'K':String(mod);
 if(calculated!==dv)throw err('El RUT del proveedor no es válido. Verifica el documento.');
 return s;
}
function identidad(input){
 if(!input||typeof input!=='object')throw err('Factura inválida');
 const rut=rutNormalizado(input.rut_emisor);
 const tipo=String(input.tipo_doc||'33').trim();
 const folio=String(input.folio||'').trim();
 if(!/^\d{2,3}$/.test(tipo)||!/^\d{1,15}$/.test(folio))
  throw err('Indica el tipo y folio de la factura correctamente.');
 return {rut,tipo,folio};
}
function linea(input,item){
 const {rut,tipo,folio}=identidad(input);
 const index=Number(input.linea),entrega=Number(input.entrega??1);
 if(!Number.isSafeInteger(index)||index<1||index>500||
    !Number.isSafeInteger(entrega)||entrega<1||entrega>50)
  throw err('Número de línea o de entrega inválido.');
 const description=String(input.descripcion||'').trim().replace(/\s+/g,' ');
 if(description.length<3||description.length>180)throw err('Descripción del artículo incorrecta.');
 if(!item||!['ingredient','inventory'].includes(item.kind))
  throw err('Solo pueden registrarse ingredientes o insumos de inventario.');
 if(item.kind==='ingredient'&&Number(item.version)===0)
  throw err('Administración debe configurar antes la unidad de este ingrediente.',409);
 if(!Number.isSafeInteger(input.expected_version)||Number(item.version)!==input.expected_version)
  throw err('El artículo cambió en otro celular. Actualiza el inventario.',409);
 const amount=unidades.convertir(input.cantidad,input.unidad,item.stock_unit);
 const limit=unidades.convertir(input.cantidad_total,input.unidad_total,item.stock_unit);
 if(amount<=0||limit<=0||amount>limit)throw err('La cantidad recibida supera la cantidad prevista para esta factura.');
 const request=String(input.request_id||'');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(request))
  throw err('Falta identificador de recepción; vuelve a abrir la factura.');
 return {rut,tipo,folio,index,entrega,description,amount,limit,request,
  cantidad:input.cantidad,unidad:input.unidad};
}
module.exports={rutNormalizado,identidad,linea};
