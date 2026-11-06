// Inventario Uki Sushi QA — lectura local de facturas, sin IA de pago.
const unidades={kg:'kg',kgs:'kg',kilo:'kg',kilos:'kg',kilogramo:'kg',kilogramos:'kg',
 g:'g',gr:'g',grs:'g',gramo:'g',gramos:'g',l:'l',lt:'l',lts:'l',litro:'l',litros:'l',
 ml:'ml',cc:'ml',mililitros:'ml',mililitro:'ml',
 un:'un',und:'un',uds:'un',unidad:'un',unidades:'un',u:'un',
 porcion:'porciones',porciones:'porciones'};
export function normalizar(texto=''){
 return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
export function unidadFactura(texto=''){
 return unidades[normalizar(texto).replace(/\s/g,'')]||'';
}
export function numeroFactura(texto){
 const s=String(texto??'').trim();
 if(!/^\d{1,6}(?:[.,]\d{1,3})?$/.test(s))return NaN;
 const n=Number(s.replace(',','.'));return Number.isFinite(n)&&n>0&&n<=100000?n:NaN;
}
export function coincidencia(nombre,items=[]){
 const n=normalizar(nombre);
 if(!n)return {sku:'',sugerencia:''};
 const exactos=items.filter(i=>normalizar(i.name)===n);
 if(exactos.length===1)return {sku:exactos[0].sku,sugerencia:exactos[0].name,exacto:true};
 const compatibles=items.filter(i=>{
  const v=normalizar(i.name);return v.length>=4&&(n.includes(v)||v.includes(n));
 });
 return {sku:'',sugerencia:compatibles.length===1?compatibles[0].name:'',exacto:false};
}
export function leerTextoFactura(texto,items=[]){
 const salida=[],vistas=new Set();
 for(const lineaCruda of String(texto||'').split(/\r?\n/).slice(0,180)){
  const linea=lineaCruda.replace(/\s+/g,' ').trim();
  if(linea.length<3||/^(?:total|subtotal|iva|neto|descuento|rut|fecha|folio|factura|boleta|sucursal|proveedor|cantidad\s|precio\s|monto\s)/i.test(normalizar(linea)))continue;
  let nombre='',cantidad='',unidad='',confianza='revisar';
  const alFinal=linea.match(/^(.{3,75}?)\s+(\d{1,6}(?:[.,]\d{1,3})?)\s*(kg|kgs|kilo|kilos|gr|grs|g|lt|lts|l|ml|cc|un|und|uds|unidad(?:es)?|porciones?)\b(?:\s+\$?[\d.,]+)?$/i);
  const alInicio=linea.match(/^(\d{1,6}(?:[.,]\d{1,3})?)\s*(kg|kgs|kilo|kilos|gr|grs|g|lt|lts|l|ml|cc|un|und|uds|unidad(?:es)?|porciones?)\b\s+(.{3,75})$/i);
  if(alFinal){nombre=alFinal[1];cantidad=alFinal[2];unidad=unidadFactura(alFinal[3]);}
  else if(alInicio){cantidad=alInicio[1];unidad=unidadFactura(alInicio[2]);nombre=alInicio[3];}
  else {
   const m=coincidencia(linea,items);
   if(!m.exacto&&!m.sugerencia)continue;
   nombre=linea;
  }
  if(!nombre||!Number.isFinite(numeroFactura(cantidad))&&cantidad)continue;
  const match=coincidencia(nombre,items);
  const key=normalizar(linea);
  if(vistas.has(key))continue;vistas.add(key);
  salida.push({nombre,cantidad,unidad,sku:match.exacto?match.sku:'',sugerencia:match.sugerencia,
   origen:'foto',confianza});
  if(salida.length>=55)break;
 }
 return salida;
}
const hijos=(node,name)=>Array.from(node?.children||[]).filter(x=>x.localName===name);
const primer=(node,name)=>hijos(node,name)[0]||null;
const contenido=(node,name)=>primer(node,name)?.textContent?.trim()||'';
export function leerDTE(contenidoXML,parsear){
 const parser=parsear||(typeof DOMParser!=='undefined'?new DOMParser():null);
 if(!parser)throw Error('No hay lector de XML disponible.');
 const doc=parser.parseFromString(contenidoXML,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('XML inválido. Selecciona la factura electrónica original.');
 const documentos=Array.from(doc.getElementsByTagName('*')).filter(e=>e.localName==='Documento');
 if(documentos.length!==1)throw Error('Selecciona un XML de una sola factura o guía, no un sobre con varias.');
 const d=documentos[0],cab=primer(d,'Encabezado'),id=primer(cab,'IdDoc'),emisor=primer(cab,'Emisor');
 const detalle=hijos(d,'Detalle').map(n=>({
  nombre:contenido(n,'NmbItem')||contenido(n,'DscItem'),
  cantidad:contenido(n,'QtyItem'),
  unidad:unidadFactura(contenido(n,'UnmdItem')),
  unidadOriginal:contenido(n,'UnmdItem'),
  origen:'xml'
 })).filter(x=>x.nombre);
 if(!detalle.length)throw Error('No se encontraron productos en el detalle de la factura.');
 return {proveedor:contenido(emisor,'RznSoc'),rut:contenido(emisor,'RUTEmisor'),
  folio:contenido(id,'Folio'),tipo:contenido(id,'TipoDTE'),fecha:contenido(id,'FchEmis'),
  detalle:detalle.slice(0,80)};
}
export function filasDTE(dte,items=[]){
 return dte.detalle.map(item=>{
  const m=coincidencia(item.nombre,items);
  const cantidad=Number.isFinite(numeroFactura(item.cantidad))?item.cantidad:'';
  return {...item,cantidad,sku:m.exacto?m.sku:'',sugerencia:m.sugerencia,
   confianza:'revisar'};
 });
}
