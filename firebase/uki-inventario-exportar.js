/* Uki Sushi · Informes descargables en iPhone sin enviar datos a terceros. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ukiInventarioExportar=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const TIMEZONE='America/Santiago';
 const fileSafe=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
 function fechaChile(value){
  const d=new Date(value);
  if(Number.isNaN(d.valueOf()))throw Error('Fecha de inventario inválida.');
  const p=new Intl.DateTimeFormat('es-CL',{
   timeZone:TIMEZONE,weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',
   hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(d);
  const v=name=>p.find(x=>x.type===name)?.value||'';
  return {dia:v('weekday'),fecha:v('day')+'/'+v('month')+'/'+v('year'),
   hora:v('hour')+':'+v('minute'),iso:v('year')+'-'+v('month')+'-'+v('day')};
 }
 const branchName=b=>b==='arica'?'Regimiento Arica':b==='serena'?'La Serena':'Sucursal';
 function resumenFila(item){
  const stock=Number(item.stock_qty)||0,minimum=Number(item.min_stock_qty)||0;
  const toBuy=minimum>0?Math.max(0,Math.round((minimum-stock)*1000)/1000):0;
  // Reportes anteriores y estado actual no disponen de entradas por período.
  // No convertir un valor ausente en 0: sería dar a entender que no llegó nada.
  const recibido=item.received_qty===null||item.received_qty===undefined?null:Number(item.received_qty);
  const received=recibido!==null&&Number.isFinite(recibido)&&recibido>=0?Math.round(recibido*1000)/1000:null;
  return {name:String(item.name||''),kind:String(item.kind||''),stock,minimum,unit:String(item.stock_unit||'un'),
   received,toBuy,status:minimum<=0?'Sin mínimo':stock<=minimum?'Reponer':'Bien'};
 }
 function filas(report){
  if(!report||!Array.isArray(report.items))throw Error('Falta el detalle del inventario.');
  if(report.items.length>2000)throw Error('El inventario excede el tamaño permitido.');
  const orden={Reponer:0,Bien:1,'Sin mínimo':2};
  return report.items.map(resumenFila).sort((a,b)=>orden[a.status]-orden[b.status]||a.name.localeCompare(b.name,'es'));
 }
 function nombreArchivo(report,ext){
  const meta=fechaChile(report.created_at);
  return 'uki-inventario-'+fileSafe(branchName(report.branch))+'-'+meta.iso+'-'+
   meta.hora.replace(':','-')+'.'+ext;
 }
 function tabla(report){
  const f=fechaChile(report.created_at),rows=filas(report);
  const encabezado=['Fecha','Día','Hora','Sucursal','Responsable','Artículo',
   'Tipo','Lo que hay','Lo que llegó','Unidad','Mínimo','Lo que falta','Qué pedir','Estado'];
  const body=rows.map(x=>[f.fecha,f.dia,f.hora,branchName(report.branch),
   String(report.worker_name||''),x.name,x.kind,x.stock,x.received===null?'':x.received,
   x.unit,x.minimum,x.toBuy,x.status==='Reponer'&&x.toBuy===0?'Mínimo alcanzado: revisar':x.toBuy,x.status]);
  return [encabezado,...body];
 }
 // Se abre en Excel: CSV UTF-8 con BOM y separador de Chile.
 function csv(report){
  const guard=x=>{
   let s=String(x??'');
   if(/^[\s]*[=+\-@]/.test(s))s="'"+s; // evita ejecutar fórmulas en Excel
   return '"'+s.replace(/"/g,'""')+'"';
  };
  return '\uFEFFsep=;\r\n'+tabla(report).map(row=>row.map(guard).join(';')).join('\r\n')+'\r\n';
 }
 function mensaje(report){
  const f=fechaChile(report.created_at),r=filas(report);
  const faltantes=r.filter(x=>x.status==='Reponer');
  const entradas=r.filter(x=>x.received!==null&&x.received>0);
  const msg=['📦 UKI SUSHI · INVENTARIO ORDENADO',
   'Sucursal: '+branchName(report.branch),
   'Registrado: '+f.dia+', '+f.fecha+' · '+f.hora+' h (Chile)',
   'Responsable: '+String(report.worker_name||'Sin identificar'),
   'Existencias: '+r.length+' artículos · Para reponer: '+faltantes.length,
   '','📥 LO QUE LLEGÓ'+(report.summary?.entradas_periodo?' ('+report.summary.entradas_periodo+')':'')+':'];
  if(!r.some(x=>x.received!==null))msg.push('Entradas no desglosadas en esta revisión.');
  else if(!entradas.length)msg.push('Sin entradas registradas en el período.');
  else{
   for(const x of entradas.slice(0,15))msg.push('• '+x.name+': +'+x.received+' '+x.unit);
   if(entradas.length>15)msg.push('… y '+(entradas.length-15)+' artículos más en PDF/Excel.');
  }
  msg.push('','🛒 LO QUE FALTA Y QUÉ PEDIR:');
  if(!faltantes.length)msg.push('Sin faltantes según los mínimos configurados.');
  else{
   for(const x of faltantes.slice(0,35))
    msg.push('• '+x.name+': hay '+x.stock+' '+x.unit+', mínimo '+x.minimum+
     ' '+x.unit+(x.toBuy?' · faltan '+x.toBuy:' · mínimo alcanzado'));
   if(faltantes.length>35)msg.push('…y '+(faltantes.length-35)+' artículos más en el archivo.');
  }
  msg.push('','Disponible/Agotado de la carta es manual e independiente del stock.');
  return msg.join('\n');
 }
 const latin=s=>Array.from(String(s)).map(x=>{
  const code=x.codePointAt(0);
  if(code>=32&&code<=255)return x;
  if(x==='\n')return ' ';
  return ({'–':'-','—':'-','“':'"','”':'"','‘':"'",'’':"'",'•':'-','…':'...'})[x]||'?';
 }).join('');
 const pdfEscape=s=>latin(s).replace(/[\\()]/g,'\\$&');
 function pdf(report){
  const f=fechaChile(report.created_at),r=filas(report);
  const entries=r.filter(x=>x.received!==null&&x.received>0).length;
  const head=[
    'UKI SUSHI  |  INVENTARIO DEL TURNO',
    branchName(report.branch)+'  |  '+f.dia+' '+f.fecha+'  |  '+f.hora+' h Chile',
    'Responsable: '+String(report.worker_name||'Sin identificar').slice(0,48),
    'Articulos: '+r.length+'  |  Reponer: '+r.filter(x=>x.status==='Reponer').length+
      '  |  Con entradas: '+entries,
    'Entradas: '+String(report.summary?.entradas_periodo||'sin periodo definido'),
    ''
  ];
  const lines=[...head];
  const groups=[['Reponer','PARA REPONER / LISTA DE COMPRA'],
   ['Bien','EXISTENCIAS SUFICIENTES'],['Sin mínimo','SIN MINIMO CONFIGURADO']];
  for(const [key,title] of groups){
    const part=r.filter(x=>x.status===key);
    if(!part.length)continue;
    lines.push('== '+title+' ('+part.length+') ==');
    lines.push('ARTICULO                 HAY         LLEGO        MINIMO       PEDIR');
    lines.push('--------------------------------------------------------------------');
    for(const x of part){
      const name=x.name.length>23?x.name.slice(0,21)+'..':x.name;
      const stock=(x.stock+' '+x.unit).slice(0,12);
      const arrived=x.received===null?'--':(x.received+' '+x.unit).slice(0,12);
      const minimum=x.minimum>0?(x.minimum+' '+x.unit).slice(0,12):'Sin minimo';
      const buy=x.status==='Reponer'?(x.toBuy>0?(x.toBuy+' '+x.unit):'Revisar'): '-';
      lines.push(name.padEnd(24)+' '+stock.padEnd(11)+' '+arrived.padEnd(12)+
        ' '+minimum.padEnd(12)+' '+buy);
    }
    lines.push('');
  }
  if(!r.length)lines.push('No hay articulos registrados.');
  lines.push('-- = No se dispone del detalle de entradas en esta revision.');
  lines.push('Pedir segun minimo. Al alcanzar el minimo: revisar compra.');
  lines.push('El stock corresponde al momento guardado, no a la existencia actual.');
  // Páginas con encabezado repetido para que siempre se identifique el informe.
  const chunks=[];let idx=0;
  while(idx<lines.length){
    const room=chunks.length===0?39:35;
    const page=(chunks.length===0?[]:[head[0],head[1],head[2],'']);
    page.push(...lines.slice(idx,idx+room));idx+=room;chunks.push(page);
  }
  const objectCount=3+chunks.length*2,objects=new Array(objectCount+1).fill('');
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[2]='<< /Type /Pages /Kids ['+chunks.map((_,i)=>(4+2*i)+' 0 R').join(' ')+'] /Count '+chunks.length+' >>';
  objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
  for(let i=0;i<chunks.length;i++){
    const pageId=4+2*i,streamId=pageId+1;
    objects[pageId]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>';
    const stream=chunks[i].map((line,j)=>{
      const label=line.startsWith('== '),divider=line.startsWith('---'),heading=j===0;
      const color=label?'0.67 0.31 0.12 rg ':heading?'0.26 0.19 0.13 rg ':
       divider?'0.55 0.43 0.34 rg ':'0.2 0.2 0.2 rg ';
      return 'BT '+color+'/F1 '+(label||heading?'10':'8.5')+' Tf 30 '+(790-j*17)+' Td ('+
       pdfEscape(line.slice(0,91))+') Tj ET';
    }).join('\n')+
     '\nBT /F1 8 Tf 30 45 Td (Pagina '+(i+1)+' de '+chunks.length+') Tj ET\n';
    objects[streamId]='<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream';
  }
  let result='%PDF-1.4\n',offsets=[0];
  for(let i=1;i<=objectCount;i++){
    offsets.push(result.length);
    result+=i+' 0 obj\n'+objects[i]+'\nendobj\n';
  }
  const start=result.length;
  result+='xref\n0 '+(objectCount+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<=objectCount;i++)result+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  result+='trailer\n<< /Size '+(objectCount+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';
  return new Uint8Array(Array.from(result,x=>x.charCodeAt(0)));
 }
 function descargar(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.style.display='none';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),20000);
 }
 function excel(report){descargar(new Blob([csv(report)],{type:'text/csv;charset=utf-8'}),nombreArchivo(report,'csv'));}
 function guardarPDF(report){descargar(new Blob([pdf(report)],{type:'application/pdf'}),nombreArchivo(report,'pdf'));}
 async function whatsapp(report){
  const text=mensaje(report);
  const blob=new Blob([pdf(report)],{type:'application/pdf'});
  if(typeof File!=='undefined'&&navigator.share){
   const file=new File([blob],nombreArchivo(report,'pdf'),{type:'application/pdf'});
   if(!navigator.canShare||navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:'Inventario Uki Sushi',text});return 'archivo';}
    catch(e){if(e?.name==='AbortError')return 'cancelado';}
   }
  }
  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');
  return 'texto';
 }
 return {fechaChile,branchName,filas,tabla,csv,pdf,mensaje,nombreArchivo,excel,guardarPDF,whatsapp};
});
