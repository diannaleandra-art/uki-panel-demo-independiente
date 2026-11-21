// Romo: solo constancias verificadas. Nunca crear movimientos contables.
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const integer=n=>Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<=1000000000;
const isRomo=b=>/\bromo(?:s|[’']s)?\b/i.test(norm(b?.nombre));
export function identificarRomo(negocios,sucursales){
 const biz=negocios.filter(isRomo);if(biz.length!==1)return null;
 const branch=sucursales.filter(s=>String(s.negocio_id)===String(biz[0].id)&&/serena/.test(norm(s.nombre)));
 return branch.length===1?{biz:biz[0],branch:branch[0]}:null;
}
export function alcanceRomo(map,biz,branch,reason){
 return !!map&&(!reason||reason==='todos')&&(!biz||String(biz)===String(map.biz.id))&&(!branch||String(branch)===String(map.branch.id));
}
export function conciliarRomo(rows,manuales,{desde,hasta,map,completo=false}={}){
 if(!Array.isArray(rows)||!Array.isArray(manuales))throw Error('Fuentes de conciliación incompletas');
 const seen=new Set(),admitidos=[],pendientes=[];
 for(const c of rows){
  if(!c||c.source_key!=='romo:serena|'+c.turno_ref||typeof c.turno_ref!=='string'||!/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(c.turno_ref)||seen.has(c.source_key)||typeof c.fecha_operativa!=='string'||c.fecha_operativa<desde||c.fecha_operativa>hasta||!integer(c.venta_total)||!integer(c.gastos_cierre)||!integer(c.delivery_por_pagar)||!integer(c.pedidos)||!integer(c.propinas)||!c.medios||typeof c.medios!=='object'||Array.isArray(c.medios)||Object.values(c.medios).some(v=>!integer(v))||Object.values(c.medios).reduce((n,v)=>n+Number(v),0)!==Number(c.venta_total))throw Error('Constancia Romo inválida o duplicada');
  seen.add(c.source_key);
  // Una venta manual del mismo negocio/fecha, incluso sin folio, requiere revisión.
  const overlap=manuales.some(m=>m?.tipo==='venta'&&m.estado!=='anulado'&&(String(m.fecha).slice(0,10)===c.fecha_operativa||[c.source_key,c.turno_ref].includes(String(m.referencia||'').trim())));
  if(!map||!completo||overlap){pendientes.push({...c,motivo:!map?'Negocio y sucursal sin identificar':!completo?'Consulta manual incompleta':'Venta manual del mismo día o referencia'});continue;}
  admitidos.push({...c,branch:'romo',fecha:c.fecha_operativa,turno_ref:c.source_key,ref:c.source_key,marca:'romo',gastos_documentados:Number(c.gastos_cierre),delivery_pendiente:Number(c.delivery_por_pagar),gastos_cierre:0,delivery_por_pagar:0,retiros:0});
 }
 return {admitidos,pendientes};
}
