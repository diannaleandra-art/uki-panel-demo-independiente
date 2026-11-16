/**
 * Romo La Serena: exportaciones de SOLO LECTURA sobre cierres definitivos.
 * CSV Excel-compatible y HTML imprimible para Guardar como PDF en iPhone.
 * No accede a Uki, a la red ni a la base de datos; no genera cierres.
 */
const SUC='Romo’s Sushi La Serena';
const METHODS=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const check=(p,m)=>{if(!p)throw Error(m)};
const day=v=>{
 const d=String(v||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;
 const parsed=new Date(d+'T12:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===d;
};
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const csvText=v=>{
 let s=String(v??'').replace(/[\r\n\x00-\x1f]+/g,' ').slice(0,250);
 if(/^\s*[=+@-]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
const amount=(v,name,{optional=false,signed=false}={})=>{
 if(optional&&(v===undefined||v===null||v===''))return null;
 check(Number.isSafeInteger(v)&&Math.abs(v)<=1000000000&&
  (signed||v>=0),'Importe inválido de '+name);
 return v;
};
const renderAmount=v=>v===null?'Sin dato':new Intl.NumberFormat('es-CL',{
 style:'currency',currency:'CLP',maximumFractionDigits:0
}).format(v);
function readClose(c){
 check(c&&c.suc===SUC,'Cierre de otra sucursal');
 check(day(c.fechaOperativa),'Fecha operativa sin confirmar');
 check(typeof c.turnoClave==='string'&&
  /^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(c.turnoClave)&&
  c.turnoClave.startsWith(c.fechaOperativa+'@'),
  'Falta la identidad original del turno');
 const m={};
 check(c.medios&&typeof c.medios==='object'&&!Array.isArray(c.medios),
  'No hay desglose de medios confirmado');
 check(Object.keys(c.medios).every(k=>METHODS.includes(k)),
  'El cierre tiene un medio no reconocido');
 for(const method of METHODS)m[method]=amount(c.medios[method]??0,'medio '+method);
 const venta=amount(c.venta,'venta del cierre');
 check(METHODS.reduce((n,k)=>n+m[k],0)===venta,
  'Los medios de pago no cuadran con la venta registrada');
 return {
  suc:SUC,fecha:c.fechaOperativa,turno:c.turnoClave,fechaMs:c.fechaMs,
  cerradoEn:String(c.fechaISO||'').slice(0,32),
  responsable:String(c.resp||'').slice(0,80),
  pedidos:amount(c.pedidos,'pedidos'),
  venta,medios:m,
  ventaSinDelivery:amount(c.ventaSinDelivery,'venta sin delivery',{optional:true}),
  gastos:amount(c.gastos,'gastos',{optional:true}),
  repartidor:amount(c.pagadoDelivery,'repartidor',{optional:true}),
  propinas:amount(c.propinas,'propinas',{optional:true}),
  retiros:amount(c.retiros,'retiros',{optional:true}),
  efectivoEsperado:amount(c.efectivo,'efectivo esperado',{optional:true,signed:true}),
  efectivoContado:amount(c.efectivoContado,'efectivo contado',{optional:true}),
  diferencia:amount(c.diferenciaEfectivo,'diferencia',{optional:true,signed:true}),
  resultado:amount(c.final,'resultado',{optional:true,signed:true})
 };
}
function notasCierre(ajustes,c){
 check(Array.isArray(ajustes)&&ajustes.length<=30000,
  'Historial de aclaraciones inválido');
 const todos=ajustes.filter(a=>a?.tipo==='cierre_aclarado');
 check(todos.every(a=>a.suc===SUC&&typeof a.turnoClave==='string'&&
  /^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(a.turnoClave)&&
  Number.isSafeInteger(a.cierreMs)&&Number.isSafeInteger(a.registradoEn)&&
  a.registradoEn>=a.cierreMs&&
  ['dato','correcto','responsable','motivo'].every(k=>
   typeof a[k]==='string'&&a[k].trim().length>0&&a[k].length<=
   ({dato:100,correcto:200,responsable:100,motivo:300}[k]))),
  'Una aclaración del historial requiere revisión');
 return todos.filter(a=>a.turnoClave===c.turno&&a.cierreMs===c.fechaMs)
  .sort((a,b)=>a.registradoEn-b.registradoEn);
}
const textoNota=a=>a.dato+' → '+a.correcto+' · '+a.responsable+
 ' · '+a.motivo+' · '+new Date(a.registradoEn).toLocaleString('es-CL');
const HEADERS=['Sucursal','Día operativo','Turno original','Fecha de cierre','Responsable',
 'Pedidos','Venta total CLP',...METHODS.map(x=>x+' CLP'),
 'Venta sin delivery CLP','Gastos CLP','Pago repartidor CLP',
 'Propinas CLP','Retiros CLP','Efectivo esperado CLP',
 'Efectivo contado CLP','Diferencia CLP','Resultado CLP'];
function vals(x){
 return [x.suc,x.fecha,x.turno,x.cerradoEn,x.responsable,
  x.pedidos,x.venta,...METHODS.map(k=>x.medios[k]),
  x.ventaSinDelivery,x.gastos,x.repartidor,x.propinas,x.retiros,
  x.efectivoEsperado,x.efectivoContado,x.diferencia,x.resultado];
}
function cell(value){
 if(value===null||value===undefined)return '';
 return typeof value==='number'?String(value):csvText(value);
}
export function crearMensajeCierreRomoQA({cierres,turnoId,revision,ajustesHistoricos=[]}={}){
 check(Array.isArray(cierres)&&cierres.length<=30000,
  'Historial de Romo no disponible');
 check(Number.isSafeInteger(revision)&&revision>=1,'Revisión de Neon no confirmada');
 check(typeof turnoId==='string'&&/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(turnoId),
  'Falta identificar el turno confirmado');
 const reads=cierres.map(readClose);
 check(reads.length===new Set(reads.map(c=>c.turno)).size,
  'Hay cierres duplicados; requiere conciliación');
 const x=reads.find(c=>c.turno===turnoId);
 check(!!x,'El cierre indicado no existe en esta sucursal');
 const notas=notasCierre(ajustesHistoricos,x);
 const paid=METHODS.filter(k=>x.medios[k]>0).map(k=>
  '• '+k+': '+renderAmount(x.medios[k]));
 return [
  '🍣 *ROMO’S SUSHI · CIERRE DEFINITIVO*',
  '*Sucursal:* La Serena',
  '*Día operativo:* '+x.fecha,
  '*Turno:* '+x.turno,
  '*Responsable:* '+(x.responsable||'Sin indicar'),
  '*Pedidos:* '+x.pedidos,
  '*Venta cobrada:* '+renderAmount(x.venta),
  '*MEDIOS DE PAGO*',...(paid.length?paid:['Sin cobros por medio']),
  '*Venta sin delivery:* '+renderAmount(x.ventaSinDelivery),
  '*Gastos:* '+renderAmount(x.gastos),
  '*Pago repartidor:* '+renderAmount(x.repartidor),
  '*Propinas registradas:* '+renderAmount(x.propinas),
  '*Retiros:* '+renderAmount(x.retiros),
  '*Efectivo esperado:* '+renderAmount(x.efectivoEsperado),
  '*Efectivo contado:* '+renderAmount(x.efectivoContado),
  '*Diferencia:* '+renderAmount(x.diferencia),
  '*Resultado del cierre:* '+renderAmount(x.resultado),
  ...(notas.length?['*ACLARACIONES POSTERIORES · SIN CAMBIAR IMPORTES*',
   ...notas.map((n,i)=>(i+1)+'. '+textoNota(n).replace(/[\r\n*_]+/g,' '))]:[]),
  'Confirmado en el estado cifrado Romo, revisión '+revision+'.',
  'Pendiente de conciliación en Mi Administración.'
 ].join('\n');
}
export function crearReporteCierresRomoQA({cierres,desde='',hasta='',revision,turnosPermitidos=null,ajustesHistoricos=[]}={}){
 check(Array.isArray(cierres)&&cierres.length<=30000,
  'El historial no está disponible');
 check((!desde||day(desde))&&(!hasta||day(hasta))&&
  (!desde||!hasta||desde<=hasta),'Fechas del reporte inválidas');
 check(Number.isSafeInteger(revision)&&revision>=1,
  'Primero confirma la lectura cifrada de Neon Romo');
 // Detectar duplicados globales antes de filtrar una semana.
 const read=cierres.map(readClose),ids=new Set();
 for(const x of read){
  check(!ids.has(x.turno),'Hay dos cierres del mismo turno; concilia antes de exportar');
  ids.add(x.turno);
 }
 check(turnosPermitidos===null||Array.isArray(turnosPermitidos)&&
  turnosPermitidos.length<=read.length&&
  turnosPermitidos.every(x=>typeof x==='string'&&
   /^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(x))&&
  new Set(turnosPermitidos).size===turnosPermitidos.length,
  'Filtro de turnos inválido');
 const permitidos=turnosPermitidos===null?null:new Set(turnosPermitidos);
 const filtered=read.filter(x=>(!desde||x.fecha>=desde)&&(!hasta||x.fecha<=hasta)&&
  (permitidos===null||permitidos.has(x.turno)))
  .sort((a,b)=>b.turno.localeCompare(a.turno));
 check(filtered.length>0,'Todavía no hay cierres definitivos para este período');
 const csv='\uFEFF'+[[...HEADERS,'Aclaraciones posteriores'].map(csvText).join(';'),
  ...filtered.map(x=>[...vals(x),notasCierre(ajustesHistoricos,x)
   .map(textoNota).join(' | ')].map(cell).join(';'))].join('\r\n');
 const title=desde&&hasta?'Reporte de cierres · '+desde+' al '+hasta:'Historial de cierres';
 const filename='romo-serena-cierres-'+(desde&&hasta?desde+'-a-'+hasta:'historial')+
  '-revision-'+revision;
 const table='<table><thead><tr><th>Fecha / turno</th><th>Venta</th>'+
  '<th>Gastos</th><th>Repartidor</th><th>Contado</th><th>Diferencia</th></tr></thead><tbody>'+
  filtered.map(x=>'<tr><td>'+escapeHtml(x.fecha)+
   '<small>'+escapeHtml(x.turno)+'</small></td>'+
   [x.venta,x.gastos,x.repartidor,x.efectivoContado,x.diferencia].map(n=>
    '<td>'+escapeHtml(renderAmount(n))+'</td>').join('')+'</tr>').join('')+
  '</tbody></table>';
 const html='<!doctype html><html lang="es"><head><meta charset="UTF-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>'+escapeHtml(title)+' · Romo</title>'+
  '<style>body{font-family:system-ui,Arial,sans-serif;color:#181818;padding:18px;'+
   'max-width:1050px;margin:auto}h1{font-size:23px;margin-bottom:4px}'+
   'p{font-size:13px}table{width:100%;border-collapse:collapse;font-size:11px}'+
   'th,td{border-bottom:1px solid #bbb;padding:8px 4px;text-align:right}'+
   'th:first-child,td:first-child{text-align:left}small{display:block;'+
   'color:#555;overflow-wrap:anywhere}button{padding:12px;border:1px solid #222;'+
   'border-radius:8px;background:#fff}'+
   '@media print{button{display:none}body{padding:0}'+
   '@page{size:A4 landscape;margin:12mm}}</style></head><body>'+
  '<button type="button" onclick="window.print()">Imprimir / Guardar como PDF</button>'+
  '<h1>ROMO’S SUSHI · La Serena</h1><h2>'+escapeHtml(title)+'</h2>'+
  '<p>Documento de consulta: '+filtered.length+' cierre(s) definitivo(s).'+
   ' Estado cifrado Neon Romo, revisión '+revision+'.</p>'+
  '<p>Este documento no acredita sincronización con Mi Administración. '+
   'No incluye pedidos pendientes ni precierres.</p>'+
  table+'<h3>Aclaraciones posteriores (importes del cierre sin cambios)</h3>'+
  (filtered.map(x=>{const notas=notasCierre(ajustesHistoricos,x);
   return notas.length?'<h4>'+escapeHtml(x.fecha+' · '+x.turno)+'</h4><ul>'+
    notas.map(n=>'<li>'+escapeHtml(textoNota(n))+'</li>').join('')+'</ul>':'';
  }).join('')||'<p>Sin aclaraciones posteriores.</p>')+'</body></html>';
 return Object.freeze({csv,html,filename,cantidad:filtered.length});
}
