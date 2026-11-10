// Lector local de PDF para las facturas del panel financiero de pruebas.
// Reconstruye filas usando las coordenadas PDF; si faltan datos, intenta OCR de la página.
// No envía facturas a nuestros servidores durante el reconocimiento: PDF.js/Tesseract
// procesan el archivo en el navegador y solo cargan librerías/modelos públicos.
import {interpretarFacturaChile} from './mi-administracion-factura-parser.js?v=general-v5';

export function reconstruirLineasPDF(items){
  const chunks=(items||[]).filter(it=>it&&typeof it.str==='string'&&it.str.trim())
    .map(it=>({s:it.str.replace(/\s+/g,' ').trim(),x:Number(it.transform?.[4]??0),
      y:Number(it.transform?.[5]??0),w:Number(it.width??0)}));
  if(!chunks.length)return '';
  chunks.sort((a,b)=>b.y-a.y||a.x-b.x);
  const rows=[];
  for(const c of chunks){
    let row=rows.find(r=>Math.abs(r.y-c.y)<=3);
    if(!row){row={y:c.y,items:[]};rows.push(row)}
    row.items.push(c);
  }
  rows.sort((a,b)=>b.y-a.y);
  return rows.map(row=>{
    const seq=row.items.sort((a,b)=>a.x-b.x);
    let text='',prev=null;
    for(const item of seq){
      if(prev){
        const gap=item.x-(prev.x+prev.w);
        // Los separadores preservan el orden de columnas para la lectura de artículos.
        text+=gap>13?'  ':' ';
      }
      text+=item.s;prev=item;
    }
    return text.trim();
  }).filter(Boolean).join('\n');
}

async function ocrWorker(){
 const module=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
 return await module.createWorker('spa');
}

async function leerPaginasImagen(doc,informar,maxPages=2){
  let worker,recognized=[];
  try{
    informar('El PDF no tiene todos los datos visibles como texto. Intentando leer la imagen en tu dispositivo…');
    worker=await ocrWorker();
    for(let i=1;i<=Math.min(doc.numPages,maxPages);i++){
      informar('Leyendo imagen de la página '+i+'…');
      const page=await doc.getPage(i);
      const base=page.getViewport({scale:1});
      const scale=Math.min(1.9,1900/Math.max(base.width,base.height));
      const viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(viewport.width));
      canvas.height=Math.max(1,Math.round(viewport.height));
      try{
        const ctx=canvas.getContext('2d',{alpha:false});
        await page.render({canvasContext:ctx,viewport}).promise;
        const result=await worker.recognize(canvas);
        if(result?.data?.text)recognized.push(result.data.text);
      }finally{
        canvas.width=1;canvas.height=1;
      }
      const parsed=interpretarFacturaChile(recognized.join('\n'));
      if(parsed.total!==null&&parsed.referencia&&parsed.productos.length)break;
    }
    return recognized.join('\n');
  }finally{
    try{await worker?.terminate()}catch{}
  }
}

// La 2.ª página de muchas facturas chilenas es la copia «CEDIBLE» de la primera.
// Comparar folio, total y todos los ítems; no confundirla con páginas continuadas.
export function esPaginaDuplicada(anterior,actual){
 const a=interpretarFacturaChile(anterior),b=interpretarFacturaChile(actual);
 if(!a.referencia||a.referencia!==b.referencia||a.total===null||a.total!==b.total)return false;
 if(a.productos.length<2||a.productos.length!==b.productos.length)return false;
 const lines=p=>p.productos.map(x=>[
  String(x.nombre||'').toLowerCase().replace(/\s+/g,' ').trim(),
  String(x.cantidad),String(x.precio_unitario),String(x.total)
 ].join('|')).sort().join('\n');
 return lines(a)===lines(b);
}

export async function leerPDFLocal(file,informar=()=>{}){
 const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
 const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 try{
  let text=[],copiasIgnoradas=0,pages=Math.min(doc.numPages,4);
  for(let i=1;i<=pages;i++){
    informar('Leyendo texto del PDF, página '+i+' de '+pages+'…');
    const page=await doc.getPage(i),content=await page.getTextContent();
    const rowText=reconstruirLineasPDF(content.items);
    if(rowText){
      if(text.some(prior=>esPaginaDuplicada(prior,rowText))){
       copiasIgnoradas++;informar('Se detectó copia cedible; no se duplican los artículos.');
      }else text.push(rowText);
    }
  }
  const baseText=text.join('\n').slice(0,120000);
  const first=interpretarFacturaChile(baseText);
  let ocrText='';
  let aviso='';
  if(first.total===null||!first.referencia||first.productos.length===0){
    try{ocrText=await leerPaginasImagen(doc,informar,2)}
    catch(e){aviso='La segunda lectura del PDF no estuvo disponible. '+String(e.message||e).slice(0,130);}
  }
  return {texto:baseText,alternativo:ocrText.slice(0,100000),aviso,copiasIgnoradas,
    paginas:doc.numPages,analisis: {total: first.total!==null,folio:!!first.referencia,productos:first.productos.length}};
 }finally{try{await doc.destroy()}catch{}}
}
