'use strict';
// QA: preparar varios artículos desde una factura, solo inventario, stock inicial cero.
const {crearDatos,item}=require('./uki-inventario-extras-live.cjs');
const {identidad}=require('./uki-inventario-facturas-live.cjs');
const error=(message,status=400)=>Object.assign(Error(message),{status});
const normalizar=x=>String(x||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLocaleLowerCase('es-CL').replace(/\s+/g,' ');
function validarLote(input,existentes=[],extrasExistentes=[]){
 const documento=identidad(input);
 if(!Array.isArray(input.articulos)||input.articulos.length<1||input.articulos.length>20)
  throw error('Selecciona entre 1 y 20 artículos de la factura.');
 const seenNames=new Set(),seenLines=new Set();
 const catalog=new Set(existentes.filter(x=>x.kind==='ingredient').map(x=>normalizar(x.name)));
 const articulos=input.articulos.map(a=>{
  const linea=Number(a?.linea);
  if(!Number.isSafeInteger(linea)||linea<1||linea>500||seenLines.has(linea))
   throw error('Hay líneas repetidas o inválidas en la factura.');
  seenLines.add(linea);
  if(!['ingrediente','envase','otro'].includes(a.category))
   throw error('Selecciona el tipo de artículo antes de prepararlo.');
  const normalized=crearDatos({name:a.name,category:a.category,
   stock_unit:a.stock_unit,stock_qty:0,min_stock_qty:0});
  const key=normalizar(normalized.name);
  if(seenNames.has(key))throw error('Hay artículos repetidos en la selección. Revisa los nombres.');
  seenNames.add(key);
  if(catalog.has(key))throw error('«'+normalized.name+'» ya es ingrediente de la carta. Selecciónalo en lugar de crear otro.',409);
  // Protege también variantes con/sin tildes que una restricción lower(name)
  // de PostgreSQL por sí sola no detecta.
  const semejante=extrasExistentes.find(x=>x.kind==='inventory'&&normalizar(x.name)===key);
  if(semejante&&String(semejante.name).toLocaleLowerCase('es-CL')!==normalized.name.toLocaleLowerCase('es-CL'))
   throw error('Ya existe «'+semejante.name+'» en inventario. Selecciónalo y no crees otra variante.',409);
  return {linea,name:normalized.name,category:normalized.category,stock_unit:normalized.stock_unit};
 });
 return {documento,articulos};
}
async function preparar(sql,branch,input,worker,existingCore=[],existingExtras=[]){
 const data=validarLote(input,existingCore,existingExtras);
 const actor=String(worker||'').trim().slice(0,60)+' (factura '+data.documento.folio+')';
 const pending=data.articulos.map(a=>({name:a.name,category:a.category,stock_unit:a.stock_unit}));
 // Única inserción con UNIQUE(branch,lower(name)); no altera existencias de otros artículos.
 const insertSql=[
  'INSERT INTO public.uki_inventario_extras_live',
  '(branch,sku,name,category,stock_unit,stock_qty,min_stock_qty,updated_by)',
  "SELECT $1,'inv:'||gen_random_uuid()::text,t.name,t.category,t.stock_unit,0,0,$3",
  'FROM jsonb_to_recordset($2::jsonb) AS t(name text,category text,stock_unit text)',
  'WHERE TRUE',
  'ON CONFLICT DO NOTHING',
  'RETURNING sku,name,category,stock_unit,stock_qty,min_stock_qty,version'
 ].join(' ');
 const created=await sql.query(insertSql,[branch,JSON.stringify(pending),actor]);
 const selectSql=[
  'SELECT sku,name,category,stock_unit,stock_qty,min_stock_qty,version',
  'FROM public.uki_inventario_extras_live',
  'WHERE branch=$1 AND lower(name)=ANY($2::text[])'
 ].join(' ');
 const rows=await sql.query(selectSql,[branch,pending.map(a=>a.name.toLowerCase())]);
 const byName=new Map(rows.map(x=>[normalizar(x.name),x]));
 const createdSkus=new Set(created.map(x=>String(x.sku)));
 const resultados=data.articulos.map(a=>{
  const found=byName.get(normalizar(a.name));
  if(!found)return {linea:a.linea,name:a.name,estado:'error',
   mensaje:'No se confirmó el artículo. Actualiza antes de repetir.'};
  if(found.stock_unit!==a.stock_unit)
   return {linea:a.linea,name:a.name,estado:'unidad-distinta',
    mensaje:'Ya existe con unidad '+found.stock_unit+'. No se modificó.',stock_unit:found.stock_unit};
  return {linea:a.linea,name:a.name,estado:createdSkus.has(String(found.sku))?'creado':'existente',
   item:item(found)};
 });
 return {documento:data.documento,articulos:resultados,
  creados:resultados.filter(x=>x.estado==='creado').length,
  nuevosStock:0,nota:'Los artículos nuevos comienzan con stock 0 y mínimo 0. No se recibió mercadería.'};
}
module.exports={normalizar,validarLote,preparar};
