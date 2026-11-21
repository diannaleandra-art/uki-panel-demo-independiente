import {randomUUID} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {readInventarioRomoQA,aplicarOperacionInventarioRomoQA,validateRomoInventory,RomoInventarioRevisionConflicto} from './romo-inventario-qa.mjs';
import factura from './uki-inventario-facturas-live.cjs';
const STORE='romo:serena';
const check=(v,m,status=400)=>{if(!v)throw Object.assign(Error(m),{status})};
const norm=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const pub=(x,version)=>({...x,category:x.kind,kind:'inventory',version});
export async function facturaRomo({db,identity,action,body}){
 authorizeRomoOperation(identity,'romo','serena',['factura-consultar','factura-historial'].includes(action)?'inventory.read':action==='factura-preparar-articulos'?'catalog.write':'inventory.write');
 if(action==='factura-historial'){
  check(identity?.role==='duenos','Solo dueños de Romo',403);
  const state=await readInventarioRomoQA({db,identity});
  const entries=state.contenido.facturas??[];
  check(Array.isArray(entries)&&entries.length<=3000,'Historial no disponible');
  const filter=String(body.buscar??'').trim().toLowerCase().slice(0,100);
  const desde=String(body.desde??''),hasta=String(body.hasta??'');
  check((!desde||/^\d{4}-\d{2}-\d{2}$/.test(desde))&&(!hasta||/^\d{4}-\d{2}-\d{2}$/.test(hasta))&&(!desde||!hasta||desde<=hasta),'Fechas inválidas');
  const offset=Number(body.offset??0);check(Number.isSafeInteger(offset)&&offset>=0&&offset<=3000,'Página inválida');
  const day=ms=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
  const docs=new Map();
  for(const e of entries){
   if(!e||typeof e.documento!=='string'||!Number.isSafeInteger(e.fechaMs))throw Error('Historial inválido');
   const d=docs.get(e.documento)||{rut:e.rut_emisor,folio:e.folio,tipo:e.tipo_doc,ultima:e.fechaMs,lineas:0,entregas:[]};
   d.ultima=Math.max(d.ultima,e.fechaMs);d.entregas.push({linea:e.linea,entrega:e.entrega,descripcion:e.descripcion,cantidad:e.cantidad_recibida_base,unidad:e.unidad_base,fechaMs:e.fechaMs});docs.set(e.documento,d);
  }
  const matches=[...docs.values()].filter(d=>(!filter||[d.rut,d.folio,...d.entregas.map(x=>x.descripcion)].some(x=>String(x).toLowerCase().includes(filter)))&&(!desde||day(d.ultima)>=desde)&&(!hasta||day(d.ultima)<=hasta)).sort((a,b)=>b.ultima-a.ultima);
  return {ok:true,storeId:STORE,total:matches.length,documentos:matches.slice(offset,offset+25).map(d=>({...d,lineas:new Set(d.entregas.map(x=>x.linea)).size}))};
 }
 const doc=factura.identidad(body);
 check(['33','34','52'].includes(doc.tipo),'Tipo de documento no permitido');
 const key=[doc.rut,doc.tipo,String(BigInt(doc.folio))].join('|'),before=await readInventarioRomoQA({db,identity});
 let state=structuredClone(before.contenido),entries=state.facturas??[];
 check(Array.isArray(entries)&&entries.length<=3000,'Registro de facturas inválido');
 const matches=entries.filter(x=>x.documento===key);
 if(action==='factura-consultar'){
  const groups=new Map();
  for(const x of matches){const p=groups.get(x.linea)||{linea:x.linea,sku:x.sku,unidad_base:x.unidad_base,cantidad_factura_base:x.cantidad_factura_base,cantidad_recibida_base:0};p.cantidad_recibida_base=Math.round((p.cantidad_recibida_base+x.cantidad_recibida_base)*1000)/1000;groups.set(x.linea,p);}
  return {ok:true,storeId:STORE,revision:before.revision,lineas:[...groups.values()],entregas:matches.map(x=>({linea:x.linea,entrega:x.entrega}))};
 }
 let result;
 if(action==='factura-preparar-articulos'){
  check(Array.isArray(body.articulos)&&body.articulos.length>=1&&body.articulos.length<=20,'Selecciona hasta 20 artículos');
  check(before.revision===body.expectedRevision,'Inventario actualizado por otro equipo',409);
  const nombres=new Set(),lineas=new Set(),out=[];
  for(const row of body.articulos){
   const name=String(row.name||'').trim(),n=norm(name),linea=Number(row.linea);
   check(Number.isSafeInteger(linea)&&linea>=1&&linea<=500&&!lineas.has(linea)&&name.length>=2&&name.length<=100&&!nombres.has(n),'Artículo o línea duplicada');
   nombres.add(n);lineas.add(linea);
   const same=state.items.find(x=>norm(x.name)===n);
   if(same){out.push(same.archived||same.stock_unit!==row.stock_unit?{linea,estado:'unidad-distinta'}:{linea,estado:'existente',item:pub(same,before.revision+1)});continue;}
   const sku='r_'+randomUUID().replace(/-/g,'');
   state=aplicarOperacionInventarioRomoQA(state,{identity,action:'alta',args:{sku,name,kind:row.category,stock_unit:row.stock_unit,stock_qty:0,min_stock_qty:0,available:false}}).state;
   out.push({linea,estado:'creado',item:pub(state.items.find(x=>x.sku===sku),before.revision+1)});
  }
  result={articulos:out};
 }else if(action==='factura-recibir'){
  const item=state.items.find(x=>x.sku===body.sku&&!x.archived);
  check(item,'Artículo no existe en Romo');
  const data=factura.linea(body,pub(item,body.expected_version));
  const prev=entries.find(x=>x.request_id===data.request||x.documento===key&&x.linea===data.index&&x.entrega===data.entrega);
  if(prev){
   check(prev.documento===key&&prev.linea===data.index&&prev.entrega===data.entrega&&prev.sku===item.sku&&prev.cantidad_recibida_base===data.amount&&prev.cantidad_factura_base===data.limit&&prev.unidad_base===item.stock_unit,'Entrega ya registrada con otros datos',409);
   return {ok:true,storeId:STORE,revision:before.revision,duplicada:true,item:pub(item,before.revision)};
  }
  check(body.expected_version===before.revision,'Inventario actualizado por otro equipo',409);
  const prior=matches.filter(x=>x.linea===data.index);
  check(prior.every(x=>x.sku===item.sku&&x.unidad_base===item.stock_unit&&x.cantidad_factura_base===data.limit),'La línea tiene otro artículo, unidad o total registrado',409);
  check(prior.reduce((s,x)=>s+Math.round(x.cantidad_recibida_base*1000),0)+Math.round(data.amount*1000)<=Math.round(data.limit*1000),'La entrega supera la cantidad total documentada',409);
  check(entries.length<3000,'Historial de facturas lleno; no se guardó esta entrada',409);
  state=aplicarOperacionInventarioRomoQA(state,{identity,action:'entrada',args:{sku:item.sku,cantidad:data.amount}}).state;
  state.facturas=[...entries,{documento:key,rut_emisor:doc.rut,tipo_doc:doc.tipo,folio:doc.folio,linea:data.index,entrega:data.entrega,sku:item.sku,descripcion:data.description,unidad_base:item.stock_unit,cantidad_recibida_base:data.amount,cantidad_factura_base:data.limit,request_id:data.request,fechaMs:Date.now(),actor:identity.userId}];
  result={duplicada:false,item:pub(state.items.find(x=>x.sku===item.sku),before.revision+1)};
 }else throw Object.assign(Error('Acción no autorizada'),{status:400});
 validateRomoInventory(state);
 if(JSON.stringify(state)===JSON.stringify(before.contenido))return {ok:true,storeId:STORE,revision:before.revision,...result,articulos:result.articulos?.map(x=>x.item?{...x,item:{...x.item,version:before.revision}}:x)};
 const saved=await db.query("INSERT INTO public.romo_inventario_v1 AS v (store_id,revision,contenido,actualizado_por,actualizado_en) VALUES($1,$2,$3::jsonb,$4,now()) ON CONFLICT(store_id) DO UPDATE SET revision=EXCLUDED.revision,contenido=EXCLUDED.contenido,actualizado_por=EXCLUDED.actualizado_por,actualizado_en=now() WHERE v.revision=$5 RETURNING revision",[STORE,before.revision+1,JSON.stringify(state),identity.userId,before.revision]);
 if(saved.length!==1||Number(saved[0].revision)!==before.revision+1)throw new RomoInventarioRevisionConflicto();
 return {ok:true,storeId:STORE,revision:before.revision+1,...result};
}
