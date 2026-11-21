/* Exportación Excel XLSX de solo lectura para archivo mensual Uki. Mismo generador de Mi Administración. */
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
