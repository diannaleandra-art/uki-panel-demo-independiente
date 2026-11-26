'use strict';
// Read-only: physical outflow is not a certified loss. No assumption of full sales coverage.
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
const units={kg:['g',1000],g:['g',1],l:['ml',1000],ml:['ml',1],un:['un',1],porciones:['porciones',1]};
function convert(q,from,to){return finite(q)&&units[from]&&units[to]&&units[from][0]===units[to][0]?Number(q)*units[from][1]/units[to][1]:null;}
function physicalRows(open,close,moves,prices){
 const prev=new Map(open.map(x=>[x.sku,x]));
 return close.map(c=>{
  const p=prev.get(c.sku), unit=c.unit, relevant=moves.filter(m=>m.sku===c.sku);
  const amounts=relevant.filter(m=>m.action==='entrada').map(m=>convert(m.quantity,m.unit,unit));
  const received=amounts.some(v=>v===null)?null:amounts.reduce((a,b)=>a+b,0);
  const last=relevant.at(-1);
  const verified=!!p&&p.counted===true&&c.counted===true&&p.unit===unit&&finite(p.quantity)&&finite(c.quantity)&&received!==null&&last?.action==='conteo'&&last.unit===unit&&Number(last.after)===Number(c.quantity)&&!relevant.some(m=>!['entrada','conteo','disponibilidad','disponibilidad_carta','vincular_carta','desvincular_carta'].includes(m.action));
  const price=prices.find(x=>x.sku===c.sku), priceQuantity=price?convert(price.quantity,price.unit,unit):null;
  const outflow=verified?Number(p.quantity)+received-Number(c.quantity):null;
  return {sku:c.sku,name:c.name||p?.name||c.sku,unit,opening:p&&finite(p.quantity)?Number(p.quantity):null,received,closing:finite(c.quantity)?Number(c.quantity):null,outflow,unitCost:priceQuantity>0&&finite(price.price)?Number(price.price)/priceQuantity:null,status:!verified?'pending':outflow<0?'review':'provisional'};
 });
}
function ukiItems(r){return (Array.isArray(r.items)?r.items:[]).map(i=>({sku:i.sku,name:i.name,unit:i.stock_unit,quantity:i.stock_qty,counted:r.summary?.conteos_verificados===true&&i.conteo_registrado===true}));}
async function readPhysical(db,store){
 const prices=await db.query('SELECT sku,unit,quantity,price FROM public.costeo_precios_v1 WHERE store_id=$1',[store]);
 let start,end,open,close,moves;
 if(store==='romo:serena'){
  const rs=await db.query('SELECT contenido FROM public.romo_inventario_v1 WHERE store_id=$1',[store]);
  const state=rs[0]?.contenido, history=state?.movimientos;
  if(!Array.isArray(history))return {ok:true,store,available:false,reason:'Sin historial de inventario.'};
  const indexes=history.flatMap((m,i)=>m.tipo==='revision'?[i]:[]);
  if(indexes.length<2)return {ok:true,store,available:false,reason:'Se necesitan dos revisiones físicas consecutivas.'};
  const a=indexes.at(-2),b=indexes.at(-1),first=history[a],last=history[b];
  if(!Array.isArray(first.evidence)||!Array.isArray(last.evidence))return {ok:true,store,available:false,reason:'Las revisiones anteriores no contienen evidencia suficiente. Se requieren dos nuevos cierres.'};
  start=new Date(first.fechaMs).toISOString();end=new Date(last.fechaMs).toISOString();
  const names=new Map((state.items||[]).map(i=>[i.sku,i.name]));
  const adapt=m=>m.evidence.map(i=>({...i,name:names.get(i.sku),counted:m.resumen?.conteos_verificados===true&&i.conteo_registrado===true}));
  open=adapt(first);close=adapt(last);
  moves=history.slice(a+1,b).map(m=>({sku:m.sku,action:m.tipo,unit:m.despues?.stock_unit,after:m.despues?.stock_qty,quantity:m.tipo==='entrada'&&finite(m.antes?.stock_qty)&&finite(m.despues?.stock_qty)&&m.antes.stock_unit===m.despues.stock_unit?Number(m.despues.stock_qty)-Number(m.antes.stock_qty):null}));
 }else if(['uki:arica','uki:serena'].includes(store)){
  const branch=store.split(':')[1];
  const rs=await db.query('SELECT id,items,summary,created_at FROM public.uki_inventario_revisiones_live WHERE branch=$1 ORDER BY created_at DESC,id DESC LIMIT 2',[branch]);
  if(rs.length!==2)return {ok:true,store,available:false,reason:'Se necesitan dos revisiones físicas consecutivas.'};
  start=new Date(rs[1].created_at).toISOString();end=new Date(rs[0].created_at).toISOString();
  open=ukiItems(rs[1]);close=ukiItems(rs[0]);
  const args=[branch,start,end];
  moves=await db.query("SELECT sku,accion AS action,cantidad_base AS quantity,unidad_base AS unit,cantidad_nueva AS after,creado_en AS at FROM public.uki_inventario_movimientos_live WHERE branch=$1 AND creado_en>$2::timestamptz AND creado_en<=$3::timestamptz UNION ALL SELECT sku,action,quantity,unidad_base AS unit,stock_after AS after,created_at AS at FROM public.uki_inventario_extras_movimientos_live WHERE branch=$1 AND created_at>$2::timestamptz AND created_at<=$3::timestamptz ORDER BY at",args);
 }else throw Error('Sucursal no autorizada');
 if(Date.parse(start)>=Date.parse(end))return {ok:true,store,available:false,reason:'Intervalo de revisión inválido.'};
 return {ok:true,store,available:true,start,end,rows:physicalRows(open,close,moves,prices),readOnly:true,coverageComplete:false,warning:'Salida neta provisional. No acredita pérdidas: pueden existir ajustes, mermas, traspasos o ventas sin detalle.'};
}
module.exports={readPhysical,physicalRows};
