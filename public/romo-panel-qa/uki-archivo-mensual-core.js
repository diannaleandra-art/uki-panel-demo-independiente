/* Archivo mensual Uki/Romo v1. Solo lectura: nunca modifica el estado operativo. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.UkiArchivoMensual=api;
})(typeof window==='object'?window:null,function(){
 'use strict';
 const SECCIONES=['pedidos','cierres','gastos','retiros','propinas','deliveriesManuales','incidencias','ajustesHistoricos','solicitudesWhatsApp','cajasDiarias'];
 const SUCURSALES={'Uki Regimiento Arica':'uki:arica','Uki La Serena':'uki:serena','Romo’s Sushi La Serena':'romo:serena'};
 const fechaValida=s=>/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 const localFecha=v=>{
  if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(v)&&(!v.includes('Z')&&!/[+-]\d{2}:\d{2}$/.test(v)))return v.slice(0,10);
  const d=new Date(v);
  if(!Number.isFinite(d.getTime()))return '';
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
 };
 const fechaRegistro=(v,tipo)=>{
  if(!v||typeof v!=='object')return '';
  if(tipo==='cierres'&&fechaValida(String(v.fechaOperativa||'')))return v.fechaOperativa;
  for(const k of ['fechaISO','fechaOperativa','fecha','created_at','recibidoEn','creadoEn','confirmadoEn','fechaMs','registradoEn','actualizadoEn']){
   const s=v[k];
   if(s!==null&&s!==undefined&&s!==''){
    const f=localFecha(s);
    if(fechaValida(f))return f;
   }
  }
  return '';
 };
 function periodo(mes){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)||mes<'2026-11'||mes>'2099-12')throw Error('Mes incorrecto.');
  const [a,m]=mes.split('-').map(Number),ultimo=new Date(Date.UTC(a,m,0)).getUTCDate();
  const siguiente=new Date(Date.UTC(a,m,5));
  const fechaPermitida=siguiente.toISOString().slice(0,10);
  return {mes,desde:mes+'-01',hasta:mes+'-'+String(ultimo).padStart(2,'0'),desdeDia5:fechaPermitida};
 }
 function generar(estado,mes,ahora=new Date()){
  const p=periodo(mes),sucursal=estado?.suc,code=SUCURSALES[sucursal];
  if(!code)throw Error('El archivo requiere una sucursal reconocida y abierta.');
  if(localFecha(ahora)<p.desdeDia5)throw Error('El primer archivo de '+mes+' se prepara el '+p.desdeDia5+'.');
  const registros={},sinFecha={};
  for(const sec of SECCIONES){
   if(sec==='cajasDiarias')continue;
   if(!Array.isArray(estado[sec]))throw Error('El panel no tiene la sección '+sec+' verificada.');
   const items=estado[sec].filter(x=>x&&x.suc===sucursal),separados=items.filter(x=>!fechaRegistro(x,sec));
   sinFecha[sec]=separados.length;
   registros[sec]=items.filter(x=>{const f=fechaRegistro(x,sec);return f>=p.desde&&f<=p.hasta;}).map(x=>JSON.parse(JSON.stringify(x)));
  }
  // Las cajas diarias son un mapa por sucursal y fecha, no un arreglo.
  // Su detalle incluye precierres, turnos, caja chica y datos de caja acumulada.
  const mapa=estado.cajasDiarias;
  if(!mapa||typeof mapa!=='object'||Array.isArray(mapa))
   throw Error('Falta el historial de cajas diarias para esta sucursal.');
  const prefijo=sucursal+'|';
  const entradas=Object.entries(mapa).filter(([clave])=>clave.startsWith(prefijo));
  sinFecha.cajasDiarias=entradas.filter(([clave,valor])=>
   !fechaValida(clave.slice(prefijo.length))||!valor||
   typeof valor!=='object'||Array.isArray(valor)).length;
  registros.cajasDiarias=entradas.filter(([clave,valor])=>
   fechaValida(clave.slice(prefijo.length))&&valor&&
   typeof valor==='object'&&!Array.isArray(valor)&&
   clave.slice(prefijo.length)>=p.desde&&clave.slice(prefijo.length)<=p.hasta)
   .map(([clave,datos])=>JSON.parse(JSON.stringify({
    suc:sucursal,fechaOperativa:clave.slice(prefijo.length),clave,datos
   })));
  const pedidos=registros.pedidos,clientes=[];
  sinFecha.timbres=0;
  for(const [clave,c] of Object.entries(estado.clientes||{})){
   if(!c||typeof c!=='object'||!Array.isArray(c.movimientos))continue;
   // También auditar timbres antiguos: no omitir silenciosamente los que no tengan fecha.
   sinFecha.timbres+=c.movimientos.filter(m=>!fechaRegistro(m,'timbres')).length;
   const movimientos=c.movimientos.filter(m=>{const f=fechaRegistro(m,'timbres');return f>=p.desde&&f<=p.hasta;});
   const tel=String(c.telefono||'').replace(/\D/g,'');
   const vinculado=pedidos.some(v=>tel.length>=8&&String(v.telefono||'').replace(/\D/g,'')===tel);
   if(movimientos.length||vinculado)
    clientes.push({clave,nombre:c.nombre||'',telefono:c.telefono||'',codigoCliente:c.codigoCliente||'',
     movimientos:JSON.parse(JSON.stringify(movimientos))});
  }
  const ventas=pedidos.filter(x=>x.pagado===true&&x.estado!=='Cancelado'&&!x.esPremio);
  const n=v=>Number.isSafeInteger(Number(v))?Number(v):0;
  const resumen={};
  for(const sec of SECCIONES)resumen[sec]=registros[sec].length;
  resumen.clientes=clientes.length;
  resumen.timbres=clientes.reduce((a,c)=>a+c.movimientos.filter(m=>m.tipo==='venta').length,0);
  resumen.ventasPagadas=ventas.length;
  resumen.totalVentas=ventas.reduce((a,v)=>a+n(v.total),0);
  resumen.totalCierres=registros.cierres.reduce((a,v)=>a+n(v.venta),0);
  return {version:1,sucursal:code,nombreSucursal:sucursal,mes,desde:p.desde,hasta:p.hasta,
   generadoEn:new Date(ahora).toISOString(),resumen,registros,clientes,sinFecha};
 }
 // Simulación de antigüedad, sin modificar el estado ni el respaldo.
 // Un registro sólo cuenta si el archivo recuperado contiene su copia exacta.
 // No autoriza purga: las dependencias de caja, pedidos, clientes y timbres
 // se deben comprobar también con el estado remoto antes de cualquier escritura.
 function simularRetencion(estado,archivo,ahora=new Date()){
  const p=periodo(archivo?.mes),suc=estado?.suc,code=SUCURSALES[suc];
  const hoy=localFecha(ahora);
  if(!code||archivo.version!==1||archivo.sucursal!==code||archivo.nombreSucursal!==suc||
     archivo.desde!==p.desde||archivo.hasta!==p.hasta||!fechaValida(hoy)||hoy<p.desdeDia5)
   throw Error('Respaldo de sucursal o período no confirmado');
  if(!archivo.sinFecha||[...SECCIONES,'timbres'].some(k=>archivo.sinFecha[k]!==0))
   throw Error('El respaldo tiene registros sin fecha verificable');
  const dias=(f)=>(Date.parse(hoy+'T12:00:00Z')-Date.parse(f+'T12:00:00Z'))/86400000;
  const dentro=f=>fechaValida(f)&&f>=p.desde&&f<=p.hasta;
  const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
  function contar(actual,archivados,tipo,limite){
   if(!Array.isArray(actual)||!Array.isArray(archivados))throw Error('Sección no comprobada: '+tipo);
   const copias=new Map();
   for(const item of archivados){const k=canonical(item);copias.set(k,(copias.get(k)||0)+1);}
   let candidatos=0,noCoinciden=0,conservar=0;
   for(const item of actual){
    const fecha=fechaRegistro(item,tipo);
    if(!dentro(fecha)||dias(fecha)<limite){conservar++;continue;}
    const k=canonical(item),n=copias.get(k)||0;
    if(n<1){noCoinciden++;continue;}
    copias.set(k,n-1);candidatos++;
   }
   return {porAntiguedadYCoincidencia:candidatos,noCoinciden,conservar};
  }
  // Diagnóstico independiente: la edad y la copia no convierten
  // un pedido abierto en un pedido apto para eliminación.
  const pedidosAbiertos=(estado.pedidos||[]).filter(x=>x?.suc===suc&&dentro(fechaRegistro(x,'pedidos'))&&dias(fechaRegistro(x,'pedidos'))>=35&&
   !(x.estado==='Cancelado'||(x.estado==='Entregado'&&x.pagado===true))).length;
  const solicitudesPendientes=(estado.solicitudesWhatsApp||[]).filter(x=>x?.suc===suc&&dentro(fechaRegistro(x,'solicitudesWhatsApp'))&&dias(fechaRegistro(x,'solicitudesWhatsApp'))>=35&&
   !['aceptado','rechazado','cancelado','procesado'].includes(String(x.estado||'').toLowerCase())).length;
  const secciones={};
  for(const sec of SECCIONES){
   if(sec==='cajasDiarias'){
    if(!estado.cajasDiarias||typeof estado.cajasDiarias!=='object'||Array.isArray(estado.cajasDiarias))throw Error('Cajas no comprobadas');
    const prefix=suc+'|';
    const actual=Object.entries(estado.cajasDiarias).filter(([k])=>k.startsWith(prefix)).map(([clave,datos])=>({suc,fechaOperativa:clave.slice(prefix.length),clave,datos}));
    secciones[sec]=contar(actual,archivo.registros?.[sec],sec,35);
   }else{
    if(!Array.isArray(estado[sec]))throw Error('Falta '+sec);
    secciones[sec]=contar(estado[sec].filter(x=>x?.suc===suc),archivo.registros?.[sec],sec,35);
   }
  }
  if(!Array.isArray(archivo.clientes))throw Error('Clientes no comprobados');
  const clientes=new Map(archivo.clientes.map(c=>[c.clave,c]));
  if(clientes.size!==archivo.clientes.length)throw Error('Clientes duplicados en el respaldo');
  const timbres={porAntiguedadYCoincidencia:0,noCoinciden:0,conservar:0};
  for(const [clave,c] of Object.entries(estado.clientes||{})){
   if(!Array.isArray(c?.movimientos))continue;
   const a=contar(c.movimientos,clientes.get(clave)?.movimientos||[],'timbres',95);
   for(const k of Object.keys(timbres))timbres[k]+=a[k];
  }
  return Object.freeze({sucursal:code,mes:archivo.mes,hoy,operativosDias:35,timbresDias:95,
   secciones,timbres,bloqueos:{pedidosAbiertos,solicitudesPendientes},simulacion:true,permiteEliminar:false,
   aviso:'Solo simulación de antigüedad y coincidencia. No confirma que los registros puedan eliminarse.'});
 }
 const csvSafe=v=>{
  let s=typeof v==='string'?v:JSON.stringify(v??'');
  if(/^\s*[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 function lineas(archivo){
  const result=[['Sección','Fecha','Folio','Cliente','WhatsApp','Código cliente','Estado','Medio de pago','Total CLP','Detalle completo']];
  for(const sec of SECCIONES){
   for(const x of archivo.registros[sec]){
    result.push([sec,fechaRegistro(x,sec),x.turnoClave||x.codigoCarta||x.id||'',
     x.cliente||x.resp||x.responsable||'',x.telefono||x.whatsapp||'',
     x.codigoCliente||'',x.estado||'',x.medio||'',x.total??x.venta??x.monto??'',x]);
   }
  }
  for(const c of archivo.clientes){
   result.push(['clientes','',c.codigoCliente||'',c.nombre||'',c.telefono||'',
    c.codigoCliente||'','','','',c]);
   for(const m of c.movimientos)result.push(
    ['timbres',fechaRegistro(m,'timbres'),m.pedidoId||'',c.nombre,c.telefono,
     c.codigoCliente,m.tipo,'',m.monto??'',m]);
  }
  return result;
 }
 function hojasExcel(archivo){
  const registros=lineas(archivo),encabezado=registros[0].slice(1);
  const hojas=[{nombre:'Resumen',columnas:['Concepto','Dato'],filas:[
   ['Sucursal',archivo.nombreSucursal],['Mes',archivo.mes],
   ['Desde',archivo.desde],['Hasta',archivo.hasta],
   ...Object.entries(archivo.resumen).map(([clave,valor])=>[clave,valor])
  ]}];
  const nombres=[...SECCIONES.map(s=>[s,({
   pedidos:'Pedidos',cierres:'Cierres',gastos:'Gastos',retiros:'Retiros',propinas:'Propinas',
   deliveriesManuales:'Delivery manual',incidencias:'Incidencias',ajustesHistoricos:'Ajustes históricos',
   solicitudesWhatsApp:'Solicitudes WhatsApp',cajasDiarias:'Cajas diarias'})[s]||s]),
   ['clientes','Clientes'],['timbres','Timbres']];
  for(const [codigo,nombre] of nombres){
   hojas.push({nombre,columnas:encabezado,filas:registros.slice(1)
    .filter(fila=>fila[0]===codigo).map(fila=>fila.slice(1).map(valor=>
     valor&&typeof valor==='object'?JSON.stringify(valor):valor))});
  }
  return hojas;
 }
 function excel(archivo){return '\uFEFFsep=;\r\n'+lineas(archivo).map(row=>row.map(csvSafe).join(';')).join('\r\n')+'\r\n';}
 const ascii=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?');
 const pdfEscape=v=>ascii(v).replace(/[\\()]/g,'\\$&');
 function pdf(archivo){
  const r=archivo.resumen;
  const detail=['ARCHIVO MENSUAL - '+archivo.nombreSucursal,
   'Periodo: '+archivo.desde+' al '+archivo.hasta,
   'Documento de consulta. Mi Administracion conserva el archivo original.',
   'Pedidos: '+r.pedidos+' / ventas pagadas: '+r.ventasPagadas+' / monto: '+r.totalVentas+' CLP',
   'Cierres: '+r.cierres+' / venta de cierres: '+r.totalCierres+' CLP',
   'Clientes: '+r.clientes+' / timbres ganados: '+r.timbres,
   ''];
  for(const [seccion,fecha,folio,cliente,whatsapp,codigo,estado,medio,total,contenido] of lineas(archivo).slice(1)){
   const cabecera=ascii(seccion+' | '+fecha+' | '+folio+' | '+cliente+' | '+whatsapp+' | '+codigo+' | '+estado+' | '+medio+' | '+total);
   for(let i=0;i<cabecera.length;i+=80)detail.push(cabecera.slice(i,i+80));
   const v=typeof contenido==='string'?contenido:JSON.stringify(contenido||'');
   // El PDF conserva el detalle íntegro, sin el recorte anterior de 320 caracteres.
   for(let i=0;i<v.length;i+=78)detail.push('  '+ascii(v.slice(i,i+78)));
  }
  const paginas=[];for(let i=0;i<detail.length;i+=45)paginas.push(detail.slice(i,i+45));
  if(paginas.length>3500)throw Error('El PDF supera el tamaño seguro para generar en el teléfono. Conserva el Excel íntegro y el archivo permanente.');
  const objetos=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'];
  const kids=[];
  paginas.forEach((rows,i)=>{
   const pag=4+i*2,stream=pag+1;kids.push(pag+' 0 R');
   let contenido='BT /F1 9 Tf 35 792 Td 12 TL ';
   for(const texto of rows)contenido+='('+pdfEscape(texto)+') Tj T* ';
   contenido+='ET';
   objetos[pag]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+stream+' 0 R >>';
   objetos[stream]='<< /Length '+contenido.length+' >>\nstream\n'+contenido+'\nendstream';
  });
  objetos[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+paginas.length+' >>';
  let out='%PDF-1.4\n',offset=[0];
  for(let i=1;i<objetos.length;i++){offset[i]=out.length;out+=i+' 0 obj\n'+objetos[i]+'\nendobj\n';}
  const start=out.length;
  out+='xref\n0 '+objetos.length+'\n0000000000 65535 f \n';
  for(let i=1;i<objetos.length;i++)out+=String(offset[i]).padStart(10,'0')+' 00000 n \n';
  out+='trailer\n<< /Size '+objetos.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';
  return new Blob([new TextEncoder().encode(out)],{type:'application/pdf'});
 }
 async function digerir(json){
  const raw=new TextEncoder().encode(json),b=await crypto.subtle.digest('SHA-256',raw);
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
 }
 async function empaquetar(archivo){
  const texto=JSON.stringify(archivo);
  if(texto.length>8000000)throw Error('El archivo mensual requiere dividirse en períodos más pequeños; no se elimina nada.');
  const bytes=new TextEncoder().encode(texto),sha256=await digerir(texto);
  let zipped=bytes,encoding='json';
  if(typeof CompressionStream!=='undefined'){
   const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
   zipped=new Uint8Array(await new Response(stream).arrayBuffer());
   encoding='gzip';
  }
  if(zipped.length>1200000)throw Error('Archivo mensual grande para una sola carga: descarga las copias y conserva los datos.');
  let bin='';for(let i=0;i<zipped.length;i+=8192)bin+=String.fromCharCode(...zipped.subarray(i,i+8192));
  return {sha256,encoding,base64:btoa(bin)};
 }
 async function desempaquetar(base64,encoding,sha){
  const bin=atob(base64),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  let raw=bytes;
  if(encoding==='gzip'){
   if(typeof DecompressionStream==='undefined')throw Error('Actualiza Safari para abrir este archivo.');
   const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
   raw=new Uint8Array(await new Response(stream).arrayBuffer());
  }else if(encoding!=='json')throw Error('Formato no reconocido.');
  if(raw.length>8000000)throw Error('Archivo demasiado grande.');
  const json=new TextDecoder().decode(raw);
  if(await digerir(json)!==sha)throw Error('La integridad del archivo no coincide.');
  const obj=JSON.parse(json);
  if(obj.version!==1||!SUCURSALES[obj.nombreSucursal]||obj.sucursal!==SUCURSALES[obj.nombreSucursal]||!Array.isArray(obj.registros?.pedidos))throw Error('Archivo de sucursal inválido.');
  return obj;
 }
 return Object.freeze({SECCIONES,SUCURSALES,periodo,fechaRegistro,generar,simularRetencion,lineas,hojasExcel,excel,pdf,empaquetar,desempaquetar});
});