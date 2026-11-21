import {randomUUID} from 'node:crypto';
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
import {readInventarioRomoQA,aplicarOperacionInventarioRomoQA,validateRomoInventory,RomoInventarioRevisionConflicto} from './romo-inventario-qa.mjs';
import factura from './uki-inventario-facturas-live.cjs';
const STORE='romo:serena';
const check=(v,m,status=400)=>{if(!v)throw Object.assign(Error(m),{status})};
const norm=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const pub=(x,version)=>({...x,category:x.kind,kind:'inventory',version});
export async function facturaRomo({db,identity,action,body}){
 authorizeRomoOperation(identity,'romo','serena',action==='factura-consultar'?'inventory.read':action==='factura-preparar-articulos'?'catalog.write':'inventory.write');
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
