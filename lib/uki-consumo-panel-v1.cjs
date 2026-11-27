'use strict';
// Las existencias se leen. No hay ningún descuento, devolución, venta ni timbre en este servicio.
const liveSales=require('./inventario-ventas-live-v1.cjs');
const yieldStore=require('./inventario-rendimientos-v1.cjs');
const {read:justifications,annotate}=require('./inventario-justificaciones-v1.cjs');
const motivos=new Set(['personal','regalo','reposicion','otro']);
const tipos=new Set(['roll-clasico','premium','otro-sushi','otro-producto']);
const proteinas=new Set(['pollo','kanicama','carne','camaron','cerdo','salmon','pulpo','berenjena crispy','vegetariana']);
const vegetales=new Set(['palta','pepino','cebollin','sin vegetal']);
const envolturas=new Set(['panko','tempura','sin envoltura']);
const medios=new Set(['Efectivo','Transferencia','Débito','Crédito','Otro']);
const invalid=(msg,status=400)=>Object.assign(Error(msg),{status});
const clave=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const txt=(v,max)=>typeof v==='string'&&v.trim().length<=max?v.trim():null;
const diaValido=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const unidades={g:['g',1],kg:['g',1000],ml:['ml',1],l:['ml',1000],un:['un',1],porciones:['porciones',1]};
const num=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const fechaRevision="COALESCE(summary->>'fecha_inventario',summary->>'fecha_conteos_recuperada',to_char(created_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD'))";
function validate(input){
 const id=String(input.request_id||'').toLowerCase(), motivo=input.motivo;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)||!motivos.has(motivo))throw invalid('Revisa el motivo del registro.');
 const persona=txt(input.persona,90),nota=txt(input.nota,180),original=txt(input.original,40);
 if(persona===null||nota===null||original===null||motivo==='personal'&&!persona||motivo==='otro'&&!nota||
    motivo==='reposicion'&&!/^[A-Za-z0-9#-]{1,40}$/.test(original)||motivo!=='reposicion'&&original)
  throw invalid('Completa la persona, motivo o referencia del pedido original según corresponda.');
 const entrega=input.entrega||{};
 if(!['local','retiro','delivery'].includes(entrega.tipo))throw invalid('Tipo de entrega inválido.');
 const costo=entrega.monto, modo=entrega.modo,medio=entrega.medio,direccion=txt(entrega.direccion,170);
 if(direccion===null)throw invalid('Dirección inválida.');
 if(entrega.tipo!=='delivery'){
  if(modo!=='ninguno'||costo!==0||medio!==''||direccion!=='')throw invalid('Los retiros y consumos en local no llevan pago de delivery.');
 }else if(!['cliente','local','gratis'].includes(modo)||!num(costo,0,1000000)||
   modo==='cliente'&&(!num(costo,1,1000000)||!medios.has(medio)||entrega.recibido!==true)||
   modo!=='cliente'&&medio!==''||modo==='gratis'&&costo!==0)
  throw invalid('Indica cómo se gestionó el delivery. Si lo paga el cliente, confirma que lo recibiste.');
 const rows=input.items;
 if(!Array.isArray(rows)||rows.length<1||rows.length>12)throw invalid('Agrega entre 1 y 12 productos.');
 const items=rows.map(i=>{
  if(!i||!tipos.has(i.tipo)||!num(i.cantidad,1,100)||motivo==='personal'&&i.tipo==='otro-producto')throw invalid('Revisa el tipo de producto y las cantidades.');
  if(i.tipo==='otro-sushi'||i.tipo==='otro-producto'){
   const nombre=txt(i.nombre,100);if(!nombre)throw invalid('Escribe el nombre del producto.');
   return {tipo:i.tipo,nombre,cantidad:i.cantidad};
  }
  if(!proteinas.has(i.proteina)||!vegetales.has(i.vegetal)||!envolturas.has(i.envoltura))throw invalid('Completa el armado del roll.');
  return {tipo:i.tipo,cantidad:i.cantidad,proteina:i.proteina,vegetal:i.vegetal,envoltura:i.envoltura,conQueso:i.conQueso===true};
 });
 return {id,detalle:{motivo,persona,nota,original,items,entrega:{tipo:entrega.tipo,modo,monto:costo,medio,direccion}}};
}
async function save(db,store,uid,input){
 const v=validate(input),params=[store,v.id,uid,JSON.stringify(v.detalle)];
 const r=await db.query(`INSERT INTO public.uki_salidas_sin_cobro_v1(store_id,request_id,actor,detalle)
  VALUES($1,$2::uuid,$3,$4::jsonb) ON CONFLICT DO NOTHING RETURNING creado_en`,params);
 if(r.length===1)return {ok:true,id:v.id,createdAt:r[0].creado_en};
 const [found]=await db.query('SELECT creado_en, detalle=$3::jsonb AS igual FROM public.uki_salidas_sin_cobro_v1 WHERE store_id=$1 AND request_id=$2::uuid',[store,v.id,params[3]]);
 if(!found?.igual)throw invalid('Este registro ya se usó con otros datos. Consulta antes de repetirlo.',409);
 return {ok:true,id:v.id,createdAt:found.creado_en,repetido:true};
}
function confirmedRecipe(recipes,sku,store){
 const exact=recipes.find(i=>i.sku===sku&&i.ambito===store)||recipes.find(i=>i.sku===sku&&i.ambito==='todos');
 return exact&&['parcial','confirmada'].includes(exact.estado)?exact:null;
}
function estimatePreparations(entries,recipes){
 const amounts=new Map();let itemsPending=0;
 for(const e of entries)for(const item of e.detalle.items||[]){
  const recipe=confirmedRecipe(recipes,item.tipo,e.store_id);
  if(!recipe){itemsPending+=item.cantidad;continue;}
  const selected={
   'arroz cocido y alinado':'Arroz cocido y aliñado',
   'queso crema':item.conQueso?'Queso crema':null,
   pollo:item.proteina==='pollo'?'pollo':null,
   proteina:item.proteina!=='vegetariana'&&item.proteina!=='berenjena crispy'?item.proteina:null,
   [item.vegetal]:item.vegetal==='sin vegetal'?null:item.vegetal,
   [item.envoltura]:item.envoltura==='sin envoltura'?null:item.envoltura
  };
  const mapped=new Set();
  for(const l of recipe.lineas||[]){
   const name=selected[clave(l.nombre)],grams=Number(l.gramos);
   if(!name||l.pendiente===true||!Number.isFinite(grams)||grams<=0||mapped.has(name))continue;
   const k=JSON.stringify([e.store_id,e.detalle.motivo,name]);
   amounts.set(k,(amounts.get(k)||0)+grams*item.cantidad);mapped.add(name);
  }
  if(recipe.estado!=='confirmada'||!mapped.has('Arroz cocido y aliñado')||
    (item.proteina!=='vegetariana'&&!mapped.has(item.proteina))||
    (item.vegetal!=='sin vegetal'&&!mapped.has(item.vegetal))||
    (item.envoltura!=='sin envoltura'&&!mapped.has(item.envoltura)))itemsPending+=item.cantidad;
 }
 return {itemsPending,amounts:[...amounts].map(([k,grams])=>{
  const [store,motivo,ingredient]=JSON.parse(k);return {store,motivo,ingredient,grams};
 })};
}
function dateString(ts){return new Date(ts).toISOString();}
function convert(value,from,to){
 return value!==null&&value!==undefined&&Number.isFinite(Number(value))&&unidades[from]?.[0]&&unidades[from]?.[0]===unidades[to]?.[0]?Number(value)*unidades[from][1]/unidades[to][1]:null;
}
function physicalRows(open,close,moves,items){
 const asMap=x=>new Map((x?.items||[]).map(i=>[i.sku,i]));
 const start=asMap(open),end=asMap(close),by=new Map(), names=new Map(items.map(i=>[i.sku,i]));
 for(const [k,v] of [...start,...end])if(!names.has(k))names.set(k,v);
 for(const m of moves){const s=by.get(m.sku)||[];s.push(m);by.set(m.sku,s);}
 return [...names].map(([sku,item])=>{
  const p=start.get(sku),c=end.get(sku),unit=c?.stock_unit||p?.stock_unit||item.stock_unit;
  const movements=by.get(sku)||[];
  const entries=movements.filter(i=>i.tipo==='entrada').map(m=>convert(m.qty,m.unit,unit));
  const initial=p?.conteo_registrado===true&&p.stock_unit===unit?convert(p.stock_qty,unit,unit):null;
  const last=movements.at(-1);
  const final=c?.conteo_registrado===true&&last?.tipo==='conteo'&&last.unit===unit&&last.after!==null&&Number(last.after)===Number(c.stock_qty)?convert(c.stock_qty,unit,unit):null;
  const received=entries.includes(null)?null:entries.reduce((a,b)=>a+b,0);
  return {sku,name:c?.name||item.name,unit,initial,received,final,outflow:initial!==null&&final!==null&&received!==null?initial+received-final:null};
 });
}
async function delivery(db,store,day){
 if(!diaValido(day))throw invalid('Selecciona una fecha válida.');
 const rows=await db.query(`SELECT request_id,creado_en,detalle->'entrega' AS entrega,detalle->>'motivo' AS motivo
  FROM public.uki_salidas_sin_cobro_v1 WHERE store_id=$1
   AND (creado_en AT TIME ZONE 'America/Santiago')::date=$2::date
   AND detalle->'entrega'->>'tipo'='delivery' ORDER BY creado_en LIMIT 1001`,[store,day]);
 if(rows.length>1000)throw invalid('El día contiene demasiados deliveries para mostrar.',409);
 return {ok:true,rows:rows.map(({request_id,creado_en,motivo,entrega})=>({id:request_id,
  createdAt:creado_en,motivo,modo:entrega.modo,monto:entrega.monto,medio:entrega.medio}))};
}
async function readSalesInterval(finance,store,start,end,recipes){
 if(!finance)return null;
 const [data]=await finance.query('SELECT window_start,captured_at,facts FROM public.fin_consumo_ventas_live_v1 WHERE store_id=$1',[store]);
 if(!data||!Array.isArray(data.facts))return null;
 const a=Math.max(Date.parse(start),Date.parse(data.window_start)),b=Math.min(Date.parse(end),Date.parse(data.captured_at));
 if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)return null;
 const availableRecipes=recipes.filter(recipe=>['todos',store].includes(recipe.ambito));
 const result=liveSales.estimate(data.facts,availableRecipes,dateString(a),dateString(b));
 return {...result,available:true,start:dateString(a),end:dateString(b),partialWindow:a!==Date.parse(start)||b!==Date.parse(end),
  reason:availableRecipes.length?'Estimación según el armado y las recetas registradas.':'No hay recetas disponibles para convertir las ventas.'};
}
function project(rows,prepared,factors,shared){
 const by=new Map();
 for(const x of prepared){
  const exact=factors.filter(f=>f.store===x.store&&f.ingredient===x.ingredient);
  // Los rendimientos de Romo legados no se aplican a un SKU de otra bodega.
  const fallback=shared&&x.store==='romo:serena'?factors.filter(f=>f.store==='uki:serena'&&f.ingredient===x.ingredient):[];
  const factor=exact.length===1&&rows.some(r=>r.sku===exact[0].sku)?exact[0]:fallback.length===1?fallback[0]:null;
  const row=factor&&rows.find(r=>r.sku===factor.sku&&['kg','g'].includes(r.unit));
  const raw=Number(factor?.raw_g),cooked=Number(factor?.prepared_g);
  if(!row||!Number.isFinite(raw)||!Number.isFinite(cooked)||raw<=0||cooked<=0)continue;
  const record=by.get(row.sku)||{};record[x.motivo]=(record[x.motivo]||0)+x.grams*raw/cooked/(row.unit==='kg'?1000:1);by.set(row.sku,record);
 }
 return rows.map(row=>{
  const from=by.get(row.sku)||{},j=row.justified;
  const staff=from.personal===undefined&&j?.staff==null?null:(from.personal||0)+(j?.staff||0);
  const signals=row.initial!==null&&row.received!==null&&j&&[j.waste,j.transferIn,j.transferOut].every(v=>v!==null)&&Object.keys(from).length;
  // Usar transferencias justificadas para explicar movimientos; no restar del stock vivo.
  const expected=signals?row.initial+row.received+j.transferIn-j.transferOut-j.waste-Object.values(from).reduce((a,b)=>a+b,0)-(j.staff||0):null;
  return {...row,sales:from.venta??null,staff,gift:from.regalo??null,replacement:from.reposicion??null,other:from.otro??null,
   expected,difference:expected!==null&&row.final!==null?row.final-expected:null};
 });
}
async function report(db,finance,branch,store,day,items,{shared,withJustifications=true}={}){
 if(!diaValido(day))throw invalid('Selecciona una fecha válida.');
 const [period]=await db.query(`SELECT $1::date::timestamp AT TIME ZONE 'America/Santiago' AS start,
  ($1::date+1)::timestamp AT TIME ZONE 'America/Santiago' AS end,
  now() AS now, to_char(now() AT TIME ZONE 'America/Santiago','YYYY-MM-DD') AS today`,[day]);
 if(!period||day>period.today)throw invalid('Selecciona hoy o un día anterior.');
 const snapshots=await db.query(`SELECT id,created_at,items,${fechaRevision} AS day FROM public.uki_inventario_revisiones_live
  WHERE branch=$1 AND ${fechaRevision}<=$2 ORDER BY ${fechaRevision} DESC,created_at DESC,id DESC LIMIT 2`,[branch,day]);
 const close=snapshots[0]?.day===day?snapshots[0]:null,open=close?snapshots[1]:snapshots[0];
 const start=dateString(open?.created_at||period.start),end=dateString(close?.created_at||(day===period.today?period.now:period.end));
 if(Date.parse(start)>=Date.parse(end))throw invalid('No hay un período de inventario que se pueda comparar para esta fecha.',409);
 const stores=shared&&branch==='serena'?['uki:serena','romo:serena']:[store],parameters=[branch,start,end];
 const [moves,entries,just]=await Promise.all([
  db.query(`SELECT sku,accion AS tipo,cantidad_base AS qty,unidad_base AS unit,cantidad_nueva AS after,creado_en AS at
   FROM public.uki_inventario_movimientos_live WHERE branch=$1 AND creado_en>$2::timestamptz AND creado_en<=$3::timestamptz AND accion IN ('entrada','conteo')
   UNION ALL SELECT sku,action,quantity,unidad_base,stock_after,created_at FROM public.uki_inventario_extras_movimientos_live
    WHERE branch=$1 AND created_at>$2::timestamptz AND created_at<=$3::timestamptz AND action IN ('entrada','conteo') ORDER BY at LIMIT 10001`,parameters),
  db.query(`SELECT store_id,request_id,creado_en,detalle FROM public.uki_salidas_sin_cobro_v1
   WHERE store_id IN ($1,$2) AND creado_en>$3::timestamptz AND creado_en<=$4::timestamptz ORDER BY creado_en LIMIT 1001`,
   [stores[0],stores[1]||stores[0],start,end]),
  withJustifications?justifications(db,'uki:'+branch,start,end).catch(()=>null):null
 ]);
 if(moves.length>10000||entries.length>1000)throw invalid('Hay demasiados registros en este intervalo. Consulta un cierre más cercano.',409);
 const sales=[],factors=[],recipes=finance?await finance.query("SELECT sku,ambito,estado,lineas FROM public.fin_recetas_estandar_v1 WHERE sku IN ('roll-clasico','premium') AND ambito IN ('todos',$1,$2)",[stores[0],stores[1]||stores[0]]).catch(()=>[]):[];
 await Promise.all(stores.map(async st=>{
  const data=await readSalesInterval(finance,st,start,end,recipes).catch(()=>null);
  const factorsForStore=finance?await yieldStore.list(finance,st).catch(()=>[]):[];
  factors.push(...factorsForStore.map(f=>({...f,store:st})));
  sales.push({store:st,available:data?.available===true,reason:data?.reason||'Ventas no disponibles en el período.',
   calculated:data?.calculated??null,pending:data?.pending??null,ingredients:data?.available?data.ingredients:[],
   start:data?.start||null,end:data?.end||null,partialWindow:data?.partialWindow===true});
 }));
 const structured=estimatePreparations(entries,recipes);
 const prepared=[...sales.flatMap(s=>s.ingredients.map(i=>({store:s.store,motivo:'venta',ingredient:i.name,grams:i.quantity}))),...structured.amounts];
 const projected=project(annotate(physicalRows(open,close,moves,items),just),prepared,factors,shared);
 return {ok:true,day,start,end,openingDay:open?.day||null,hasClose:!!close,branch,store,readOnly:true,
  rows:projected,prepared,sales,itemsPending:structured.itemsPending,
  sinCobro:entries.filter(e=>e.store_id===store).map(e=>({id:e.request_id,createdAt:e.creado_en,detalle:e.detalle})),
  justificationsAvailable:just?.available===true};
}
module.exports={validate,save,report,estimatePreparations,physicalRows,project,delivery};
