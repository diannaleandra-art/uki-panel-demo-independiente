import {leerDTE,filasDTE,leerTextoFactura,leerCabeceraFacturaPDF,numeroFactura} from './uki-factura-lectura-qa.mjs';
export function iniciarFacturaQA({getBranch,getItems,post,onSaved}){
 const section=document.createElement('section');section.id='facturaQA';section.className='card';
 section.innerHTML="<h2>📷 Recibir mercadería con factura</h2>\n<p class=\"muted\">Gratis: toma una foto o sube una factura. Revisa las cantidades antes de guardar. La foto se procesa en tu teléfono y no se envía al servidor.</p>\n<div class=\"fact-botones\"><label for=\"factFoto\">📷 Tomar foto</label><input id=\"factFoto\" type=\"file\" accept=\"image/*\" capture=\"environment\">\n<label for=\"factArchivo\">Subir archivo</label><input id=\"factArchivo\" type=\"file\" accept=\"image/*,.xml,application/xml,.pdf,application/pdf\"></div>\n<p id=\"factEstado\" role=\"status\" class=\"muted\">Fotos, XML y PDF con texto. El ingreso manual sigue disponible.</p>\n<div id=\"factTextoBox\" hidden><label for=\"factTexto\">Texto leído (corrígelo si hay errores)</label>\n<textarea id=\"factTexto\" rows=\"4\" maxlength=\"20000\" style=\"width:100%;font:inherit;border:1px solid #d5c4b6;border-radius:9px\"></textarea>\n<button type=\"button\" class=\"secondary\" id=\"factReleer\">Volver a detectar productos</button></div>\n<div id=\"factLineas\"></div>\n<div id=\"factAcciones\" hidden><button type=\"button\" class=\"secondary\" id=\"factAnadir\">Añadir línea manual</button>\n<button type=\"button\" id=\"factGuardar\">Confirmar mercadería recibida</button>\n<p id=\"factResultado\" role=\"status\"></p><p class=\"muted small\">Las entradas marcadas se guardan individualmente. Si hay un error, revisa el saldo antes de intentar otra vez.</p></div>\n<style>#facturaQA .fact-botones{display:flex;gap:8px;flex-wrap:wrap}\n#facturaQA .fact-botones input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}\n#facturaQA .fact-botones label{display:inline-block;background:#e9822d;color:white;border-radius:9px;padding:12px;cursor:pointer}\n#facturaQA .fact-fila{border:1px solid #eadbcc;border-radius:10px;padding:12px;margin:9px 0}\n#facturaQA .fact-fila select,#facturaQA .fact-fila input[type=text]{width:100%}\n#facturaQA .fact-columnas{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n#facturaQA .fact-mensaje{background:#fff6e9;border-radius:8px;padding:8px}\n#facturaQA .fact-guardada{background:#f0f9ef;border-radius:8px;padding:8px;color:#25612c}\n#facturaQA button{margin:8px 6px 0 0}\n@media(max-width:470px){#facturaQA .fact-columnas{grid-template-columns:1fr}}</style>";
 const itemsContainer=document.getElementById('items');
 itemsContainer.parentNode.insertBefore(section,itemsContainer);
 const el=id=>section.querySelector('#'+id), estado=t=>{el('factEstado').textContent=t;};
 const make=(tag,parent,text,cls)=>{
  const node=document.createElement(tag);if(text!==undefined)node.textContent=text;
  if(cls)node.className=cls;if(parent)parent.append(node);return node;
 };
 const units=['','kg','g','l','ml','un','porciones'],factors={kg:1000,g:1,l:1000,ml:1,un:1,porciones:1};
 const groups={kg:'peso',g:'peso',l:'volumen',ml:'volumen',un:'unidad',porciones:'porcion'};
 let filas=[],meta={},busy=false;
 const pretty=(n,u)=>Number(n).toLocaleString('es-CL',{maximumFractionDigits:3})+' '+u;
 function convertir(q,from,to){
  if(!Number.isFinite(q)||!factors[from]||!factors[to]||groups[from]!==groups[to])return NaN;
  if((from==='un'||from==='porciones')&&!Number.isInteger(q))return NaN;
  const n=q*factors[from]/factors[to];
  return n<=100000&&Math.abs(n*1000-Math.round(n*1000))<1e-7?Math.round(n*1000)/1000:NaN;
 }
 function valido(f){
  const item=getItems().find(x=>x.sku===f.sku),qty=numeroFactura(f.cantidad);
  const base=item?convertir(qty,f.unidad,item.stock_unit):NaN;
  return {item,base,ok:!!(item&&Number.isFinite(base)&&base>0&&Number(item.stock_qty)+base<=100000)};
 }
 function render(){
  const parent=el('factLineas');parent.replaceChildren();
  if(!filas.length)make('p',parent,'No se reconocieron productos. Corrige el texto o añade una línea manual.','muted');
  const catalog=[...getItems()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  filas.forEach((f,i)=>{
   const card=make('div',parent,undefined,'fact-fila');
   make('strong',card,f.nombre||'Producto sin identificar');
   make('p',card,f.cantidadFactura?
     'Facturado: '+f.cantidadFactura+' '+(f.unidadFacturada||'sin unidad')+
     '. Sugerido para inventario: '+(f.cantidad||'pendiente')+' '+(f.unidad||''):
     'Texto reconocido: '+(f.cantidad||'cantidad desconocida')+' '+(f.unidad||'sin unidad'),'muted small');
   if(f.nota)make('p',card,f.nota,'fact-mensaje');
   if(f.nota)make('p',card,f.nota,'fact-mensaje');
   const grid=make('div',card,undefined,'fact-columnas');
   const box1=make('div',grid);make('label',box1,'Artículo del inventario');
   const select=make('select',box1);select.setAttribute('aria-label','Artículo de línea '+(i+1));
   select.add(new Option('Selecciona el artículo…',''));
   if(f.sugerencia){
    const candidate=catalog.find(x=>x.name===f.sugerencia);
    if(candidate)select.add(new Option('Sugerido: '+candidate.name,candidate.sku));
   }
   for(const item of catalog)if(item.name!==f.sugerencia)select.add(new Option(item.name,item.sku));
   select.value=f.sku||'';
   const box2=make('div',grid);make('label',box2,'Cantidad recibida');
   const input=make('input',box2);input.type='text';input.inputMode='text';input.maxLength=12;
   input.placeholder='Ej.: 750';input.value=f.cantidad||'';
   const box3=make('div',grid);make('label',box3,'Unidad');
   const unit=make('select',box3);
   for(const u of units)unit.add(new Option(u||'Elige unidad…',u));
   unit.value=f.unidad||'';
   const box4=make('div',grid);const label=make('label',box4);
   const check=make('input',label);check.type='checkbox';check.style.width='auto';check.checked=!!f.checked;
   label.append(' Recibir esta línea');
   const info=make('p',card,undefined,'fact-mensaje');
   const preview=()=>{
    const x=valido(f);
    info.textContent=f.saved?'✓ Entrada guardada. No se volverá a sumar.':
     x.ok?'Recibir '+pretty(x.base,x.item.stock_unit)+'. Saldo previsto: '+
       pretty(Math.round((Number(x.item.stock_qty)+x.base)*1000)/1000,x.item.stock_unit):
       'Revisa artículo, cantidad y unidad. No se guardará sin una equivalencia válida.';
    info.className=f.saved?'fact-guardada':'fact-mensaje';
   };
   select.onchange=()=>{f.sku=select.value;preview();};
   input.oninput=()=>{f.cantidad=input.value;preview();};
   unit.onchange=()=>{f.unidad=unit.value;preview();};
   check.onchange=()=>{f.checked=check.checked;preview();};check.disabled=!!f.saved;
   preview();
  });
 }
 function preparar(data,details={}){
  filas=data.map(f=>({...f,checked:false,saved:false}));
  meta=details;el('factAcciones').hidden=false;el('factResultado').textContent='';
  render();
  estado((meta.proveedor?'Proveedor: '+meta.proveedor+'. ':'')+
    (meta.folio?'Folio: '+meta.folio+'. ':'')+
    (meta.sucursalSugerida==='arica'?'Observación: Regimiento Arica. ':'')+
    filas.length+' línea(s). Revisa antes de registrar.');
 }
 function script(url,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  return new Promise((resolve,reject)=>{
   const tag=document.createElement('script');tag.src=url;tag.async=true;tag.crossOrigin='anonymous';
   tag.onload=()=>window[globalName]?resolve(window[globalName]):reject(Error('Lector no disponible.'));
   tag.onerror=()=>reject(Error('No se descargó el lector. Comprueba la conexión.'));
   document.head.append(tag);
  });
 }
 async function foto(file){
  const lib=await script('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
  const worker=await lib.createWorker('spa');
  try{return String((await worker.recognize(file)).data?.text||'');}
  finally{await worker.terminate();}
 }
 async function pdfTexto(file){
  const lib=await script('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib');
  lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const lines=[];
  try{
   for(let p=1;p<=Math.min(pdf.numPages,4);p++){
    const page=await pdf.getPage(p),data=await page.getTextContent(),byY=new Map();
    for(const part of data.items||[]){
     const y=Math.round(part.transform?.[5]||0);
     byY.set(y,[...(byY.get(y)||[]),{x:part.transform?.[4]||0,text:part.str||''}]);
    }
    [...byY].sort((a,b)=>b[0]-a[0]).forEach(row=>
      lines.push(row[1].sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ')));
   }
  }finally{await pdf.destroy();}
  return lines.join('\n');
 }
 async function importar(file){
  if(!file||busy)return;
  if(!getBranch()){estado('Primero abre el inventario de tu sucursal.');return;}
  if(file.size>12*1024*1024){estado('Archivo demasiado grande. Máximo 12 MB.');return;}
  busy=true;el('factGuardar').disabled=true;estado('Leyendo el documento en el dispositivo…');
  try{
   const ext=(file.name.split('.').pop()||'').toLowerCase();
   if(ext==='xml'||file.type.includes('xml')){
    const dte=leerDTE(await file.text());
    el('factTextoBox').hidden=true;el('factTexto').value='';
    preparar(filasDTE(dte,getItems()),dte);
   }else{
    if(ext!=='pdf'&&!file.type.startsWith('image/'))throw Error('Solo imagen, PDF o XML.');
    const texto=ext==='pdf'?await pdfTexto(file):await foto(file);
    el('factTextoBox').hidden=false;el('factTexto').value=texto.slice(0,20000);
    preparar(leerTextoFactura(texto,getItems()),leerCabeceraFacturaPDF(texto));
    if(/\.pdf\b/i.test(texto)&&/\d+\.pdf/i.test(texto)&&
       leerTextoFactura(texto,getItems()).length<=1)
     estado('Parece una foto de la pantalla de un PDF. Para leer la factura completa, pulsa «Subir archivo» y elige el PDF original desde Archivos. No guardes hasta verificar cantidades.');
    if(!texto.trim())estado('No se pudo leer texto; prueba otra foto o agrega productos manualmente.');
   }
  }catch(e){estado('No se pudo leer: '+e.message+'. Puedes ingresar manualmente.');el('factAcciones').hidden=false;}
  finally{busy=false;el('factGuardar').disabled=false;}
 }
 el('factFoto').onchange=e=>importar(e.target.files?.[0]);
 el('factArchivo').onchange=e=>importar(e.target.files?.[0]);
 el('factReleer').onclick=()=>preparar(leerTextoFactura(el('factTexto').value,getItems()));
 el('factAnadir').onclick=()=>{
  filas.push({nombre:'Producto manual',cantidad:'',unidad:'',sku:'',checked:true,saved:false});render();
 };
 el('factGuardar').onclick=async()=>{
  if(busy||!getBranch())return;
  if(meta.sucursalSugerida&&meta.sucursalSugerida!==getBranch()){
   el('factResultado').textContent='La factura indica Regimiento Arica, pero se abrió otra sucursal. Verifica antes de continuar.';
   return;
  }
  const pending=filas.filter(f=>f.checked&&!f.saved);
  if(!pending.length){el('factResultado').textContent='Marca las líneas que recibiste.';return;}
  if(pending.some(f=>!valido(f).ok)){
   el('factResultado').textContent='Corrige las líneas marcadas: artículo, cantidad o unidad incompatible.';render();return;
  }
  const key=meta.folio&&meta.rut?'uki-factura-qa:'+getBranch()+':'+meta.rut+':'+meta.tipo+':'+meta.folio:'';
  if(key){try{if(sessionStorage.getItem(key)==='done'){
   el('factResultado').textContent='Este folio ya fue registrado desde este navegador. Verifica antes de repetir.';
   return;
  }}catch{}}
  busy=true;el('factGuardar').disabled=true;let saved=0,error='';
  try{
   for(const row of pending){
    const item=getItems().find(x=>x.sku===row.sku);
    if(!item){error='Artículo no disponible';break;}
    try{
     const result=await post('recibir',{sku:item.sku,cantidad:numeroFactura(row.cantidad),
      unidad:row.unidad,expected_version:Number(item.version)});
     onSaved(result);row.saved=true;row.checked=false;saved++;
    }catch(e){error='No se confirmó '+item.name+': '+e.message;break;}
   }
   if(key&&!error)try{sessionStorage.setItem(key,'done');}catch{}
   render();el('factResultado').textContent=saved+' entrada(s) guardada(s). '+
    (error?error+' Comprueba el stock antes de repetir.':'Inventario actualizado.');
  }finally{busy=false;el('factGuardar').disabled=false;}
 };
 return {reset(){
  filas=[];meta={};el('factLineas').replaceChildren();
  el('factAcciones').hidden=true;el('factTextoBox').hidden=true;
  el('factTexto').value='';el('factResultado').textContent='';
  el('factFoto').value='';el('factArchivo').value='';
  estado('Toma una foto o sube una factura para preparar las entradas.');
 }};
}
