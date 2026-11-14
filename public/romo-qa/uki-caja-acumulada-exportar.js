/* Uki Sushi · exportación local de Caja acumulada en efectivo.
   CSV compatible Excel, PDF y compartir WhatsApp; sin enviar registros a terceros. */
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.ukiCajaAcumExportar=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const TIMEZONE='America/Santiago';
const branchName=b=>b==='arica'?'Regimiento Arica':b==='serena'?'La Serena':'Sucursal';
const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
const types={apertura:'Saldo inicial',cierre:'Cierre confirmado',ajuste_cierre:'Ajuste de cierre',
 entrada:'Entrada',gasto:'Gasto',retiro:'Retiro',traspaso_salida:'Traspaso enviado',traspaso_entrada:'Traspaso recibido'};
function dateChile(v){
 const d=new Date(v);if(Number.isNaN(d.getTime()))return 'Sin fecha';
 return new Intl.DateTimeFormat('es-CL',{timeZone:TIMEZONE,day:'2-digit',month:'2-digit',year:'numeric',
 hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
}
function safeCsv(v){
 let s=String(v??'');
 if(/^\s*[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function rows(report){
 if(!report||!['arica','serena'].includes(report.branch)||!Array.isArray(report.history)||
 report.history.length>1500)throw Error('Historial no disponible.');
 const headers=['Sucursal','Fecha y hora Chile','Tipo','Monto CLP','Saldo después CLP',
  'Concepto','Responsable','Fecha operativa','Referencia de cierre'];
 const data=report.history.map(m=>[branchName(report.branch),dateChile(m.creado_en),
  types[m.tipo]||m.tipo,Number(m.monto),Number(m.saldo_resultante),
  m.concepto,m.responsable||'',m.fecha_operativa||'',m.cierre_clave||'']);
 return [headers,...data];
}
function csv(report){return '\uFEFFsep=;\r\n'+rows(report).map(row=>row.map(safeCsv).join(';')).join('\r\n')+'\r\n';}
function message(report){
 rows(report);
 const out=['💵 UKI SUSHI · CAJA ACUMULADA EN EFECTIVO',
  'Sucursal: '+branchName(report.branch),
  'Saldo: '+money(report.balance),
  'Movimientos en el resumen: '+report.history.length,
  'Fecha de consulta: '+dateChile(report.generated_at||new Date().toISOString()),
  '','MOVIMIENTOS'];
 for(const m of report.history.slice(0,20))
  out.push('• '+dateChile(m.creado_en)+' · '+(types[m.tipo]||m.tipo)+' · '+money(m.monto)+
   ' · '+String(m.concepto||'').slice(0,45)+' · '+String(m.responsable||'').slice(0,35));
 if(report.history.length>20)out.push('…'+(report.history.length-20)+' movimientos adicionales en el archivo.');
 out.push('','Las ventas bancarias no se suman al efectivo físico.');
 return out.join('\n');
}
function latin(s){
 return Array.from(String(s)).map(c=>{
  const n=c.codePointAt(0);
  if(n>=32&&n<=255)return c;
  if(c==='\n')return ' ';
  return ({'–':'-','—':'-','“':'"','”':'"','‘':"'",'’':"'",'•':'-','…':'...','💵':'$'})[c]||'?';
 }).join('');
}
const escape=s=>latin(s).replace(/[\\()]/g,'\\$&');
function pdf(report){
 rows(report);
 const lines=['UKI SUSHI | CAJA ACUMULADA EN EFECTIVO',
  'Sucursal: '+branchName(report.branch),
  'Saldo disponible: '+money(report.balance),
  'Consulta: '+dateChile(report.generated_at||new Date().toISOString()),
  '',
  'FECHA          TIPO              MONTO       SALDO',
  '-------------------------------------------------------------'];
 for(const m of report.history){
  const typ=(types[m.tipo]||String(m.tipo||'')).slice(0,16);
  lines.push(dateChile(m.creado_en).padEnd(17)+typ.padEnd(18)+
   money(m.monto).padEnd(12)+money(m.saldo_resultante));
  lines.push(('  '+String(m.concepto||'').slice(0,58)+' | '+String(m.responsable||'')).slice(0,95));
 }
 if(!report.history.length)lines.push('Sin movimientos registrados.');
 lines.push('','Documento de consulta. No cambia los cierres ni el saldo.');
 const pages=[];for(let i=0;i<lines.length;i+=38)pages.push(lines.slice(i,i+38));
 const n=3+pages.length*2,objs=Array(n+1).fill('');
 objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
 objs[2]='<< /Type /Pages /Kids ['+pages.map((_,i)=>(4+i*2)+' 0 R').join(' ')+'] /Count '+pages.length+' >>';
 objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
 pages.forEach((list,i)=>{
  const id=4+i*2,streamId=id+1;
  objs[id]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>';
  const stream=list.map((line,j)=>'BT /F1 9 Tf 28 '+(797-j*18)+' Td ('+escape(line.slice(0,103))+') Tj ET').join('\n')+
    '\nBT /F1 9 Tf 28 50 Td (Pagina '+(i+1)+' de '+pages.length+') Tj ET\n';
  objs[streamId]='<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream';
 });
 let pdfText='%PDF-1.4\n',offset=[0];
 for(let i=1;i<=n;i++){offset.push(pdfText.length);pdfText+=i+' 0 obj\n'+objs[i]+'\nendobj\n';}
 const start=pdfText.length;
 pdfText+='xref\n0 '+(n+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<=n;i++)pdfText+=String(offset[i]).padStart(10,'0')+' 00000 n \n';
 pdfText+='trailer\n<< /Size '+(n+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';
 return new Uint8Array(Array.from(pdfText,c=>c.charCodeAt(0)));
}
const fileName=(report,ext)=>'uki-caja-acumulada-'+report.branch+'-'+
 new Date(report.generated_at||Date.now()).toISOString().slice(0,10)+'.'+ext;
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),20000);
}
function excel(report){saveBlob(new Blob([csv(report)],{type:'text/csv;charset=utf-8'}),fileName(report,'csv'));}
function savePDF(report){saveBlob(new Blob([pdf(report)],{type:'application/pdf'}),fileName(report,'pdf'));}
async function whatsapp(report){
 const msg=message(report),blob=new Blob([pdf(report)],{type:'application/pdf'});
 if(typeof File!=='undefined'&&navigator.share){
  const file=new File([blob],fileName(report,'pdf'),{type:'application/pdf'});
  if(!navigator.canShare||navigator.canShare({files:[file]})){
   try{await navigator.share({files:[file],text:msg,title:'Caja acumulada Uki Sushi'});return 'archivo';}
   catch(e){if(e?.name==='AbortError')return 'cancelado';}
  }
 }
 window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener');return 'texto';
}
return {branchName,dateChile,rows,csv,pdf,message,excel,savePDF,whatsapp,fileName};
});