/* Romo QA · historial leído desde Neon Romo, nunca desde inventario Uki.
 * El stock histórico se reconstruye SOLO si todos los cambios posteriores
 * conservan su valor anterior. Una operación sin "antes" bloquea la consulta.
 */
const STORE='romo:serena';
const permitido=new Set(['articulos','historial','revision']);
const tipoConSnapshot=new Set(['alta','editar','editar_completo','archivar','conteo',
 'entrada','disponibilidad','vincular_carta','desvincular_carta',
 'disponibilidad_carta']);
const need=(v,msg)=>{if(!v)throw Error(msg)};
const clone=x=>JSON.parse(JSON.stringify(x));
// JSONB reordena propiedades; comparar contenido, no el orden de claves.
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const fechaChile=ms=>{
 const d=new Date(ms);need(Number.isFinite(d.getTime()),'Fecha de revisión inválida');
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Santiago',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const part=k=>p.find(x=>x.type===k)?.value||'';
 return part('year')+'-'+part('month')+'-'+part('day');
};
const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().trim();
const descripcion=m=>({
 id:'romo-revision-'+m.fechaMs+'-'+m._indice,
 branch:'romo',created_at:new Date(m.fechaMs).toISOString(),
 worker_name:typeof m.worker_name==='string'&&m.worker_name.trim()?
  m.worker_name.trim():'Nombre no registrado en esa revisión',
 summary:{contados:Number(m.resumen?.contados)||0,
  entradas_periodo:Number(m.resumen?.entradas)||0},
});
function validarFuente(source){
 need(source?.ok===true&&source.storeId===STORE,
  'Esta consulta solo admite inventario certificado de Romo');
 const c=source.contenido;
 need(c?.version===1&&Array.isArray(c.items)&&Array.isArray(c.movimientos)&&
  c.items.length<=1500&&c.movimientos.length<=3000,
  'Inventario Romo no está disponible para historial');
 return c;
}
function revisiones(c){
 return c.movimientos.map((m,i)=>({...m,_indice:i}))
  .filter(m=>m.tipo==='revision'&&Number.isSafeInteger(m.fechaMs)&&m.fechaMs>1700000000000)
  .reverse();
}
function retroceder(state,m){
 if(m.tipo==='revision')return;
 need(tipoConSnapshot.has(m.tipo),
  'Historial anterior no reconstruible: contiene cambios sin detalle histórico');
 need(typeof m.sku==='string'&&m.sku.length>=4,
  'Movimiento histórico sin artículo válido');
 need(m.despues&&typeof m.despues==='object'&&
  equal(state.get(m.sku),m.despues),
  'El historial de Romo no coincide con la existencia posterior registrada');
 if(m.antes===null&&m.tipo==='alta'){
  state.delete(m.sku);return;
 }
 need(m.antes&&typeof m.antes==='object'&&!Array.isArray(m.antes)&&
  m.antes.sku===m.sku,
  'El historial no conserva existencias anteriores para esta revisión');
 state.set(m.sku,clone(m.antes));
}
export function consultarRomoInventarioHistoricoQA(source,{
 action,payload={}
}={}){
 need(permitido.has(action),'Consulta de inventario Romo no autorizada');
 const c=validarFuente(source);
 if(action==='articulos')return {
  ok:true,branch:'romo',
  items:c.items.filter(it=>it?.archived!==true).map(clone)
 };
 const lista=revisiones(c);
 if(action==='historial'){
  const offset=Number(payload.offset||0);
  need(Number.isSafeInteger(offset)&&offset>=0&&offset<=3000,
   'Página de inventario inválida');
  const desde=String(payload.desde||'').trim(),hasta=String(payload.hasta||'').trim();
  need((!desde||/^\d{4}-\d{2}-\d{2}$/.test(desde))&&
       (!hasta||/^\d{4}-\d{2}-\d{2}$/.test(hasta)),
       'Filtro de fechas inválido');
  const trabajador=normal(payload.trabajador);
  const filtradas=lista.filter(m=>{
   const dia=fechaChile(m.fechaMs);
   if((desde&&dia<desde)||(hasta&&dia>hasta))return false;
   return !trabajador||normal(descripcion(m).worker_name).includes(trabajador);
  });
  return {ok:true,branch:'romo',total:filtradas.length,
   revisiones:filtradas.slice(offset,offset+25).map(descripcion)};
 }
 const id=String(payload.id||'');
 need(/^romo-revision-\d{13}-\d{1,4}$/.test(id),
  'Identificador histórico de Romo inválido');
 const objetivo=lista.find(m=>descripcion(m).id===id);
 need(objetivo,'La revisión ya no está en el historial disponible de Romo');
 const estado=new Map(c.items.map(it=>[it.sku,clone(it)]));
 // El resultado representa el stock tras FINALIZAR esa revisión;
 // no se usan existencias actuales para describir revisiones anteriores.
 for(let j=c.movimientos.length-1;j>objetivo._indice;j--)retroceder(estado,c.movimientos[j]);
 return {ok:true,branch:'romo',revision:{
  ...descripcion(objetivo),
  items:[...estado.values()].filter(it=>it.archived!==true)
   .sort((a,b)=>a.name.localeCompare(b.name,'es'))
   .map(it=>({...it,received_qty:null}))
 }};
}
