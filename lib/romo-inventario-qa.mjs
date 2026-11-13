
/* Romo: inventario independiente y permisos Google, sin compartir existencias Uki. */
import {authorizeRomoOperation} from './romo-scope-operativo-qa.mjs';
export const ROMO_INVENTARIO_STORE_ID='romo:serena';
export const ROMO_INVENTARIO_QA_HABILITADO=false;
const check=(x,msg)=>{if(!x)throw Error(msg)};
const units=new Set(['un','kg','g','l','ml','porciones']);
const kinds=new Set(['ingrediente','envase','otro']);
const validSku=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{4,90}$/.test(s);
const quantity=x=>{
 const n=Number(x);
 check(x!==null&&x!==undefined&&x!==''&&Number.isFinite(n)&&
 n>=0&&n<=100000&&Math.abs(n*1000-Math.round(n*1000))<0.00001,
 'Cantidad inválida');
 return Math.round(n*1000)/1000;
};
export const emptyRomoInventory=()=>({version:1,items:[],movimientos:[]});
export function validateRomoInventory(s){
 check(s&&s.version===1&&Array.isArray(s.items)&&Array.isArray(s.movimientos),
  'Inventario Romo inválido');
 check(s.items.length<=1500&&s.movimientos.length<=3000,'Inventario demasiado grande');
 const unique=new Set();
 for(const x of s.items){
  check(x&&validSku(x.sku)&&typeof x.name==='string'&&x.name.trim().length>=2&&
   x.name.length<=100&&kinds.has(x.kind)&&units.has(x.stock_unit)&&
   typeof x.available==='boolean'&&typeof x.archived==='boolean',
   'Artículo inválido');
  quantity(x.stock_qty);quantity(x.min_stock_qty);
  check(!unique.has(x.sku),'SKU duplicado');
  unique.add(x.sku);
 }
 for(const x of s.movimientos){
  check(x&&validSku(x.sku)&&typeof x.tipo==='string'&&
   ['alta','editar','archivar','conteo','entrada','disponibilidad'].includes(x.tipo)&&
   typeof x.actor==='string'&&x.actor.length>0&&x.actor.length<=128&&
   Number.isSafeInteger(x.fechaMs)&&x.fechaMs>1700000000000,
   'Movimiento inválido');
 }
 check(JSON.stringify(s).length<=750000,'Inventario supera el tamaño máximo');
 return s;
}
export function aplicarOperacionInventarioRomoQA(original,{
 identity,action,args={},ahoraMs=Date.now()
}={}){
 check(['alta','editar','archivar','conteo','entrada','disponibilidad'].includes(action),
  'Acción no permitida');
 const operacion=['alta','editar','archivar'].includes(action)?'catalog.write':'inventory.write';
 const access=authorizeRomoOperation(identity,'romo','serena',operacion);
 check(Number.isSafeInteger(ahoraMs)&&ahoraMs>1700000000000&&
  ahoraMs<=Date.now()+300000,'Fecha inválida');
 check(args&&typeof args==='object'&&!Array.isArray(args)&&
  validSku(args.sku),'SKU inválido');
 const state=structuredClone(validateRomoInventory(original));
 let item=state.items.find(x=>x.sku===args.sku);
 const anterior=item?structuredClone(item):null;
 if(action==='alta'){
  check(!item&&state.items.length<1500,'Artículo ya existe o inventario lleno');
  const name=String(args.name??'').trim();
  check(name.length>=2&&name.length<=100&&kinds.has(args.kind)&&
   units.has(args.stock_unit),'Nombre, unidad o tipo inválidos');
  item={sku:args.sku,name,kind:args.kind,stock_unit:args.stock_unit,
   stock_qty:quantity(args.stock_qty??0),
   min_stock_qty:quantity(args.min_stock_qty??0),
   available:args.available!==false,archived:false};
  state.items.push(item);
 }else{
  check(item&&item.archived!==true,'Artículo no existe o está archivado');
  if(action==='editar'){
   const name=String(args.name??'').trim();
   check(name.length>=2&&name.length<=100&&kinds.has(args.kind)&&
    units.has(args.stock_unit),'Nombre, unidad o tipo inválidos');
   item.name=name;item.kind=args.kind;item.stock_unit=args.stock_unit;
   item.min_stock_qty=quantity(args.min_stock_qty);
  }else if(action==='archivar'){item.archived=true;item.available=false;}
  else if(action==='conteo'){item.stock_qty=quantity(args.stock_qty);}
  else if(action==='entrada'){
   const inc=quantity(args.cantidad);check(inc>0,'Entrada debe ser mayor a cero');
   item.stock_qty=quantity(item.stock_qty+inc);
  }else{
   check(typeof args.available==='boolean','Disponibilidad inválida');
   item.available=args.available;
  }
  check(JSON.stringify(anterior)!==JSON.stringify(item),'No hay cambios que guardar');
 }
 state.movimientos.push({tipo:action,sku:args.sku,actor:access.actorId,
  fechaMs:ahoraMs,antes:anterior,despues:structuredClone(item)});
 state.movimientos=state.movimientos.slice(-3000);
 validateRomoInventory(state);
 return Object.freeze({state,change:Object.freeze({tipo:action,sku:args.sku,
  actor:access.actorId,fechaMs:ahoraMs})});
}
export class RomoInventarioRevisionConflicto extends Error{
 constructor(){super('Inventario Romo cambió desde otro equipo; actualiza antes de guardar.');
  this.code='REVISION_CONFLICTO';}
}
export async function readInventarioRomoQA({db,identity}={}){
 authorizeRomoOperation(identity,'romo','serena','inventory.read');
 check(typeof db?.query==='function','Base exclusiva Romo no disponible');
 const rows=await db.query(
  'SELECT revision,contenido FROM public.romo_inventario_v1 WHERE store_id=$1 LIMIT 1',
  [ROMO_INVENTARIO_STORE_ID]);
 const r=rows[0],revision=r?Number(r.revision):0;
 check(Number.isSafeInteger(revision)&&revision>=0,'Revisión inválida');
 const contenido=r?(typeof r.contenido==='string'?JSON.parse(r.contenido):r.contenido)
  :emptyRomoInventory();
 validateRomoInventory(contenido);
 return Object.freeze({storeId:ROMO_INVENTARIO_STORE_ID,revision,contenido});
}
export async function guardarOperacionInventarioRomoQA({
 db,identity,expectedRevision,action,args,ahoraMs=Date.now()
}={}){
 check(Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,'Revisión inválida');
 const before=await readInventarioRomoQA({db,identity});
 if(before.revision!==expectedRevision)throw new RomoInventarioRevisionConflicto();
 const {state,change}=aplicarOperacionInventarioRomoQA(before.contenido,{
  identity,action,args,ahoraMs
 });
 const sql='INSERT INTO public.romo_inventario_v1 AS v '+
 '(store_id,revision,contenido,actualizado_por,actualizado_en) '+
 'VALUES ($1,$2,$3::jsonb,$4,now()) '+
 'ON CONFLICT (store_id) DO UPDATE SET '+
 'revision=EXCLUDED.revision, contenido=EXCLUDED.contenido, '+
 'actualizado_por=EXCLUDED.actualizado_por, actualizado_en=now() '+
 'WHERE v.revision=$5 RETURNING revision';
 const rows=await db.query(sql,[ROMO_INVENTARIO_STORE_ID,expectedRevision+1,
  JSON.stringify(state),identity.userId,expectedRevision]);
 if(!Array.isArray(rows)||rows.length!==1||
    Number(rows[0].revision)!==expectedRevision+1)
  throw new RomoInventarioRevisionConflicto();
 return Object.freeze({storeId:ROMO_INVENTARIO_STORE_ID,
  revision:expectedRevision+1,change});
}
