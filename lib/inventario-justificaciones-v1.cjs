'use strict';
// Bitácora independiente. No modifica existencias ni registra pagos.
const stores=new Set(['uki:arica','uki:serena','romo:serena']);
const kinds=new Set(['merma','personal','traspaso_salida','traspaso_entrada']);
const units={kg:['g',1000],g:['g',1],l:['ml',1000],ml:['ml',1],un:['un',1],porciones:['porciones',1]};
const err=m=>Object.assign(Error(m),{status:400});
function validate(store,input,item,worker){
 if(!stores.has(store)||!kinds.has(input.tipo)||!item||item.sku!==input.sku||!units[item.stock_unit])throw err('Artículo o tipo inválido');
 const id=String(input.request_id||'').toLowerCase(),q=input.cantidad,u=units[input.unidad],base=units[item.stock_unit];
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||typeof q!=='number'||!Number.isFinite(q)||q<=0||!u||u[0]!==base[0])throw err('Cantidad o unidad inválida');
 const amount=q*u[1]/base[1];
 if(amount>100000||Math.abs(amount*1000-Math.round(amount*1000))>1e-7||(['un','porciones'].includes(item.stock_unit)&&!Number.isInteger(amount)))throw err('Cantidad inválida');
 const reason=String(input.motivo||'').trim(),other=String(input.contraparte||''),ref=String(input.folio||'').trim().toUpperCase();
 if(reason.length<3||reason.length>180||typeof worker!=='string'||worker.length<2||worker.length>80)throw err('Indica un motivo breve');
 const transfer=input.tipo.startsWith('traspaso_');
 if(transfer?(!stores.has(other)||other===store||!/^[A-Z0-9-]{4,40}$/.test(ref)):(other!==''||ref!==''))throw err('Indica otra sucursal y un folio común para el traspaso');
 return {store,id,sku:item.sku,kind:input.tipo,quantity:Math.round(amount*1000)/1000,unit:item.stock_unit,reason,other:other||null,ref:ref||null,worker};
}
async function save(db,v){
 const args=[v.store,v.id,v.sku,v.kind,v.quantity,v.unit,v.reason,v.other,v.ref,v.worker];
 const rows=await db.query(`INSERT INTO public.inventario_justificaciones_v1(store_id,request_id,sku,kind,quantity,unit,reason,counterparty,transfer_ref,worker)
 VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING request_id`,args);
 if(rows.length)return {ok:true,registered:true,request_id:v.id};
 const old=await db.query(`SELECT request_id,sku,kind,quantity,unit,reason,counterparty,transfer_ref,worker FROM public.inventario_justificaciones_v1
 WHERE store_id=$1 AND (request_id=$2::uuid OR ($5::text IS NOT NULL AND transfer_ref=$5 AND kind=$4 AND sku=$3))`,[v.store,v.id,v.sku,v.kind,v.ref]);
 const a=old[0];
 if(old.length===1&&String(a.request_id)===v.id&&a.sku===v.sku&&a.kind===v.kind&&Number(a.quantity)===v.quantity&&a.unit===v.unit&&a.reason===v.reason&&a.counterparty===v.other&&a.transfer_ref===v.ref&&a.worker===v.worker)return {ok:true,registered:false,duplicated:true,request_id:v.id};
 throw Object.assign(Error('Registro o folio ya usado. Verifica antes de repetir.'),{status:409});
}
async function read(db,store,start,end){
 if(!stores.has(store)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(start)>=Date.parse(end))throw err('Intervalo inválido');
 const rows=await db.query('SELECT sku,kind,quantity,unit,reason,counterparty,transfer_ref,worker,created_at FROM public.inventario_justificaciones_v1 WHERE store_id=$1 AND created_at>$2::timestamptz AND created_at<=$3::timestamptz ORDER BY created_at LIMIT 2001',[store,start,end]);
 if(rows.length>2000)return {available:false,reason:'Demasiados registros; consulta un intervalo menor.'};
 return {available:true,rows,coverageComplete:false};
}
function annotate(rows,justifications){
 const entries=justifications?.available?justifications.rows:null;
 return rows.map(row=>{
  if(!entries)return {...row,justified:null};
  const related=entries.filter(x=>x.sku===row.sku);
  const total=kind=>{
   const group=related.filter(x=>x.kind===kind),dest=units[row.unit];
   if(!dest||group.some(x=>!units[x.unit]||units[x.unit][0]!==dest[0]||!Number.isFinite(Number(x.quantity))||Number(x.quantity)<=0))return null;
   return group.reduce((sum,x)=>sum+Number(x.quantity)*units[x.unit][1]/dest[1],0);
  };
  return {...row,justified:{waste:total('merma'),staff:total('personal'),transferOut:total('traspaso_salida'),transferIn:total('traspaso_entrada'),coverageComplete:false}};
 });
}
module.exports={validate,save,read,annotate};
