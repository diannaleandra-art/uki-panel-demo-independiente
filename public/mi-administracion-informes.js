/* Exportación de Mi Administración: sin dependencias remotas y solo en el navegador del dueño.
   Las consultas y permisos están en el endpoint privado Google+PIN. */
const seguro=n=>{const x=Number(n||0);return Number.isSafeInteger(x)&&x>=0?x:0;};
const pesos=n=>'$'+Number(n||0).toLocaleString('es-CL',{maximumFractionDigits:0});
const fecha=x=>String(x||'').slice(0,10);
const normal=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'');
const categoriaCapital=x=>/equipamiento|inversion/.test(normal(x?.categoria));
const patrimonio=x=>['compra','gasto','costo_producto'].includes(x?.tipo)&&categoriaCapital(x);
const gasto=x=>['compra','gasto','costo_producto'].includes(x?.tipo)&&!patrimonio(x);
const lugar=x=>[x.negocio||'',x.sucursal||'General'].filter(Boolean).join(' · ');
const empresa=x=>String(x.razon_social||'Sin clasificar');
const pago=x=>Object.entries(x.medios||{}).filter(([,v])=>seguro(v)>0).map(([m,v])=>m+': '+pesos(v)).join(' · ');
const orden=(a,b)=>String(b[0]).localeCompare(String(a[0]));
const fila=(...v)=>v.map(x=>typeof x==='number'?x:String(x??''));
function hoja(nombre,columnas,filas){return {nombre,columnas,filas};}
export function construirInforme(data){
 if(!data||!Array.isArray(data.movimientos)||!Array.isArray(data.facturas)||
    !Array.isArray(data.cierres)||!Array.isArray(data.pendientes))
  throw Error('No se recibieron todos los datos del informe.');
 const movimientos=data.movimientos,facturas=data.facturas;
 const manuales=movimientos.filter(x=>x.tipo==='venta');
 const refVentas=new Set(manuales.map(x=>normal(x.referencia)).filter(Boolean));
 const cierres=data.cierres.map(c=>({...c,conciliado:refVentas.has(normal(c.turno_ref))}));
 const incluidos=cierres.filter(c=>!c.conciliado);
 const gastosManuales=movimientos.filter(gasto);
 const comprasOperativas=facturas.filter(gasto);
 const capital=movimientos.filter(x=>patrimonio(x)||x.tipo==='retiro'||x.tipo==='ingreso_extra');
 const inversionesFacturas=facturas.filter(patrimonio);
 const total=rows=>rows.reduce((n,x)=>n+seguro(x.monto),0);
 const ventaManual=total(manuales),ventaCierres=incluidos.reduce((n,c)=>n+seguro(c.venta_total),0);
 const gastosPagados=gastosManuales.filter(x=>x.estado!=='pendiente').reduce((n,x)=>n+seguro(x.monto),0)+
  comprasOperativas.filter(x=>x.estado!=='pendiente').reduce((n,x)=>n+seguro(x.monto),0);
 const gastosCierre=incluidos.reduce((n,c)=>n+seguro(c.gastos_cierre)+seguro(c.delivery_por_pagar),0);
 const pendiente=total(data.pendientes);
 const inversiones=total(capital.filter(x=>patrimonio(x)&&x.estado!=='pendiente'))+
  total(inversionesFacturas.filter(x=>x.estado!=='pendiente'));
 const retiros=total(capital.filter(x=>x.tipo==='retiro'&&x.estado!=='pendiente'));
 const ingresosExtra=total(capital.filter(x=>x.tipo==='ingreso_extra'));
 const venta=ventaManual+ventaCierres,gastoControl=gastosPagados+gastosCierre;
 const control=venta-gastoControl;
 const totales={
  ventas:venta,ventasManuales:ventaManual,ventasCierres:ventaCierres,
  gastosPagados:gastosPagados,gastosCierre,resultado:control,
  pendiente,inversiones,retiros,ingresosExtra,coincidencias:cierres.length-incluidos.length,
  facturas:facturas.length,cierres:incluidos.length
 };
 const nota='Resultado preliminar de control, no utilidad contable. Verificar coincidencias entre gastos de cierre y facturas antes de contabilizar.';
 const header=['Indicador','Monto CLP'];
 const resumen=[
  fila('Desde',data.desde),fila('Hasta',data.hasta),
  fila('Ventas de cierres definitivos conciliados',ventaCierres),
  fila('Ventas manuales',ventaManual),fila('Total ventas de control',venta),
  fila('Gastos y compras pagados (manuales y facturas)',gastosPagados),
  fila('Gastos y delivery registrados en cierres',gastosCierre),
  fila('Total gastos de control',gastoControl),
  fila('Resultado de control (no utilidad contable)',control),
  fila('Obligaciones por pagar, todas las fechas',pendiente),
  fila('Inversiones pagadas',inversiones),fila('Retiros de dueños pagados',retiros),
  fila('Ingresos extraordinarios',ingresosExtra),
  fila('Cierres coincidentes excluidos para no duplicar ventas',totales.coincidencias),
  fila('Nota',nota)
 ];
 const ventas=[
  ...manuales.map(x=>fila(fecha(x.fecha),lugar(x),empresa(x),'Venta manual',x.referencia,x.concepto,seguro(x.monto),pago(x))),
  ...cierres.map(c=>fila(fecha(c.fecha),'Uki Sushi · '+(c.branch==='arica'?'Regimiento Arica':'La Serena'),
   'Cierre Uki',c.conciliado?'Coincide con venta manual; no sumar':'Cierre definitivo',
   c.turno_ref,'',seguro(c.venta_total),pago(c)))
 ].sort(orden);
 const rowsGastos=[
  ...gastosManuales.map(x=>fila(fecha(x.fecha),lugar(x),empresa(x),x.tipo,x.categoria,
   x.proveedor||x.concepto,x.estado,seguro(x.monto),x.referencia)),
  ...comprasOperativas.map(x=>fila(fecha(x.fecha),lugar(x),empresa(x),'Factura asignada',x.categoria,
   x.proveedor,x.estado,seguro(x.monto),x.referencia)),
  ...incluidos.flatMap(c=>[
   ...(seguro(c.gastos_cierre)?[fila(fecha(c.fecha),'Uki Sushi · '+c.branch,'Cierre','Gastos cierre',
    'Sin desglose','Cierre', 'Registrado',seguro(c.gastos_cierre),c.turno_ref)]:[]),
   ...(seguro(c.delivery_por_pagar)?[fila(fecha(c.fecha),'Uki Sushi · '+c.branch,'Cierre','Delivery cierre',
    'Repartos','Cierre','Revisar pago',seguro(c.delivery_por_pagar),c.turno_ref)]:[])
  ])
 ].sort(orden);
 const compras=facturas.map(x=>fila(fecha(x.fecha),lugar(x),empresa(x),x.proveedor,
  x.referencia,x.estado,seguro(x.total_factura),seguro(x.monto),
  x.categoria,x.datos?.vence||'')).sort(orden);
 const pendientes=data.pendientes.map(x=>fila(fecha(x.fecha),lugar(x),empresa(x),
  x.proveedor||'',x.concepto||'',x.referencia||'',x.datos?.vence||'',
  seguro(x.monto),x.tipo||'Factura')).sort(orden);
 const rowsCapital=[
  ...capital.map(x=>fila(fecha(x.fecha),lugar(x),empresa(x),patrimonio(x)?'Inversión':x.tipo,
   x.categoria||'',x.concepto||'',x.estado,seguro(x.monto),x.referencia)),
  ...inversionesFacturas.map(x=>fila(fecha(x.fecha),lugar(x),empresa(x),'Inversión factura',
   x.categoria||'',x.proveedor,x.estado,seguro(x.monto),x.referencia))
 ].sort(orden);
 const rowsCierres=cierres.map(c=>fila(fecha(c.fecha),c.branch==='arica'?'Regimiento Arica':'La Serena',
  c.turno_ref,seguro(c.venta_total),seguro(c.pedidos),
  seguro(c.gastos_cierre),seguro(c.delivery_por_pagar),
  seguro(c.propinas),seguro(c.retiros),c.conciliado?'Coincidencia manual; excluido':'Incluido')).sort(orden);
 const medios=new Map();
 const sumarMedios=c=>{
  for(const [m,v] of Object.entries(c.medios||{}))if(seguro(v))medios.set(m,(medios.get(m)||0)+seguro(v));
 };
 manuales.forEach(sumarMedios);incluidos.forEach(sumarMedios);
 const hojas=[
  hoja('Resumen',header,resumen),
  hoja('Ventas',['Fecha','Local','Razón social','Origen','Referencia','Concepto','Monto CLP','Medios de pago'],ventas),
  hoja('Gastos',['Fecha','Local','Razón social','Tipo','Categoría','Proveedor o concepto','Estado','Monto CLP','Referencia'],rowsGastos),
  hoja('Compras',['Fecha','Local asignado','Razón social','Proveedor','Factura','Estado','Total original CLP','Importe asignado CLP','Categoría','Vencimiento'],compras),
  hoja('Por pagar',['Fecha','Local','Razón social','Proveedor','Concepto','Referencia','Vence','Importe CLP','Tipo'],pendientes),
  hoja('Inversiones y retiros',['Fecha','Local','Razón social','Tipo','Categoría','Concepto','Estado','Monto CLP','Referencia'],rowsCapital),
  hoja('Cierres Uki',['Fecha','Sucursal','Referencia','Ventas CLP','Pedidos','Gastos cierre CLP','Delivery cierre CLP','Propinas CLP','Retiros CLP','Conciliación'],rowsCierres),
  hoja('Medios de pago',['Medio','Ventas registradas CLP'],[...medios].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>fila(...x)))
 ];
 const nombre='Mi-Administracion_'+data.desde+'_'+data.hasta;
 const mensaje=[
  '*Mi Administración · Resumen privado*',
  'Período: '+data.desde+' al '+data.hasta,
  'Ventas (manuales + cierres): '+pesos(venta),
  'Gastos y compras pagados: '+pesos(gastosPagados),
  'Gastos/delivery de cierres: '+pesos(gastosCierre),
  'Resultado de control: '+pesos(control),
  'Por pagar (todas las fechas): '+pesos(pendiente),
  'Inversiones pagadas: '+pesos(inversiones),
  'Retiros pagados: '+pesos(retiros),
  'Ingresos extraordinarios: '+pesos(ingresosExtra),
  'Nota: resultado de control, no utilidad contable. Verificar coincidencias con facturas.'
 ].join('\n');
 return {hojas,totales,nota,nombre,mensaje,desde:data.desde,hasta:data.hasta};
}
const escapeXML=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const colId=n=>{let name='';for(n++;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name};
function xmlHoja(sheet){
 const rows=[sheet.columnas,...sheet.filas];
 const xmlRows=rows.map((r,i)=>{
  const cells=r.map((v,j)=>{
   const addr=colId(j)+(i+1),sty=i===0?' s="1"':typeof v==='number'?' s="2"':'';
   return typeof v==='number'&&Number.isFinite(v)?
    '<c r="'+addr+'"'+sty+'><v>'+v+'</v></c>':
    '<c r="'+addr+'" t="inlineStr"'+sty+'><is><t>'+escapeXML(v)+'</t></is></c>';
  }).join('');
  return '<row r="'+(i+1)+'"'+(i===0?' ht="26" customHeight="1"':'')+'>'+cells+'</row>';
 }).join('');
 const widths=sheet.columnas.map((x,j)=>'<col min="'+(j+1)+'" max="'+(j+1)+
  '" width="'+Math.min(38,Math.max(15,String(x).length+5))+'" customWidth="1"/>').join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  '<dimension ref="A1:'+colId(sheet.columnas.length-1)+rows.length+'"/>'+
  '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+
  '<cols>'+widths+'</cols><sheetData>'+xmlRows+'</sheetData>'+
  '<autoFilter ref="A1:'+colId(sheet.columnas.length-1)+rows.length+'"/>'+
  '</worksheet>';
}
function crc32(bytes){
 let crc=-1;
 for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
 return (crc^-1)>>>0;
}
function zip(files){
 const enc=new TextEncoder(),parts=[],directory=[];
 let offset=0;
 const u16=x=>[x&255,(x>>>8)&255],u32=x=>[x&255,(x>>>8)&255,(x>>>16)&255,(x>>>24)&255];
 const add=a=>{const u=Uint8Array.from(a);parts.push(u);offset+=u.length};
 for(const [name,source] of files){
  const nameBytes=enc.encode(name),payload=enc.encode(source),sum=crc32(payload),start=offset;
  add([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),
   ...u32(sum),...u32(payload.length),...u32(payload.length),...u16(nameBytes.length),...u16(0)]);
  add(nameBytes);add(payload);
  directory.push([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),
   ...u16(0),...u16(0),...u32(sum),...u32(payload.length),...u32(payload.length),
   ...u16(nameBytes.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(start),...nameBytes]);
 }
 const begin=offset;
 for(const record of directory)add(record);
 const directorySize=offset-begin;
 add([...u32(0x06054b50),...u16(0),...u16(0),...u16(directory.length),
  ...u16(directory.length),...u32(directorySize),...u32(begin),...u16(0)]);
 const output=new Uint8Array(offset);let at=0;
 for(const part of parts){output.set(part,at);at+=part.length}
 return output;
}
export function generarXLSX(informe){
 const sheets=informe.hojas;
 const content='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
  '<Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
  sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
 const relRoot='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const book='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
  '<sheets>'+sheets.map((s,i)=>'<sheet name="'+escapeXML(s.nombre.slice(0,31))+
   '" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>';
 const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
  '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0;[Red](&quot;$&quot;#,##0)"/></numFmts>'+
  '<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>'+
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF8C4B1F"/><bgColor indexed="64"/></patternFill></fill></fills>'+
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
  '<xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'+
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'+
  '</styleSheet>';
 const files=[['[Content_Types].xml',content],['_rels/.rels',relRoot],
  ['xl/workbook.xml',book],['xl/_rels/workbook.xml.rels',rels],['xl/styles.xml',styles],
  ...sheets.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',xmlHoja(s)])];
 return new Blob([zip(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function textPdf(s){return String(s??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-')
 .replace(/[^\x20-\xFF]/g,'?').replace(/([\\()])/g,'\\$1');}
function pdfBytes(binary){return Uint8Array.from(binary,x=>x.charCodeAt(0)&255);}
export function generarPDF(informe){
 const paginas=[];let lineas=[],y=787;
 const nuevo=()=>{if(lineas.length)paginas.push(lineas);lineas=[];y=789;
  lineas.push('BT /F2 15 Tf 45 807 Td (MI ADMINISTRACION - INFORME PRIVADO) Tj ET');
  lineas.push('BT /F1 9 Tf 45 793 Td ('+textPdf(informe.desde+' a '+informe.hasta)+') Tj ET');
 };
 const escribir=(str,titulo=false)=>{
  if(y<55)nuevo();
  const safe=textPdf(str).slice(0,113);
  lineas.push('BT /'+(titulo?'F2':'F1')+' '+(titulo?'11':'8')+' Tf 45 '+y+
   ' Td ('+safe+') Tj ET');
  y-=titulo?22:15;
 };
 nuevo();
 for(const sheet of informe.hojas){
  if(y<85)nuevo();
  escribir(sheet.nombre.toUpperCase()+' ('+sheet.filas.length+' registros)',true);
  for(const item of sheet.filas){
   const values=item.map((v,i)=>typeof v==='number'?pesos(v):String(v??''));
   const record=values.join('  |  ');
   for(let i=0;i<record.length;i+=108)escribir(record.slice(i,i+108));
  }
  y-=7;
 }
 if(lineas.length)paginas.push(lineas);
 const objs=[''];const add=str=>{objs.push(str);return objs.length-1};
 const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const pagesId=add('');
 const ids=[];
 for(let i=0;i<paginas.length;i++){
  const body=paginas[i].join('\n')+'\nBT /F1 8 Tf 45 35 Td (Pagina '+(i+1)+' / '+paginas.length+') Tj ET';
  const stream=add('<< /Length '+body.length+' >>\nstream\n'+body+'\nendstream');
  const page=add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] '+
   '/Resources << /Font << /F1 '+font+' 0 R /F2 '+bold+' 0 R >> >> /Contents '+stream+' 0 R >>');
  ids.push(page);
 }
 objs[pagesId]='<< /Type /Pages /Kids ['+ids.map(i=>i+' 0 R').join(' ')+'] /Count '+ids.length+' >>';
 const root=add('<< /Type /Catalog /Pages '+pagesId+' 0 R >>');
 let output='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[0];
 for(let i=1;i<objs.length;i++){
  offsets[i]=output.length;output+=i+' 0 obj\n'+objs[i]+'\nendobj\n';
 }
 const xref=output.length;
 output+='xref\n0 '+objs.length+'\n0000000000 65535 f \n';
 for(let i=1;i<objs.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 output+='trailer\n<< /Size '+objs.length+' /Root '+root+' 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 return new Blob([pdfBytes(output)],{type:'application/pdf'});
}
export function compartirWhatsApp(informe){
 const url='https://api.whatsapp.com/send?text='+encodeURIComponent(informe.mensaje);
 window.open(url,'_blank','noopener,noreferrer');
}
