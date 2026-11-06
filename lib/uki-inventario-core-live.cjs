'use strict';
// Stock de ingredientes de Uki separado de la carta y de los pedidos.
const {baseItems,branchOK}=require('./uki-catalogo-v1.cjs');
const {cantidad}=require('./uki-inventario-extras-live.cjs');
const UNITS=new Set(['un','kg','g','l','ml','porciones']);
const error=(msg,status=400)=>Object.assign(Error(msg),{status});
const toItem=row=>({sku:String(row.sku),kind:'ingredient',name:String(row.name),
 group_key:'ingredientes',category:'ingrediente',stock_unit:String(row.stock_unit),
 stock_qty:Number(row.stock_qty),min_stock_qty:Number(row.min_stock_qty),
 version:Number(row.version),available:true,inventory_only:false});
async function base(branch){
 if(!branchOK(branch))throw error('Sucursal inválida');
 return (await baseItems(branch)).filter(x=>x.kind==='ingredient');
}
async function listar(sql,branch){
 const defaults=await base(branch);
 const rows=await sql.query('SELECT sku,name,stock_unit,stock_qty,min_stock_qty,version FROM public.uki_inventario_items_live WHERE branch=$1 ORDER BY sku',[branch]);
 const configured=new Map(rows.map(r=>[String(r.sku),r]));
 return defaults.map(p=>configured.has(p.sku)?toItem(configured.get(p.sku)):
  {...p,category:'ingrediente',inventory_only:false,available:true});
}
async function original(branch,sku){
 const value=(await base(branch)).find(x=>x.sku===sku);
 if(!value)throw error('Ingrediente no encontrado en esta sucursal.',404);
 return value;
}
async function configurar(sql,branch,sku,patch,expectedVersion,actor){
 const baseItem=await original(branch,sku);
 if(!patch||!UNITS.has(patch.stock_unit))throw error('Unidad inválida');
 const qty=cantidad(patch.stock_qty,'existencia'),min=cantidad(patch.min_stock_qty,'mínimo');
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw error('Versión inválida',409);
 const args=[branch,sku,baseItem.name,patch.stock_unit,qty,min,String(actor||'Administración')];
 const stmt=expectedVersion===0?
  'INSERT INTO public.uki_inventario_items_live (branch,sku,name,stock_unit,stock_qty,min_stock_qty,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (branch,sku) DO NOTHING RETURNING sku,name,stock_unit,stock_qty,min_stock_qty,version':
  'UPDATE public.uki_inventario_items_live SET stock_unit=$4,stock_qty=$5,min_stock_qty=$6,updated_by=$7,updated_at=NOW(),version=version+1 WHERE branch=$1 AND sku=$2 AND version=$8 RETURNING sku,name,stock_unit,stock_qty,min_stock_qty,version';
 const rows=await sql.query(stmt,expectedVersion===0?args:[...args,expectedVersion]);
 if(rows.length!==1)throw error('El inventario cambió en otro equipo; actualiza la lista.',409);
 return toItem(rows[0]);
}
async function guardarMovimiento(sql,branch,sku,operation,amount,version,worker,detalle){
 const baseItem=await original(branch,sku);
 if(!['conteo','entrada'].includes(operation))throw error('Operación inválida',403);
 const qty=cantidad(amount,'cantidad');
 if(operation==='entrada'&&qty<=0)throw error('El ingreso debe ser mayor que cero');
 if(!Number.isSafeInteger(version)||version<0)throw error('Actualiza antes de guardar',409);
 const args=[branch,sku,baseItem.name,operation,qty,version,String(worker).slice(0,60),
   detalle?.cantidad??qty,detalle?.unidad??'un'];
 const fields='branch,sku,accion,cantidad_anterior,cantidad_nueva,realizado_por,rol,identidad_autorizada,cantidad_ingresada,unidad_ingresada,cantidad_base,unidad_base';
 const changed=version===0?
  'INSERT INTO public.uki_inventario_items_live (branch,sku,name,stock_unit,stock_qty,min_stock_qty,updated_by) VALUES($1,$2,$3,\'un\',$5,0,$7) ON CONFLICT(branch,sku) DO NOTHING RETURNING sku,name,stock_unit,stock_qty,min_stock_qty,version':
  'UPDATE public.uki_inventario_items_live SET stock_qty=CASE WHEN $4=\'conteo\' THEN $5::numeric ELSE stock_qty+$5::numeric END,version=version+1,updated_by=$7,updated_at=NOW() WHERE branch=$1 AND sku=$2 AND version=$6 AND (CASE WHEN $4=\'conteo\' THEN $5::numeric ELSE stock_qty+$5::numeric END)<=100000 RETURNING sku,name,stock_unit,stock_qty,min_stock_qty,version';
 const oldQty=version===0?'0':'CASE WHEN $4=\'conteo\' THEN NULL ELSE stock_qty-$5::numeric END';
 const stmt='WITH changed AS ('+changed+'), logged AS (INSERT INTO public.uki_inventario_movimientos_live ('+fields+
  ') SELECT $1,$2,$4,'+oldQty+',stock_qty,$7,\'trabajador\',\'inventario:codigo-live\',$8,$9,$5,stock_unit FROM changed RETURNING id) SELECT changed.* FROM changed JOIN logged ON TRUE';
 const result=await sql.query(stmt,args);
 if(result.length!==1)throw error('El inventario cambió en otro dispositivo; actualiza antes de guardar.',409);
 return toItem(result[0]);
}
module.exports={listar,configurar,guardarMovimiento};
