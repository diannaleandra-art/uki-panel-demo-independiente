'use strict';
// Artículos exclusivos de inventario. Nunca aparecen en la carta ni
// pueden marcarse Disponible/Agotado. Sólo inventario independiente de producción.
const {randomUUID}=require('node:crypto');
const UNITS=new Set(['un','kg','g','l','ml','porciones']);
const CATEGORIES=new Set(['ingrediente','envase','otro']);
function error(message,status=400){return Object.assign(Error(message),{status});}
function cantidad(v,label='cantidad'){
 if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000||Math.abs(v*1000-Math.round(v*1000))>1e-7)
  throw error('Revisa la '+label+' (máximo tres decimales).');
 return Math.round(v*1000)/1000;
}
function crearDatos(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw error('Artículo inválido.');
 const name=String(data.name||'').trim().replace(/\s+/g,' ');
 if(name.length<2||name.length>100)throw error('El nombre del artículo debe tener entre 2 y 100 caracteres.');
 const category=String(data.category||'ingrediente');
 const stock_unit=String(data.stock_unit||'un');
 if(!UNITS.has(stock_unit)||!CATEGORIES.has(category))throw error('Unidad o categoría inválida.');
 return {name,category,stock_unit,stock_qty:cantidad(data.stock_qty??0,'existencia inicial'),
  min_stock_qty:cantidad(data.min_stock_qty??0,'mínima')};
}
function item(row){
 return {sku:String(row.sku),kind:'inventory',group_key:String(row.category),
  name:String(row.name),category:String(row.category),available:true,
  stock_unit:String(row.stock_unit),stock_qty:Number(row.stock_qty),
  min_stock_qty:Number(row.min_stock_qty),version:Number(row.version),inventory_only:true};
}
async function listar(sql,branch){
 const rows=await sql.query(`SELECT sku,name,category,stock_unit,stock_qty,min_stock_qty,version
  FROM public.uki_inventario_extras_live WHERE branch=$1 ORDER BY category,name`,[branch]);
 return rows.map(item);
}
async function crear(sql,branch,input,uid){
 const next=crearDatos(input),sku='inv:'+randomUUID();
 try{
  const rows=await sql.query(`INSERT INTO public.uki_inventario_extras_live
   (branch,sku,name,category,stock_unit,stock_qty,min_stock_qty,updated_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8)
   RETURNING sku,name,category,stock_unit,stock_qty,min_stock_qty,version`,
   [branch,sku,next.name,next.category,next.stock_unit,next.stock_qty,next.min_stock_qty,uid]);
  return item(rows[0]);
 }catch(e){
  if(e?.code==='23505')throw error('Este artículo ya existe en el inventario de la sucursal.',409);
  throw e;
 }
}
async function editar(sql,branch,sku,input,expectedVersion,uid){
 const next=crearDatos(input);
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw error('Actualiza el artículo antes de editar.',409);
 try{
  const rows=await sql.query(`UPDATE public.uki_inventario_extras_live SET
   name=$3,category=$4,stock_unit=$5,stock_qty=$6,min_stock_qty=$7,
   version=version+1,updated_by=$9,updated_at=NOW()
   WHERE branch=$1 AND sku=$2 AND version=$8
   RETURNING sku,name,category,stock_unit,stock_qty,min_stock_qty,version`,
   [branch,sku,next.name,next.category,next.stock_unit,next.stock_qty,next.min_stock_qty,expectedVersion,uid]);
  if(rows.length!==1)throw error('Otro usuario modificó este artículo. Actualiza la lista.',409);
  return item(rows[0]);
 }catch(e){if(e?.code==='23505')throw error('Ya existe un artículo con ese nombre.',409);throw e;}
}
async function guardarMovimiento(sql,branch,sku,operation,n,expectedVersion,worker,detalle=null){
 const amount=cantidad(n,'cantidad registrada');
 if(operation==='entrada'&&amount<=0)throw error('La mercadería recibida debe ser mayor que cero.');
 if(!['conteo','entrada'].includes(operation))throw error('Operación no permitida.',403);
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)throw error('Actualiza el inventario antes de modificar.',409);
 // UPDATE y auditoría en la MISMA sentencia (CTE). Nunca se modifica la carta.
 const rows=await sql.query(`WITH changed AS (
  UPDATE public.uki_inventario_extras_live
  SET stock_qty=CASE WHEN $3='conteo' THEN $4::numeric ELSE stock_qty+$4::numeric END,
      version=version+1,updated_by=$6,updated_at=NOW()
  WHERE branch=$1 AND sku=$2 AND version=$5
    AND (CASE WHEN $3='conteo' THEN $4::numeric ELSE stock_qty+$4::numeric END)<=100000
  RETURNING branch,sku,stock_qty,stock_unit,min_stock_qty,name,category,version
 ), logged AS (
  INSERT INTO public.uki_inventario_extras_movimientos_live
   (branch,sku,action,quantity,stock_after,worker_name,cantidad_ingresada,unidad_ingresada,unidad_base)
  SELECT branch,sku,$3,$4,stock_qty,$6,$7,$8,stock_unit FROM changed RETURNING id
 ) SELECT changed.* FROM changed JOIN logged ON TRUE`,
 [branch,sku,operation,amount,expectedVersion,worker,detalle?.cantidad??amount,detalle?.unidad??null]);
 if(rows.length!==1)throw error('El inventario cambió en otro equipo o la cantidad supera el máximo. Actualiza antes de registrar.',409);
 return item(rows[0]);
}
module.exports={UNITS,CATEGORIES,cantidad,crearDatos,item,listar,crear,editar,guardarMovimiento};
