/* Archivo mensual por sucursal: respaldos de dueños, sin limpiar datos.
 * Primer archivo noviembre 2026: 05-12-2026, solo con Google+PIN privado.
 */
(function(root,factory){
 const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root){root.ukiArchivoMensualV1=api;if(root.document)api.instalar();}
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const MAP={'Uki Regimiento Arica':'uki:arica','Uki La Serena':'uki:serena',
 'Romo’s Sushi La Serena':'romo:serena'};
const SERIES=['pedidos','cierres','gastos','retiros','propinas','deliveriesManuales',
 'incidencias','ajustesHistoricos','solicitudesWhatsApp'];
const FIN='https://uki-sushi-inventario.vercel.app/api/mi-administracion-live';
const $=id=>document.getElementById(id);
function today(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  .filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function cutoff(mes){
 if(typeof mes!=='string'||!/^20\d\d-(0[1-9]|1[0-2])$/.test(mes))throw Error('Mes inválido');
 return new Date(Date.UTC(Number(mes.slice(0,4)),Number(mes.slice(5)),5)).toISOString().slice(0,10);
}
function dateKey(x){
 if(!x||typeof x!=='object')return '';
 for(const key of ['fechaOperativa','fechaISO','fecha','fechaPedido','creadoEn','creado_en',
  'registradoEn','updatedAt','fechaRegistro','timestamp','fechaMs','creadoMs']){
  const v=x[key];
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  if((typeof v==='number'||/^\d{13}$/.test(String(v)))&&Number(v)>1600000000000){
   const d=new Date(Number(v));if(!Number.isNaN(d.getTime())){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',
     year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d)
     .filter(z=>z.type!=='literal').map(z=>[z.type,z.value]));
    return p.year+'-'+p.month+'-'+p.day;
   }
  }
 }
 return '';
}
function build(estado,mes){
 if(!estado||!MAP[estado.suc])throw Error('Abre primero una sucursal autorizada');
 if(mes<'2026-11'||today()<cutoff(mes))throw Error('Noviembre se archiva desde el 5 de diciembre de 2026');
 const secciones={},sinFecha={};
 for(const s of SERIES){
  const a=Array.isArray(estado[s])?estado[s]:[];
  const propias=a.filter(x=>x&&x.suc===estado.suc);
  secciones[s]=propias.filter(x=>dateKey(x).slice(0,7)===mes);
  sinFecha[s]=propias.filter(x=>!dateKey(x)).length;
 }
 const usados=new Set();
 for(const p of secciones.pedidos){
  for(const key of ['telefono','codigoCliente']){
   const v=String(p[key]||'').replace(/\D/g,'');if(v)usados.add(v);
  }
 }
 secciones.clientes=Object.entries(estado.clientes||{}).filter(([,c])=>{
  if(!c||typeof c!=='object')return false;
  const tel=String(c.telefono||'').replace(/\D/g,'');
  const code=String(c.codigoCliente||'').replace(/\D/g,'');
  return (tel&&usados.has(tel))||(code&&usados.has(code))||
   (c.movimientos||[]).some(m=>dateKey(m).slice(0,7)===mes);
 }).map(([clave,perfil])=>({clave,...perfil,movimientos:(perfil.movimientos||[]).filter(m=>dateKey(m).slice(0,7)===mes)}));
 return {formato:'uki-archivo-mensual-v1',sucursal:estado.suc,mes,
  generadoEn:new Date().toISOString(),saldoTimbresVigentesIncluido:false,
  sinFecha,secciones};
}
function csvQuote(v){
 let s=String(v??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function filas(doc){
 const a=[['Sección','Fecha','ID','Cliente','WhatsApp','Medio','Estado','Monto CLP','Detalle completo']];
 for(const [section,list] of Object.entries(doc.secciones)){
  for(const x of list){
   const y=x||{};
   a.push([section,dateKey(y),y.turnoClave||y.turno_ref||y.id||y.clave||'',
    y.cliente||y.nombre||y.responsable||'',y.telefono||y.whatsapp||'',
    y.medio||y.medioPago||'',y.estado||'',
    y.total??y.venta??y.monto??'',JSON.stringify(y)]);
  }
 }
 return a;
}
const csv=doc=>'\uFEFFsep=;\r\n'+filas(doc).map(row=>row.map(csvQuote).join(';')).join('\r\n')+'\r\n';
const latin=s=>Array.from(String(s)).map(c=>{
 const n=c.codePointAt(0);if(n>=32&&n<=255)return c;
 return ({'–':'-','—':'-','“':'"','”':'"','‘':"'",'’':"'",'•':'-','💵':'$'})[c]||'?';
}).join('');
const escapePdf=s=>latin(s).replace(/[\\()]/g,'\\$&');
function pdf(doc){
 const lines=['ARCHIVO MENSUAL OPERATIVO',doc.sucursal+' | '+doc.mes,
  'Datos detallados respaldados en Mi Administracion, solo consulta.',''];
 for(const [section,items]of Object.entries(doc.secciones)){
  lines.push(section.toUpperCase()+' · '+items.length+' registros');
  for(const x of items){
   const detalle=[dateKey(x),x.turnoClave||x.id||x.clave||'',x.cliente||x.nombre||'',
    x.total??x.venta??x.monto??'',x.medio||'',x.estado||''].join(' | ');
   lines.push('  '+detalle.slice(0,104));
  }
  lines.push('');
 }
 lines.push('Este informe NO modifica cierres, saldos, clientes ni timbres.');
 const pages=[];for(let i=0;i<lines.length;i+=39)pages.push(lines.slice(i,i+39));
 const n=3+pages.length*2,objs=Array(n+1).fill('');
 objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
 objs[2]='<< /Type /Pages /Kids ['+pages.map((_,i)=>4+i*2+' 0 R').join(' ')+'] /Count '+pages.length+' >>';
 objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
 pages.forEach((lines,i)=>{
  const id=4+i*2,streamId=id+1;
  objs[id]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>';
  const stream=lines.map((s,j)=>'BT /F1 9 Tf 28 '+(797-j*18)+' Td ('+escapePdf(s.slice(0,98))+') Tj ET').join('\n')+
   '\nBT /F1 9 Tf 28 40 Td (Pagina '+(i+1)+' / '+pages.length+') Tj ET\n';
  objs[streamId]='<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream';
 });
 let out='%PDF-1.4\n',offset=[0];
 for(let i=1;i<=n;i++){offset.push(out.length);out+=i+' 0 obj\n'+objs[i]+'\nendobj\n';}
 const start=out.length;out+='xref\n0 '+(n+1)+'\n0000000000 65535 f \n';
 for(let i=1;i<=n;i++)out+=String(offset[i]).padStart(10,'0')+' 00000 n \n';
 out+='trailer\n<< /Size '+(n+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';
 return new Uint8Array(Array.from(out,c=>c.charCodeAt(0)));
}
function download(doc,type){
 const b=type==='csv'?new Blob([csv(doc)],{type:'text/csv;charset=utf-8'}):
  new Blob([pdf(doc)],{type:'application/pdf'});
 const a=document.createElement('a'),url=URL.createObjectURL(b);
 a.href=url;a.download='archivo-'+MAP[doc.sucursal].replace(':','-')+'-'+doc.mes+'.'+type;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
}
const toB64=arr=>{let s='';for(let i=0;i<arr.length;i+=8192)s+=String.fromCharCode(...arr.subarray(i,i+8192));return btoa(s)};
async function comprimido(doc){
 if(typeof CompressionStream==='undefined')throw Error('El navegador no admite compresión segura; no se archivó');
 const stream=new Blob([JSON.stringify(doc)]).stream().pipeThrough(new CompressionStream('gzip'));
 const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return {comprimido:toB64(bytes),sha256:[...digest].map(x=>x.toString(16).padStart(2,'0')).join('')};
}
async function request(token,action,more={},session=''){
 const r=await fetch(FIN,{method:'POST',credentials:'omit',cache:'no-store',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,
   ...(session?{'X-Fin-Session':session}:{})},body:JSON.stringify({action,...more})});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j.ok!==true)throw Error(j.error||'Mi Administración no confirmó el respaldo');
 return j;
}
function instalar(){
 const start=()=>{
  if($('ukiArchivoMensualDueños'))return;
  const el=document.createElement('details');el.id='ukiArchivoMensualDueños';
  el.style.cssText='max-width:680px;margin:14px auto;padding:14px;border:1px solid #bbb;border-radius:14px;background:#fff;color:#222;font:14px/1.4 system-ui';
  el.innerHTML='<summary style="cursor:pointer;font-weight:800">📁 Archivo mensual · Solo dueños</summary>'+
  '<p>Primer respaldo: <b>5 de diciembre de 2026</b> · información del 1 al 30 de noviembre. No se borrará nada antes de confirmar los archivos.</p>'+
  '<label>Mes: <input type="month" id="ukiArchivoMes" min="2026-11" value="2026-11"></label>'+
  '<p><label>PIN privado de Mi Administración: <input id="ukiArchivoPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="6 dígitos"></label></p>'+
  '<button id="ukiArchivoGuardar" type="button">Guardar mes en Mi Administración</button>'+
  '<button id="ukiArchivoExcel" type="button" disabled>Descargar Excel (.csv)</button>'+
  '<button id="ukiArchivoPDF" type="button" disabled>Descargar PDF</button>'+
  '<p id="ukiArchivoEstado" role="status" style="font-size:13px"></p>';
  document.body.append(el);
  let last=null,busy=false;
  const status=s=>{$('ukiArchivoEstado').textContent=s};
  const sync=()=>{
   const x=window.ukiQAGet?.(),valid=!!x&&!!MAP[x.suc];
   el.hidden=!valid;
   if(valid){
    const ms=$('ukiArchivoMes').value;
    if(ms&&!/^20\d\d-(0[1-9]|1[0-2])$/.test(ms))$('ukiArchivoMes').value='2026-11';
   }
  };
  const obs=new MutationObserver(sync);const app=$('app');
  if(app)obs.observe(app,{childList:true});sync();
  $('ukiArchivoGuardar').onclick=async()=>{
   if(busy)return;
   busy=true;$('ukiArchivoGuardar').disabled=true;last=null;
   $('ukiArchivoExcel').disabled=$('ukiArchivoPDF').disabled=true;
   try{
    const snap=window.ukiQAGet?.(),mes=$('ukiArchivoMes').value,pin=$('ukiArchivoPin').value;
    $('ukiArchivoPin').value='';
    if(!snap||!MAP[snap.suc])throw Error('Abre la sucursal antes del respaldo');
    if(today()<cutoff(mes))throw Error('El primer archivo de noviembre corresponde al 5 de diciembre de 2026');
    if(!/^\d{6}$/.test(pin))throw Error('Ingresa el PIN privado de dueños');
    if(snap.suc==='Romo’s Sushi La Serena'&&
       (!window.ukiRomoSesionRemotaQA?.disponible?.()||window.ukiRomoSesionRemotaQA.estado()?.conflicto))
     throw Error('Antes del respaldo sincroniza el estado oficial Romo');
    const token=await window.ukiInventarioToken?.();
    if(!token)throw Error('Entra con Google de dueños para guardar el archivo');
    status('Preparando y verificando el mes en Mi Administración…');
    const doc=build(snap.estado,mes),pack=await comprimido(doc);
    const login=await request(token,'ingresar_pin',{pin});
    const saved=await request(token,'archivo_operativo_guardar',
     {sucursal:MAP[snap.suc],mes,...pack},login.sesion);
    if(saved.verificado!==true||saved.archivo?.sha256!==pack.sha256||
       saved.archivo?.sucursal!==MAP[snap.suc]||saved.archivo?.mes!==mes)
      throw Error('La confirmación del archivo no coincide: no se limpia información');
    last=doc;
    const count=Object.values(doc.secciones).reduce((n,a)=>n+a.length,0);
    status('✓ Archivo privado confirmado: '+count+' registros. Descarga Excel y PDF. Ningún dato operativo se eliminó.');
    $('ukiArchivoExcel').disabled=$('ukiArchivoPDF').disabled=false;
   }catch(e){status('No se archivó ni eliminó información: '+String(e.message||e));}
   finally{busy=false;$('ukiArchivoGuardar').disabled=false;}
  };
  $('ukiArchivoExcel').onclick=()=>{if(last)download(last,'csv')};
  $('ukiArchivoPDF').onclick=()=>{if(last)download(last,'pdf')};
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
return {today,cutoff,dateKey,build,filas,csv,pdf,instalar};
});
