// Control de compras (QA). Solo sugiere OCR; confirmar siempre antes de registrar.
// No modifica inventario ni el estado de disponibilidad de la carta.
export function crearControlCompras({api, $, esc, fmt, dateNow, businessName, branchName, currentBiz, currentBranch, upload, safe}){
 let productos=[],leyendo=false;
 const n=x=>Number(x||0),money=x=>Number.isSafeInteger(Number(x))&&Number(x)>=0&&Number(x)<=1000000000;
 const dia=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
 const normal=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const parseCLP=x=>{
  const v=String(x||'').replace(/[^0-9.,-]/g,'').replace(/^-+/,'');
  if(!v)return null;
  const d=v.replace(/[.,]/g,'');
  return /^\d+$/.test(d)?Number(d):null;
 };
 const findMoney=(raw)=>{
  const hits=String(raw||'').match(/\$?\s*\d[\d.,]{0,15}/g)||[];
  const values=hits.map(parseCLP).filter(v=>Number.isFinite(v)&&v>=0&&v<=1000000000);
  return values.length?values[values.length-1]:null;
 };
 const field=(id,val)=>{if(val!==null&&val!==undefined&&Number.isFinite(Number(val)))$(id).value=String(val)};
 const todayCL=()=>dateNow();
 const itemTemplate=()=>({nombre:'',cantidad:'1',unidad:'un',precio_unitario:'0',total:'0'});
 function renderItems(){
  const container=$('invoiceItems');
  container.replaceChildren();
  productos.forEach((p,i)=>{
   const row=document.createElement('div');row.className='invoice-product';
   row.innerHTML='<div class="row"><b>Producto '+(i+1)+'</b><button class="soft" type="button" data-remove="'+i+'">Quitar</button></div>'+
    '<label>Nombre del artículo</label><input data-item="'+i+'" data-k="nombre" placeholder="Ej.: Pollo, arroz, envases">'+
    '<div class="grid2"><div><label>Cantidad</label><input data-item="'+i+'" data-k="cantidad" type="text" inputmode="decimal" placeholder="1,5"></div>'+
    '<div><label>Unidad</label><select data-item="'+i+'" data-k="unidad"><option>un</option><option>kg</option><option>g</option><option>l</option><option>ml</option><option>caja</option><option>paq</option></select></div></div>'+
    '<div class="grid2"><div><label>Precio unitario ($)</label><input data-item="'+i+'" data-k="precio_unitario" type="number" min="0" inputmode="numeric"></div>'+
    '<div><label>Total del producto ($)</label><input data-item="'+i+'" data-k="total" type="number" min="0" inputmode="numeric"></div></div>';
   container.append(row);
   for(const k of ['nombre','cantidad','precio_unitario','total','unidad']){
    const el=row.querySelector('[data-k="'+k+'"]');
    el.value=p[k];
    if(k==='unidad'&&!Array.from(el.options).some(o=>o.value===p[k])){el.add(new Option(p[k],p[k]));el.value=p[k]}
   }
  });
  calcSum();
 }
 function calcSum(){
  let total=0;
  for(const x of productos)total+=Number(x.total)||0;
  $('invoiceItemsSum').textContent='Productos detallados: '+fmt(total)+' · '+productos.length+' producto(s)';
 }
 $('invoiceItems').addEventListener('input',e=>{
  const el=e.target.closest('[data-item]');if(!el)return;
  const idx=Number(el.dataset.item),k=el.dataset.k;
  if(!productos[idx])return;
  productos[idx][k]=el.value;
  if(['cantidad','precio_unitario'].includes(k)){
   const qty=Number(String(productos[idx].cantidad).replace(',','.')),v=Number(productos[idx].precio_unitario);
   if(qty>0&&qty<=100000&&money(v)){productos[idx].total=String(Math.round(qty*v));const output=el.closest('.invoice-product').querySelector('[data-k="total"]');if(output)output.value=productos[idx].total;}
  }
  calcSum();
 });
 $('invoiceItems').addEventListener('change',e=>{
  if(!e.target.matches('select[data-item]'))return;
  const p=productos[Number(e.target.dataset.item)];if(p)p.unidad=e.target.value;
 });
 $('invoiceItems').addEventListener('click',e=>{
  const b=e.target.closest('[data-remove]');if(!b)return;
  productos.splice(Number(b.dataset.remove),1);renderItems();
 });
 $('invoiceAddItem').onclick=()=>{productos.push(itemTemplate());renderItems();};
 function interpretar(texto){
  const lines=String(texto||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const found={fecha:null,proveedor:'',referencia:'',total:null,neto:null,iva:null,otros:null,descuento:null,productos:[]};
  if(!lines.length)return found;
  const meaningful=lines.slice(0,10).find(x=>/[a-záéíóúñ]{4,}/i.test(x)&&!/\b(?:factura|electronica|boleta|rut|fecha|giro|direccion|sii|servicio de impuestos|telefono|www\.|correo)\b/i.test(x));
  if(meaningful)found.proveedor=meaningful.slice(0,120);
  for(let i=0;i<lines.length;i++){
   const raw=lines[i],line=normal(raw);
   const labeled=line.match(/(?:razon social|proveedor|emisor)\s*[:\-]\s*(.{3,120})/);
   if(labeled)found.proveedor=raw.slice(raw.indexOf(':')+1).trim().slice(0,120)||found.proveedor;
   const date=raw.match(/\b([0-3]?\d)[\/\-.]([01]?\d)[\/\-.](20\d{2})\b/);
   if(date){const f=date[3]+'-'+date[2].padStart(2,'0')+'-'+date[1].padStart(2,'0');if(!Number.isNaN(Date.parse(f)))found.fecha=f;}
   const invoice=line.match(/\b(?:factura|boleta)\s*(?:electr[oó]nica)?\s*(?:nro\.?|numero|n[°ºo.]|#|folio)?\s*[:\-#n°ºo.]*\s*(\d{2,12})\b/);
   if(invoice)found.referencia=invoice[1];
   const total=findMoney(raw);
   if(total!==null){
    if(/\b(?:total a pagar|monto total|total factura|total compra|importe total|valor total)\b/.test(line)||/^total\s*[:$]/.test(line))found.total=total;
    else if(/\b(?:monto neto|valor neto|total neto|afecto neto|subtotal)\b/.test(line))found.neto=total;
    else if(/(?:^|\s)(?:iva|i\.v\.a\.)(?:\s*19\s*%)?\b/.test(line))found.iva=total;
    else if(/\b(?:descuentos?)\b/.test(line))found.descuento=total;
    else if(/\b(?:otros cargos|recargo|flete)\b/.test(line))found.otros=total;
   }
   // Patrón conservador: cantidad, descripción, precio unidad y total. Nunca completa artículos dudosos.
   const item=raw.match(/^\s*(\d{1,5}(?:[.,]\d{1,3})?)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúñ][\w\sÁÉÍÓÚÜÑáéíóúñ.,/%()\-]{3,90}?)\s+\$?\s*([\d.]{1,14})\s+\$?\s*([\d.]{1,14})\s*$/);
   if(item){
    const qty=Number(item[1].replace(',','.')),unit=parseCLP(item[3]),sum=parseCLP(item[4]),name=item[2].trim();
    if(qty>0&&unit!==null&&sum!==null&&Math.abs(Math.round(qty*unit)-sum)<=2&&!/subtotal|total|iva|neto/i.test(name)){
     found.productos.push({nombre:name,cantidad:String(qty),unidad:'un',precio_unitario:String(unit),total:String(sum)});
    }
   }
  }
  if(found.total===null&&found.neto!==null&&found.iva!==null)found.total=found.neto+found.iva+(found.otros||0)-(found.descuento||0);
  if(found.total!==null&&found.neto===null)found.neto=found.total-(found.iva||0)-(found.otros||0)+(found.descuento||0);
  return found;
 }
 function aplicarTexto(raw){
  const p=interpretar(raw);let count=0;
  if(p.proveedor){$('docVendor').value=p.proveedor;count++}
  if(p.fecha){$('docDate').value=p.fecha;count++}
  if(p.referencia){$('docNumber').value=p.referencia;count++}
  for(const [id,key] of [['docTotal','total'],['docNet','neto'],['docTax','iva'],['docOther','otros'],['docDiscount','descuento']]){
   if(p[key]!==null){field(id,p[key]);count++}
  }
  if(p.productos.length){productos=p.productos.slice(0,60);renderItems();count+=p.productos.length}
  $('invoiceOCRStatus').textContent=count?count+' datos sugeridos a partir de la lectura. Revisa proveedor, IVA, artículos y total antes de confirmar.':'No fue posible reconocer cifras confiables. Completa los datos manualmente.';
  $('docRawText').value=raw;
  return p;
 }
 $('parseInvoiceText').onclick=()=>aplicarTexto($('docRawText').value);
 async function extractPDF(file){
  const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const output=[];
  for(let i=1;i<=Math.min(doc.numPages,3);i++){
   const page=await doc.getPage(i),content=await page.getTextContent();
   const chunks=content.items.filter(x=>typeof x.str==='string').map(x=>({str:x.str,y:x.transform?.[5]??0}));
   let y=null,line='';
   for(const chunk of chunks){
    if(y!==null&&Math.abs(chunk.y-y)>3){output.push(line);line=''}
    line+=(line?' ':'')+chunk.str;y=chunk.y;
   }
   if(line)output.push(line);
  }
  return output.join('\n');
 }
 async function extractImage(file){
  if(typeof window.TextDetector==='function'){
   try{const image=await createImageBitmap(file),result=await new window.TextDetector().detect(image);image.close?.();const str=result.map(x=>x.rawValue).join('\n');if(str.trim())return str}catch{}
  }
  // OCR gratuito en el dispositivo. No enviamos la foto a un servicio externo.
  const module=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
  const worker=await module.createWorker('spa');
  try{const result=await worker.recognize(file);return result.data.text||''}
  finally{await worker.terminate()}
 }
 async function leer(){
  if(leyendo)return;
  const file=$('docFile').files?.[0];
  if(!file){$('invoiceOCRStatus').textContent='Selecciona primero una foto o un PDF de factura.';return}
  leyendo=true;$('readInvoice').disabled=true;
  $('invoiceOCRStatus').textContent='Leyendo factura en este dispositivo…';
  try{
   let txt='';
   if(file.type==='application/pdf')txt=await extractPDF(file);
   else if(file.type.startsWith('image/'))txt=await extractImage(file);
   else throw Error('Solo JPG, PNG, WEBP o PDF.');
   if(!txt.trim())throw Error('No se encontró texto. Si el PDF es escaneado, utiliza una foto o copia el texto con Texto en Vivo.');
   aplicarTexto(txt);
  }catch(e){$('invoiceOCRStatus').textContent='Lectura no disponible: '+String(e.message||e).slice(0,190)+' Puedes ingresar los datos manualmente.'}
  finally{leyendo=false;$('readInvoice').disabled=false;}
 }
 $('readInvoice').onclick=()=>void leer();
 $('docFile').addEventListener('change',()=>{if($('docFile').files?.length)void leer()});
 $('docTotal').addEventListener('input',()=>{
  if(!$('docTax').value&&!$('docOther').value&&!$('docDiscount').value){
   $('docNet').value=$('docTotal').value;
  }
 });
 function collectItems(){
  return productos.map(p=>{
   const qty=Number(String(p.cantidad).replace(',','.'));
   const price=Number(p.precio_unitario),sum=Number(p.total);
   if(String(p.nombre||'').trim().length<2||!(qty>0&&qty<=100000)||
    !/^\d{1,6}(\.\d{1,3})?$/.test(String(qty))||!money(price)||!money(sum)||
    Math.abs(Math.round(qty*price)-sum)>2)throw Error('Revisa la cantidad o precio del producto: '+(p.nombre||'sin nombre'));
   return {nombre:p.nombre.trim(),cantidad:String(qty),unidad:p.unidad||'un',precio_unitario:price,total:sum};
  });
 }
 async function guardar(){
  if(leyendo)throw Error('La lectura aún está en proceso; revisa los resultados después.');
  const negocio=$('docBiz').value,sucursal=$('docBranch').value||null,fecha=$('docDate').value;
  const proveedor=$('docVendor').value.trim(),referencia=$('docNumber').value.trim(),total=n($('docTotal').value);
  const neto=n($('docNet').value),iva=n($('docTax').value),otros=n($('docOther').value),descuento=n($('docDiscount').value);
  if(!negocio)throw Error('Selecciona el negocio de esta compra.');
  if(proveedor.length<2)throw Error('Escribe a quién le compraste (proveedor).');
  if(!dia(fecha)||!money(total)||total<=0)throw Error('Escribe fecha y total de la compra.');
  if(![neto,iva,otros,descuento].every(money)||neto+iva+otros-descuento!==total)
   throw Error('Neto + IVA + otros cargos − descuentos debe coincidir con el total. Revisa la factura.');
  const articulos=collectItems();
  if(!referencia&&$('docFile').files?.length===0)
   throw Error('Escribe el número de factura o adjunta su fotografía para evitar duplicados.');
  const detail='Negocio: '+businessName(negocio)+'\nProveedor: '+proveedor+'\nTotal compra: '+fmt(total)+'\nProductos detallados: '+articulos.length+
   '\nEstado: '+($('docPayment').value==='pendiente'?'Pendiente de pago':'Pagada')+
   '\n\n¿Confirmas que todos los datos son correctos y deseas sumar esta compra al historial?';
  if(!confirm(detail))return false;
  const saved=await api('guardar_compra_factura',{negocio_id:negocio,sucursal_id:sucursal,fecha,
   proveedor,referencia,total,neto,iva,otros,descuento,pendiente:$('docPayment').value==='pendiente',
   articulos,confirmado:true});
  let warning='';
  try{if($('docFile').files?.length)await upload($('docFile').files[0],negocio,sucursal,
   $('docType').value,fecha,saved.id,proveedor)}
  catch(e){warning='La compra SÍ quedó registrada pero el archivo no se pudo adjuntar: '+e.message}
  $('docNumber').value='';$('docTotal').value='';$('docNet').value='';$('docTax').value='';
  $('docOther').value='';$('docDiscount').value='';$('docRawText').value='';
  if(!warning)$('docFile').value='';
  productos=[];renderItems();
  await cargar();
  return warning;
 }
 const show=(id)=>$(id);
 async function cargar(){
  // El filtro de historial sigue el negocio elegido en esta misma pantalla.
  const negocio=$('docBiz').value||currentBiz()||null;
  const sucursal=$('docBranch').value||null;
  const params={negocio_id:negocio,sucursal_id:sucursal,desde:$('from').value,hasta:$('to').value};
  try{
   const [purchase,stored]=await Promise.all([api('resumen_compras',params),
    api('documentos',{negocio_id:negocio})]);
   const summary=purchase.resumen||{};
   show('purchasesTotal').textContent=fmt(summary.compras);
   show('purchasesDue').textContent=fmt(summary.pendiente);
   show('purchasesCount').textContent=String(summary.facturas||0);
   show('purchasesSuppliers').textContent=String((purchase.proveedores||[]).length);
   show('invoiceVendors').innerHTML=(purchase.proveedores||[]).map(p=>
    '<div class="line"><div class="row"><b>'+esc(p.proveedor||'Sin proveedor')+'</b><b>'+fmt(p.total)+'</b></div><small>'+esc(p.facturas)+' compra(s) · Pendiente: '+fmt(p.pendiente)+'</small></div>').join('')||'<p class="muted">Todavía no hay compras registradas para este período.</p>';
   show('invoiceProducts').innerHTML=(purchase.productos||[]).map(p=>
    '<div class="line"><div class="row"><b>'+esc(p.producto)+'</b><b>'+fmt(p.importe)+'</b></div><small>'+esc(p.cantidad)+' '+esc(p.unidad)+' · '+esc(p.veces)+' vez/veces</small></div>').join('')||'<p class="muted">Aún no hay productos desglosados.</p>';
   show('invoicePurchaseList').innerHTML=(purchase.facturas||[]).map(p=>
    '<div class="line"><div class="row"><div><b>'+esc(p.proveedor)+'</b><p class="hint">'+esc(String(p.fecha).slice(0,10))+' · '+esc(p.referencia||'Sin folio')+' · '+esc(businessName(p.negocio_id))+' · '+esc(branchName(p.sucursal_id))+'</p></div><b>'+fmt(p.monto)+'</b></div><div class="row"><span class="pill">'+esc(p.estado)+'</span><button type="button" data-purchase="'+esc(p.id)+'">Ver productos</button></div><div class="purchase-details" hidden></div></div>').join('')||'<p class="muted">No hay facturas confirmadas todavía.</p>';
   show('invoicePurchaseList').querySelectorAll('[data-purchase]').forEach(button=>button.onclick=async()=>{
    const target=button.closest('.line').querySelector('.purchase-details');
    if(!target.hidden){target.hidden=true;return}
    try{
     const details=await api('detalle_compra',{id:button.dataset.purchase});
     const c=details.compra;
     target.innerHTML='<div class="steps"><b>Compra: '+fmt(c.monto)+'</b><p>Neto: '+fmt(c.datos?.neto||0)+' · IVA: '+fmt(c.datos?.iva||0)+'</p>'+
      (details.articulos||[]).map(p=>'<div class="row"><span>'+esc(p.descripcion)+' ('+esc(p.cantidad)+' '+esc(p.unidad)+')</span><b>'+fmt(p.total_linea)+'</b></div>').join('')+
      (!(details.articulos||[]).length?'<p>Esta compra no tiene desglose de productos.</p>':'')+'</div>';
     target.hidden=false;
    }catch(e){target.textContent=e.message;target.hidden=false}
   });
   show('docList').innerHTML=(stored.documentos||[]).map(x=>
    '<div class="line"><div class="row"><b>'+esc(x.nombre)+'</b><button type="button" data-doc="'+esc(x.id)+'">Descargar</button></div><small>'+esc(businessName(x.negocio_id))+' · '+esc(x.tipo)+' · '+esc(x.fecha_documento||'')+'</small></div>').join('')||'<p class="muted">No hay fotografías adjuntas.</p>';
   show('docList').querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>void abrirArchivo(b.dataset.doc));
  }catch(e){show('invoiceVendors').textContent='No se pudo cargar el historial: '+e.message;throw e}
 }
 async function abrirArchivo(id){
  try{
   const r=await api('abrir_documento',{id});
   const data=Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0));
   const url=URL.createObjectURL(new Blob([data],{type:r.mime}));
   const link=document.createElement('a');link.href=url;link.download=r.nombre||'factura';document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){alert('No se pudo descargar el archivo: '+e.message)}
 }
 $('docBiz').addEventListener('change',()=>void cargar());
 $('docBranch').addEventListener('change',()=>void cargar());
 renderItems();
 return {guardar,cargar,aplicarTexto,interpretar};
}
