// Lectura de imágenes local. No se envían fotos ni se registra mercadería aquí.
import {leerTextoFactura, leerCabeceraFacturaPDF, construirFilaLeida, descripcionCreible, vinculoAutomaticoFactura} from './uki-factura-lectura-live.mjs?v=20261127-factura-precisa-v1';

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
const conocido=s=>/\b(?:queso (?:crema|gauda)|pocillos?|arroz|palillos|film aluminio|palmitos|vinagre|panko|nori|camar[oó]n)\b/i.test(s);
// Las palabras de la columna Cantidad/Unid. dan un ancla vertical de la tabla.
// Leemos las descripciones y las cantidades por separado, conservando el orden.
function mediana(a){const v=[...a].sort((x,y)=>x-y);return v.length?v[Math.floor(v.length/2)]:0;}
const unidadOCR=s=>({un:'Un',ur:'Un',ud:'Un',une:'Un',uw:'Un',kg:'Kg',g:'G',gr:'Gr',l:'L',lt:'Lt',ml:'Ml'})[
 String(s).toLowerCase().replace(/[^a-z]/g,'')];
function anclasTabla(scan,W,H){
 const words=(scan.words||[]).filter(w=>w.bbox&&w.bbox.y1>w.bbox.y0);
 const pares=[];
 for(const u of words){
  const b=u.bbox,unidad=unidadOCR(u.text),y=(b.y0+b.y1)/2;
  if(!unidad||b.x0<W*.37||b.x0>W*.87||y<H*.12||y>H*.8)continue;
  const q=words.filter(w=>/^\d{1,4}(?:[.,]\d{1,3})?$/.test(w.text)&&
   b.x0-w.bbox.x1>=-1&&b.x0-w.bbox.x1<W*.038&&
   Math.abs((w.bbox.y0+w.bbox.y1)/2-y)<Math.max(3,(b.y1-b.y0)*.64))
   .sort((a,z)=>z.bbox.x1-a.bbox.x1)[0];
  if(q)pares.push({x:b.x0,y,q:q.text,u:unidad});
 }
 let columna=[];
 for(const p of pares){
  const grupo=pares.filter(a=>Math.abs(a.x-p.x)<W*.022).sort((a,b)=>a.y-b.y);
  if(grupo.length>columna.length)columna=grupo;
 }
 if(columna.length<5)return null;
 const steps=columna.slice(1).map((x,i)=>x.y-columna[i].y).filter(d=>d>W*.004&&d<W*.045);
 const dy=mediana(steps.filter(d=>d<=mediana(steps)*1.5));
 if(!dy)return null;
 let serie=[];
 for(let i=0;i<columna.length;i++){
  const grupo=[columna[i]];
  for(let j=i+1;j<columna.length;j++){
   const gap=(columna[j].y-grupo.at(-1).y)/dy;
   if(gap<.65)continue;
   if(gap>2.35||Math.abs(gap-Math.round(gap))>.36)break;
   grupo.push(columna[j]);
  }
  if(grupo.length>serie.length)serie=grupo;
 }
 if(serie.length<5)return null;
 const primero=serie[0].y,final=serie.at(-1).y,n=Math.round((final-primero)/dy)+1;
 if(n<5||n>34||n>serie.length+4)return null;
 const step=(final-primero)/(n-1),x=mediana(serie.map(w=>w.x));
 const filas=Array.from({length:n+2},(_,i)=>{
  const y=primero+(i-1)*step;
  return {y,q:serie.find(a=>Math.abs(a.y-y)<step*.29)};
 });
 const nombrables=words.filter(w=>{
  const b=w.bbox;
  return b.x0<x-W*.14&&b.x1<W*.71&&(/[a-záéíóúñ]{3,}/i.test(w.text))&&(b.y1-b.y0)>step*.26&&
   (b.y0+b.y1)/2>primero-W*.2&&(b.y0+b.y1)/2<final+W*.07;
 });
 const pendientes=[];
 for(const offset of [-.024,-.016,-.009,0,.009,.016,.024]){
  for(let t=-.12;t<=.135;t+=.003){
   let puntaje=0;
   for(const w of nombrables){
    const b=w.bbox,dx=(b.x0+b.x1)/2-x,yy=(b.y0+b.y1)/2;
    const near=filas.reduce((a,f)=>Math.abs(f.y-yy)<Math.abs(a.y-yy)?f:a,filas[0]);
    const slope=t+offset*((near.y-primero)/Math.max(1,final-primero));
    const v=(yy-dx*slope-primero)/step, gap=Math.abs(v-Math.round(v));
    if(v>=-1.22&&v<=n+.22)puntaje+=Math.max(0,1-gap/.28)*Math.min(4,(b.x1-b.x0)/step);
   }
   pendientes.push({m:t,k:offset,puntaje});
  }
 }
 pendientes.sort((a,b)=>b.puntaje-a.puntaje);
 const ajuste=pendientes[0],alternativa=pendientes.find(a=>Math.abs(a.m-ajuste.m)>.006)||ajuste;
 return {filas,x,step,primero,final,ajustes:[ajuste,alternativa]};
}

function crearLienzo(a,b){
 const c=document.createElement('canvas');c.width=a;c.height=b;return c;
}

async function alternativaPorColumnas(img, worker, base, items, crear){
 const rawW=img.naturalWidth||img.width,rawH=img.naturalHeight||img.height;
 const W=base.ancho,H=base.alto, a=anclasTabla(base.data,W,H);
 if(!a)return null;
 const esc=rawW/W;
 if(Math.abs(rawH*base.config.h-H*esc)>5)return null;
 const {x,step,primero,final,filas,ajustes}=a;
 const build=async (l,r,ajuste,numero=false)=>{
  const scale=Math.min(numero?6:4.8,2080/((r-l)*esc));
  const width=Math.max(32,Math.round((r-l)*esc*scale)+24),alto=64,franja=alto+22;
  const cv=crear(width,filas.length*franja);
  const c=cv.getContext('2d',{willReadFrequently:true});
  c.fillStyle='#fff';c.fillRect(0,0,cv.width,cv.height);
  for(let i=0;i<filas.length;i++){
   const f=filas[i],pend=ajuste.m+ajuste.k*(f.y-primero)/Math.max(1,final-primero);
   const sh=alto/(step*esc*.92),centro=franja*i+franja/2;
   c.save();c.beginPath();c.rect(12,centro-alto/2,width-24,alto);c.clip();
   c.setTransform(scale,-pend*sh,0,sh,12-l*esc*scale,centro-(f.y-step*(numero?.12:.23))*esc*sh+pend*x*esc*sh);
   c.drawImage(img,0,0);c.restore();
   const p=c.getImageData(0,i*franja,width,franja),d=p.data;
   const hist=new Uint32Array(256),gray=new Uint8Array(width*franja);
   for(let k=0;k<gray.length;k++){
    const j=k*4,g=(77*d[j]+150*d[j+1]+29*d[j+2])>>8;
    gray[k]=g;
    if(k%width>=12&&k%width<width-12&&Math.floor(k/width)>=11&&Math.floor(k/width)<75)hist[g]++;
   }
   const area=(width-24)*alto;
   let low=0,high=255,sum=0;while(low<240&&(sum+=hist[low])<area*.026)low++;
   sum=0;while(high>low+25&&(sum+=hist[high])<area*(numero?.66:.55))high--;
   for(let k=0;k<gray.length;k++)d[k*4]=d[k*4+1]=d[k*4+2]=(gray[k]-low)*255/Math.max(22,high-low);
   c.putImageData(p,0,i*franja);
  }
  try{
   await worker.setParameters({tessedit_pageseg_mode:'6',user_defined_dpi:'260',preserve_interword_spaces:'1',
    tessedit_char_whitelist:numero?'0123456789.,':''});
   const {data}=await worker.recognize(cv);
   return filas.map((_,i)=>(data.words||[]).filter(w=>Math.floor((w.bbox.y0+w.bbox.y1)/2/franja)===i)
    .sort((u,v)=>u.bbox.x0-v.bbox.x0));
  }finally{cv.width=1;cv.height=1;}
 };
 const xInicio=W*.065;
 const nombres=await build(xInicio,x-W*.08,ajustes[0]);
 const otros=await build(xInicio,x-W*.08,ajustes[1]);
 const leerRegion=async (l,r,y,rel,umbral,numeros=true)=>{
  const ampliacion=6,altura=step*esc*rel,ancho=(r-l)*esc;
  const innerW=Math.round(ancho*ampliacion),innerH=Math.round(altura*ampliacion);
  const cv=crear(innerW+36,innerH+36),c=cv.getContext('2d',{willReadFrequently:true});
  c.fillStyle='#fff';c.fillRect(0,0,cv.width,cv.height);
  c.drawImage(img,l*esc,y*esc-altura/2,ancho,altura,18,18,innerW,innerH);
  try{
   const pixels=c.getImageData(18,18,innerW,innerH),d=pixels.data,gray=new Uint8Array(d.length/4),hist=new Uint32Array(256);
   for(let i=0;i<gray.length;i++){const z=i*4;gray[i]=(77*d[z]+150*d[z+1]+29*d[z+2])>>8;hist[gray[i]]++;}
   let low=0,high=255,ac=0;
   while(low<240&&(ac+=hist[low])<gray.length*.055)low++;
   ac=0;while(high>low+20&&(ac+=hist[high])<gray.length*.20)high--;
   const t=low+(high-low)*umbral;
   for(let i=0;i<gray.length;i++)d[i*4]=d[i*4+1]=d[i*4+2]=gray[i]<t?0:255;
   c.putImageData(pixels,18,18);
   await worker.setParameters({tessedit_pageseg_mode:'7',user_defined_dpi:'260',tessedit_char_whitelist:numeros?'0123456789.,':'0123456789.,UnKGkgrrLtMmll'});
   const {data}=await worker.recognize(cv);
   return String(data.text||'').trim().replace(/\s+/g,'');
  }finally{cv.width=1;cv.height=1;}
 };
 const leerCantidadAislada=async f=>{
  const unidadVecina=filas.find(x=>x.q)?.q.u;
  if(!unidadVecina)return null;
  const progreso=(f.y-primero)/Math.max(1,final-primero),xLocal=x+W*.010*(progreso-.5);
  const raw=[];
  for(const [desfase,umbral] of [[0,.54],[-.08,.66],[.05,.74]]){
   const linea=await leerRegion(xLocal-W*.047,xLocal+W*.040,f.y+step*desfase,.82,umbral,false);
   raw.push(linea);
  }
  const parse=raw.flatMap(s=>{
   const m=s.match(/^(\d{1,4}(?:[.,]\d{1,3})?)(un|ur|ud|kg|gr?|lt?|ml)[.,]*$/i);
   return m?[{q:m[1].replace(',','.'),u:unidadOCR(m[2])}]:[];
  });
  const directa=parse.find(p=>parse.filter(x=>x.q===p.q&&x.u===p.u).length>=2);
  if(directa&&Number(directa.q)<=80)return directa;
  // Acepta un dígito claro si los otros encuadres corroboran la unidad y
  // no muestran otra cantidad. Fracciones requieren el contraste de precios.
  const unica=parse.length===1?parse[0]:null;
  if(unica&&/^\d$/.test(unica.q)&&unica.u===unidadVecina&&
     raw.filter(s=>unidadOCR(s)===unica.u).length>=2&&
     !raw.some(s=>/^\d/.test(s)&&!s.startsWith(unica.q)))return unica;
  // Solo se contrasta una cantidad si los dígitos se vieron en su propia columna.
  const candidatos=raw.map(s=>s.match(/^(\d{1,4}(?:[.,]\d{1,3})?)/)?.[1]?.replace(/[.,]/g,'')).filter(Boolean);
  if(!candidatos.length)return null;
  const slope=ajustes[0].m+ajustes[0].k*progreso;
  const precios=[];
  for(const d of [.108,.174]){
   const cx=xLocal+W*d,y=f.y+slope*(cx-x)-step*.11,rows=[];
   for(const t of [.63,.76]){
    const rawPrice=await leerRegion(cx-W*.034,cx+W*.032,y,.88,t);
    const digits=rawPrice.replace(/[.,]/g,'');
    if(/^\d{3,7}$/.test(digits))rows.push(Number(digits));
   }
   precios.push(rows);
  }
  const compatibles=new Set();
  for(const unitario of precios[0])for(const total of precios[1]){
   const q=Math.round(total/unitario*100)/100, digits=String(q).replace('.','');
   if(q>0&&q<=200&&Math.abs(q*unitario-total)<=1.5&&candidatos.includes(digits))compatibles.add(String(q));
  }
  return compatibles.size===1?{q:[...compatibles][0],u:unidadVecina}:null;
 };
 const sugerirNombre=s=>s.replace(/^.{0,10}?\[+\s*/,'')
  .replace(/^[^\p{L}\d]+/u,'').replace(/^OUESO(?= GAUDA\b| CREMA\b)/i,'QUESO')
  .replace(/\bNOR[!1l]\s*['’]?\s*(?=GOLD)/gi,'NORI ')
  .replace(/\b[FP]ALILLOS(?=\s+(?:DE\s+)?SUSHI)/gi,'PALILLOS')
  .replace(/\b(?:G\s*\/|C\s*\/)\s*TAPA\b/gi,'C/TAPA')
  .replace(/^(PALMITOS.+?\d+)\s*GA\s+(?=\((?:UND|UNO)\))/, '$1 GR ')
  .replace(/(\d)\s*0Z\b/g,'$1 OZ').replace(/(\d+\s*und)!$/i,'$1s)')
  .replace(/\s+/g,' ').trim();
 const llave=name=>{
  const preferido=name.match(/^(?:queso (?:gauda|crema)|panko (?:blanco|amarillo)|palillos|pocillo|film aluminio|arroz|palmitos|vinagre|nori|camaron)\b/i)?.[0];
  return (preferido||name.split(/\s+/).slice(0,3).join(' ')).toUpperCase();
 };
 const candidatos=[],publicados=new Set();
 for(let i=0;i<filas.length;i++){
  const reads=[nombres[i],otros[i]].map((list,version)=>{
   const name=sugerirNombre(list.map(w=>w.text).join(' '));
   const quality=mediana(list.filter(w=>/[a-záéíóúñ]{3,}/i.test(w.text)).map(w=>w.confidence||0));
   const match=vinculoAutomaticoFactura(name,items)||conocido(name);
   return {name,p:quality+(match?30:0)+(version===0?13:0)};
  }).filter(a=>descripcionCreible(a.name)&&a.p>=43).sort((u,v)=>v.p-u.p);
  const name=reads.find(r=>!publicados.has(llave(r.name)))?.name;
  const extremo=i===0||i===filas.length-1;
  if(extremo&&(!name||!conocido(name)))continue;
  const ancla=filas[i].q||await leerCantidadAislada(filas[i]);
  if(extremo&&!ancla&&i===filas.length-1)continue;
  if(name)publicados.add(llave(name));
  candidatos.push({name,q:ancla?.q||'',u:ancla?.u||''});
 }
 const recuperadas=candidatos.map((f,i)=>{
  if(!f.name)return null;
  // Un queso gauda facturado en una fracción de «Un» se registra en kg,
  // nunca con unidades fraccionarias. Evita tomar ruido del OCR como marca.
  const quesoGauda=/^QUESO GAUDA\b/i.test(f.name);
  const gauda=quesoGauda&&/^\d+[.,]\d{1,3}$/.test(f.q)&&f.u==='Un';
  const nombre=quesoGauda?'QUESO GAUDA':f.name;
  const n=construirFilaLeida(nombre,f.q,gauda?'Kg':f.u,items);
  return n?{...n,lineaFactura:i+1}:{nombre,lineaFactura:i+1,cantidad:'',unidad:'',
   origen:'foto-columnas',nota:'Cantidad no confirmada por la foto. Completa solo este dato con la factura a la vista.'};
 });
 return {filas:recuperadas.filter(Boolean),totalLineas:candidatos.length,
  lecturaParcial:recuperadas.some(f=>!f),faltanCantidades:recuperadas.filter(f=>f&&!f.cantidad).length};

}

export async function reconocerFotoFactura(img,worker,{items=[],crear=crearLienzo,progreso=()=>{}}={}){
 async function pass(config,mode){
  const canvas=prepararImagenFactura(img,config,crear);
  try{
   await worker.setParameters({tessedit_pageseg_mode:String(mode),user_defined_dpi:'260',preserve_interword_spaces:'1',tessedit_char_whitelist:''});
   const data=(await worker.recognize(canvas)).data||{};
   return {data,ancho:canvas.width,alto:canvas.height,config,...score(data,items)};
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
 if(meta.rut.replace(/\./g,'')==='77557762-2')meta.proveedor='COMERCIALIZADORA BOMBO SPA';
 let columnas=null;
 if(best.fiables<cantidadProbable&&base.data.words?.length){
  progreso('Separando los productos de las cantidades y precios…');
  try{columnas=await alternativaPorColumnas(img,worker,base,items,crear);}catch{}
 }
 if(columnas&&columnas.filas.length>best.fiables){
  const {filas,totalLineas,lecturaParcial,faltanCantidades}=columnas;
  const texto=[meta.proveedor,meta.rut&&'RUT: '+meta.rut,meta.folio&&'Folio: '+meta.folio,
   ...filas.map(f=>f.nombre+' '+f.cantidad+' '+f.unidad)].filter(Boolean).join('\n');
  return {texto,filas,meta,lecturaParcial,totalLineas,faltanCantidades,lineasTabulares:filas.length};
 }
 const texto=[meta.proveedor,meta.rut&&'RUT: '+meta.rut,meta.folio&&'Folio: '+meta.folio,best.data.text].filter(Boolean).join('\n');
 return {texto,filas:best.fiables?best.filas.filter(f=>f.origen==='pdf'):[],meta,
  totalLineas:Math.max(cantidadProbable,best.fiables),lecturaParcial:best.fiables<2||cantidadProbable>best.fiables||
  seen.some(x=>x.filas.length>best.filas.length+1),
  lineasTabulares:best.fiables};
}
