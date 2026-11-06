// Inventario Uki Sushi QA — lectura local de facturas, sin IA de pago.
const unidades={kg:'kg',kgs:'kg',kilo:'kg',kilos:'kg',kilogramo:'kg',kilogramos:'kg',
 g:'g',gr:'g',grs:'g',gramo:'g',gramos:'g',l:'l',lt:'l',lts:'l',litro:'l',litros:'l',
 ml:'ml',cc:'ml',mililitros:'ml',mililitro:'ml',
 un:'un',und:'un',unds:'un',uds:'un',unidad:'un',unidades:'un',u:'un',
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

function propuestaPresentacion(nombre,cantidadFactura,unidadOriginal){
 const desc=String(nombre||''),q=numeroFactura(cantidadFactura);
 if(!Number.isFinite(q))return {cantidad:'',unidad:'',nota:'Cantidad de factura no válida; verifica el documento.'};
 if(unidadOriginal!=='un'){
  return {cantidad:cantidadFactura,unidad:unidadOriginal,
   nota:'Cantidad facturada; confirma cuánto llegó antes de recibir.'};
 }
 const convertirTipo=t=>{
  const u=unidadFactura(t);
  return u||(/hojas/i.test(t)?'un':'');
 };
 const factor=desc.match(/(?:^|[\s(])(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|kgs|gr|grs|g|lt|lts|l|ml|und|unds|hojas)\b/i);
 const sencilla=desc.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|gr|grs|g|lt|lts|l|ml|und|unds|hojas)\b/i);
 let factorPorBulto=NaN,baseUnidad='',detalle='';
 if(factor){
  const p=numeroFactura(factor[1]),t=numeroFactura(factor[2]);
  factorPorBulto=p*t;baseUnidad=convertirTipo(factor[3]);
  detalle=factor[1]+' × '+factor[2]+' '+factor[3];
 }else if(sencilla){
  factorPorBulto=numeroFactura(sencilla[1]);baseUnidad=convertirTipo(sencilla[2]);
  detalle=sencilla[1]+' '+sencilla[2];
 }else if(/\bX\s*KG\b/i.test(desc)){
  // Propuesta por descripción «barra X KG», no certeza de peso efectivamente recibido.
  return {cantidad:cantidadFactura,unidad:'kg',
   nota:'Artículo vendido por peso: la factura dice '+cantidadFactura+' Un y «X KG». Confirma kilos reales antes de registrar.'};
 }else{
  // Únicamente se conoce cantidad de bultos, no su contenido.
  return {cantidad:cantidadFactura,unidad:'un',
   nota:'La factura informa '+cantidadFactura+' Un, sin equivalencia por empaque. Confirma cómo se controla en inventario.'};
 }
 const total=Math.round(q*factorPorBulto*1000)/1000;
 if(!baseUnidad||!Number.isFinite(total)||total<=0||total>100000
  ||Math.abs(q*factorPorBulto*1000-total*1000)>1e-6){
  return {cantidad:'',unidad:'',nota:'No se pudo calcular el contenido del paquete. Completa la cantidad recibida.'};
 }
 return {cantidad:String(total),unidad:baseUnidad,
  nota:'Sugerencia por presentación: '+cantidadFactura+' Un × '+detalle+' = '+total+' '+baseUnidad+
   '. Verifica cuánta mercadería llegó realmente antes de guardar.'};
}
export function leerCabeceraFacturaPDF(texto){
 const s=String(texto||'');
 const folio=s.match(/(?:N[°º]\s*|Folio\s*:?\s*)(\d{4,10})\b/i)?.[1]||'';
 const rut=s.match(/R\.?\s*U\.?\s*T\.?\s*:\s*([\d.]{7,12}-[\dkK])/i)?.[1]||'';
 const proveedor=s.match(/^\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s.]{5,95}\b(?:SPA|S\.A\.|LTDA))\s*$/m)?.[1]?.trim()||'';
 const sucursalSugerida=/OBSERVACI[ÓO]N:?\s*REGIMIENTO/i.test(s)?'arica':'';
 return {folio,rut,proveedor,sucursalSugerida};
}

export function leerTextoFactura(texto,items=[]){
 const salida=[],vistas=new Set();
 for(const lineaCruda of String(texto||'').split(/\r?\n/).slice(0,180)){
  const linea=lineaCruda.replace(/\s+/g,' ').trim();
  if(linea.length<3||/^(?:total|subtotal|iva|neto|descuento|rut|fecha|folio|factura|boleta|sucursal|proveedor|cantidad\s|precio\s|monto\s)/i.test(normalizar(linea)))continue;
  // PDF chileno con columnas: descripción | cantidad | unidad | precio | total.
  // Separar desde la derecha: los números en la descripción son presentaciones,
  // mientras que los dos números de la derecha son montos en pesos.
  const tabla=linea.match(/^(.{3,180}?)\s+(\d{1,6}(?:[.,]\d{1,3})?)\s+(Un|Und|Uds|Kg|Kgs|G|Gr|Grs|Lt|Lts|L|Ml|Porciones?)\s+(\d{1,3}(?:\.\d{3})*|\d+)\s+(?:[-–—]\s*)?(\d{1,3}(?:\.\d{3})*|\d+)$/i);
  if(tabla){
   const nombreTabla=tabla[1],qFactura=tabla[2],uFactura=unidadFactura(tabla[3]);
   const proposed=propuestaPresentacion(nombreTabla,qFactura,uFactura);
   const match=coincidencia(nombreTabla,items),key=normalizar(linea);
   if(!vistas.has(key)){
    vistas.add(key);
    salida.push({nombre:nombreTabla,cantidad:proposed.cantidad,unidad:proposed.unidad,
     cantidadFactura:qFactura,unidadFacturada:uFactura,
     precioUnitario:tabla[4],precioTotal:tabla[5],sku:match.exacto?match.sku:'',
     sugerencia:match.sugerencia,origen:'pdf',confianza:'revisar',nota:proposed.nota,
     requiereConfirmacion:true});
   }
   if(salida.length>=55)break;
   continue;
  }
  let nombre='',cantidad='',unidad='',confianza='revisar',nota='';
  // Una factura puede vender 1 paquete de 12 kg; 1 un NO equivale siempre
  // a 12 kg recibidos. Detectar la presentación sin inventar una entrada.
  const empaque=linea.match(/^(.{3,110}?)\s+(\d{1,4}(?:[.,]\d{1,3})?)\s*(kg|kgs|g|gr|grs|l|lt|lts|ml|cc)\s+(\d{1,5})\s*(un|und|uds|unidad(?:es)?)\b(?:\s+\$?[\d.,]+(?:\s*[-–—]\s*\$?[\d.,]+)?)?$/i);
  if(empaque){
   const match=coincidencia(empaque[1],items);
   if(!match.exacto&&!match.sugerencia)continue;
   const key=normalizar(linea);
   if(vistas.has(key))continue;vistas.add(key);
   salida.push({nombre:linea,cantidad:'',unidad:'',sku:'',sugerencia:match.sugerencia,
    origen:'foto',confianza:'revisar',
    nota:'Documento: '+empaque[4]+' '+empaque[5]+' de una presentación indicada de '+empaque[2]+' '+unidadFactura(empaque[3])+'. Verifica peso recibido; no se convierte automáticamente.'});
   if(salida.length>=55)break;
   continue;
  }
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
   origen:'foto',confianza,nota});
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
