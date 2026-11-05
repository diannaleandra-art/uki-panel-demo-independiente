// Uki Sushi: cálculo local de reposición, sin datos de caja o cierres.
const SUCURSALES={arica:'Regimiento Arica',serena:'La Serena'};
export function faltantesInventario(items){
 const rows=Array.isArray(items)?items:[];
 const configurados=rows.filter(i=>Number.isFinite(Number(i?.min_stock_qty))&&Number(i.min_stock_qty)>0);
 const pendientes=configurados.map(i=>{
  const min=Number(i.min_stock_qty),actual=Number(i.stock_qty)||0;
  const falta=Math.round(Math.max(0,min-actual)*100)/100;
  return {sku:String(i.sku),nombre:String(i.name),falta,actual,min,
   unidad:String(i.stock_unit||'un'),disponible:i.available===true};
 }).filter(i=>i.falta>0).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
 return {pendientes,total:rows.length,configurados:configurados.length,
  sinMinimo:rows.length-configurados.length};
}
export function textoListaReposicion({branch,items,nombre,fecha=new Date()}){
 if(!Object.hasOwn(SUCURSALES,branch))throw Error('Sucursal no válida.');
 const responsable=String(nombre||'').trim().replace(/\s+/g,' ');
 if(responsable.length<2||responsable.length>60)throw Error('Indica quién realizó la revisión.');
 const r=faltantesInventario(items);
 const fechaLocal=new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',
  day:'2-digit',month:'2-digit',year:'numeric'}).format(fecha);
 const lines=['📦 UKI SUSHI · LISTA PARA REPONER',
  'Sucursal: '+SUCURSALES[branch], 'Revisión: '+fechaLocal,
  'Responsable: '+responsable,''];
 if(r.configurados===0)lines.push('No hay mínimos configurados. Administración debe establecerlos.');
 else if(!r.pendientes.length)lines.push('Sin faltantes según los mínimos configurados.');
 else r.pendientes.forEach((p,i)=>lines.push(
  (i+1)+'. '+p.nombre+' · llevar '+p.falta+' '+p.unidad+
  ' (hay '+p.actual+'; mínimo '+p.min+')'));
 if(r.sinMinimo)lines.push('','Sin mínimo configurado: '+r.sinMinimo+' artículos; no se puede calcular su reposición.');
 lines.push('','La disponibilidad en la carta se marca manualmente. Esto NO es un cierre de caja.');
 return lines.join('\n');
}
