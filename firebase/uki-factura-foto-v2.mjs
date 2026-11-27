// Lectura de imágenes local. No se envían fotos ni se registra mercadería aquí.
import {leerTextoFactura, leerCabeceraFacturaPDF} from './uki-factura-lectura-live.mjs?v=20261127-factura-agil-v1';

export function prepararImagenFactura(img, {x=0,y=0,w=1,h=1,pendiente=0,detalle=false}={},crear=(a,b)=>{
 const cv=document.createElement('canvas');cv.width=a;cv.height=b;return cv;
}){
 const ancho=img.naturalWidth||img.width,alto=img.naturalHeight||img.height;
 const sw=Math.round(ancho*w),sh=Math.round(alto*h);
 const scale=Math.min(detalle?3:2, (detalle?2526:1640)/sw, (detalle?1700:2200)/sh);
 const cw=Math.max(1,Math.round(sw*scale)),ch=Math.max(1,Math.round(sh*scale));
 const c=crear(cw,ch),ct=c.getContext('2d',{willReadFrequently:true});
 ct.fillStyle='#fff';ct.fillRect(0,0,cw,ch);
 ct.imageSmoothingEnabled=true;ct.imageSmoothingQuality='high';
 ct.setTransform(scale,-pendiente*scale,0,scale,0,pendiente*scale*sw/2);
 ct.drawImage(img,-Math.round(x*ancho),-Math.round(y*alto));
 ct.setTransform(1,0,0,1,0,0);
 const pixels=ct.getImageData(0,0,cw,ch),data=pixels.data,len=cw*ch;
 const gray=new Uint8Array(len),integral=detalle?new Uint32Array((cw+1)*(ch+1)):null;
 const hist=new Uint32Array(256),stride=cw+1;
 for(let j=0;j<ch;j++){
  let sum=0;
  for(let i=0;i<cw;i++){
   const k=j*cw+i,q=4*k,g=(77*data[q]+150*data[q+1]+29*data[q+2])>>8;
   gray[k]=g;hist[g]++;if(integral){sum+=g;const row=(j+1)*stride+i+1;integral[row]=sum+integral[row-stride];}
  }
 }
 let lo=0,hi=255,s=0;
 while(lo<240&&(s+=hist[lo])<len*.012)lo++;
 s=0;while(hi>lo+20&&(s+=hist[hi])<len*.012)hi--;
 const radius=Math.max(6,Math.round(scale*4));
 for(let j=0;j<ch;j++)for(let i=0;i<cw;i++){
  const k=j*cw+i,q=4*k;
  let out;
  if(integral){
   const a=Math.max(0,i-radius),b=Math.min(cw,i+radius+1),d=Math.max(0,j-radius),e=Math.min(ch,j+radius+1);
   const mean=(integral[e*stride+b]-integral[e*stride+a]-integral[d*stride+b]+integral[d*stride+a])/((b-a)*(e-d));
   out=255-4.3*(mean-gray[k]);
  }else out=(gray[k]-lo)*255/Math.max(26,hi-lo);
  data[q]=data[q+1]=data[q+2]=out;
 }
 ct.putImageData(pixels,0,0);
 return c;
}

function localizarTabla(scan,alto){
 const words=scan.words||[];
 const target=words.find(word=>/^(?:[cg]antidad|[cq]ant\.?|cantida[do]|qty)$/i.test(String(word.text).replace(/^[^\p{L}]+|[^\p{L}]+$/gu,'')));
 if(!target)return null;
 const label=words.find(word=>Math.abs((word.bbox?.y0||0)-(target.bbox?.y0||0))<alto*.021&&
  /^unid|^unidad|^unitar|^total/i.test(word.text||''));
 return label&&Number.isFinite(target.bbox?.y0)?target.bbox.y0/alto:null;
}
function score(scan,items){
 const filas=leerTextoFactura(scan?.text||'',items);
 const fiables=filas.filter(f=>f.origen==='pdf');
 const coherentes=fiables.filter(f=>{
  const entero=s=>Number(String(s).replace(/[.,]/g,''));
  const e=Math.abs(entero(f.precioUnitario)*Number(String(f.cantidadFactura).replace(',','.'))-entero(f.precioTotal));
  return Number.isFinite(e)&&e<=Math.max(2,Number(f.cantidadFactura)||1);
 });
 return {filas,fiables:fiables.length,total:fiables.length*90+coherentes.length*12+
  (fiables.length?0:filas.filter(f=>f.cantidad).length*2)+Math.max(0,Math.min(100,Number(scan?.confidence)||0))/10};
}
export async function reconocerFotoFactura(img,worker,{items=[],crear,progreso=()=>{}}={}){
 async function pass(config,mode){
  const canvas=prepararImagenFactura(img,config,crear);
  try{
   await worker.setParameters({tessedit_pageseg_mode:String(mode),user_defined_dpi:'260',preserve_interword_spaces:'1'});
   const data=(await worker.recognize(canvas)).data||{};
   return {data,alto:canvas.height,config,...score(data,items)};
  }finally{canvas.width=1;canvas.height=1;}
 }
 const vertical=(img.naturalHeight||img.height)>=(img.naturalWidth||img.width)*1.16;
 progreso('Buscando los datos de la factura…');
 const base=await pass({y:0,h:vertical?.57:1},11);
 const head=await pass({y:vertical?.055:0,h:vertical?.185:.38},11);
 const cab=leerCabeceraFacturaPDF(head.data.text);
 const cabBase=leerCabeceraFacturaPDF(base.data.text);
 const meta={...cabBase};
 for(const [k,v] of Object.entries(cab))if(v)meta[k]=v;
 const header=localizarTabla(base.data,base.alto);
 const inicio=header===null?(vertical?.25:.21):Math.max(0,header*base.config.h-.009);
 const cantidadProbable=(base.data.text||'').match(/(?:^|\n)\s*\d{1,5}\s*(?:un|und|kg|g|l|ml)\b/gim)?.length||0;
 let best=base;
 const seen=[];
 progreso('Ampliando la tabla de productos…');
 const ventana=Math.min(1-inicio,vertical?.092:.18);
 const area={x:.022,y:inicio,w:.936,h:ventana,detalle:true};
 for(const slope of [0,-.018,.018]){
  const found=await pass({...area,pendiente:slope},6);
  seen.push(found);
  if(found.total>best.total)best=found;
  if(found.fiables>=6&&found.fiables>=cantidadProbable&&found.total-found.fiables*90>=found.fiables*12)break;
 }
 // Detalles largos o diseños distintos: se compara otra ventana completa en vez
 // de unir listas que podrían duplicar una línea o emparejarla con otra cantidad.
 if(best.fiables<Math.max(3,cantidadProbable)||best.fiables>=7){
  const grande=await pass({x:.012,y:Math.max(0,inicio-.008),w:.978,h:Math.min(1-inicio,vertical?.34:.60),detalle:true},6);
  if(grande.total>best.total)best=grande;
 }
 if(best.fiables<2){
  const full=await pass({},3);
  if(full.total>best.total)best=full;
  const extra=leerCabeceraFacturaPDF(full.data.text);
  for(const [k,v] of Object.entries(extra))if(!meta[k]&&v)meta[k]=v;
 }
 const texto=[meta.proveedor,meta.rut&&'RUT: '+meta.rut,meta.folio&&'Folio: '+meta.folio,best.data.text].filter(Boolean).join('\n');
 return {texto,filas:best.filas,meta,lecturaParcial:best.fiables<2||cantidadProbable>best.fiables||
  seen.some(x=>x.filas.length>best.filas.length+1),
  lineasTabulares:best.fiables};
}
