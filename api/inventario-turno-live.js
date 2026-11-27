'use strict';
// Inventario independiente de producción, sin acceso a caja ni pedidos.
// Esta API no ofrece pedidos, caja, cierres, edición de precios o disponibilidad.
const {randomUUID}=require('node:crypto');
const pin=require('../lib/uki-inventario-pin-live.cjs');
const {url:liveDbUrl}=require('../lib/uki-inventario-db-live.cjs');
const core=require('../lib/uki-inventario-core-live.cjs');
const leerInventario=core.listar;
const extra=require('../lib/uki-inventario-extras-live.cjs');
const unidades=require('../lib/uki-inventario-unidades-live.cjs');
const facturas=require('../lib/uki-inventario-facturas-live.cjs');
const altasFactura=require('../lib/uki-inventario-factura-altas-live.cjs');
const PROJECT='uki-panel-f4909';
const BRANCHES=new Set(['arica','serena']);
const BRANCH_NAME={arica:'Regimiento Arica',serena:'La Serena'};
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
// Orígenes exactos. Administración se valida además con token Google autorizado.
const permitido=origin=>new Set([
 'https://uki-sushi-inventario.vercel.app',
 'https://uki-sushi-inventario-diannaleandra-7046.vercel.app',
 'https://diannaleandra-art.github.io'
]).has(String(origin||''));
const nombre=n=>{
 const v=String(n||'').trim().replace(/\s+/g,' ');
 if(v.length<2||v.length>60)throw Object.assign(Error('Indica el nombre de quien revisa'),{status:400});
 return v;
};
const enteroVersion=n=>Number.isSafeInteger(n)&&n>=0;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const fechaHoraChile=fecha=>new Intl.DateTimeFormat('es-CL',{
 timeZone:'America/Santiago',weekday:'long',day:'2-digit',month:'2-digit',
 year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
}).format(new Date(fecha));
function resumen(items){
 const rows=items.map(i=>({
  sku:String(i.sku),name:String(i.name),kind:String(i.kind),stock_qty:Number(i.stock_qty)||0,
  min_stock_qty:Number(i.min_stock_qty)||0,stock_unit:String(i.stock_unit||'un'),
  available:i.available===true
 }));
 const faltan=rows.filter(i=>i.min_stock_qty>0&&i.stock_qty<=i.min_stock_qty).map(i=>({
  nombre:i.name,hay:i.stock_qty,minimo:i.min_stock_qty,
  llevar:Math.round((i.min_stock_qty-i.stock_qty)*1000)/1000,
  unidad:i.stock_unit
 })).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
 const sinMinimo=rows.filter(i=>i.min_stock_qty<=0).length;
 return {items:rows,summary:{
  productos:rows.length,configurados:rows.length-sinMinimo,sinMinimo,
  faltantes:faltan
 }};
}
// Informe de entradas usando el registro existente del servidor, no datos inventados.
// Los conteos reemplazan saldos; nunca se suman como ingresos de mercadería.
async function entradasDesdeUltimaRevision(sql,branch,cutoff,fechaRecuperada){
 if(cutoff===undefined){
  const prev=await sql.query('SELECT created_at FROM public.uki_inventario_revisiones_live WHERE branch=$1 ORDER BY created_at DESC LIMIT 1',[branch]);
  cutoff=prev[0]?.created_at||null;
 }
 const desde="COALESCE($2::timestamptz, date_trunc('day',now() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago')";
 const [catalogo,adicionales]=await Promise.all([
  sql.query("SELECT sku,SUM(cantidad_base) AS recibida FROM public.uki_inventario_movimientos_live WHERE branch=$1 AND accion='entrada' AND creado_en > "+desde+" GROUP BY sku",[branch,cutoff]),
  sql.query("SELECT sku,SUM(quantity) AS recibida FROM public.uki_inventario_extras_movimientos_live WHERE branch=$1 AND action='entrada' AND created_at > "+desde+" GROUP BY sku",[branch,cutoff])
 ]);
 const bySku=new Map();
 for(const item of [...catalogo,...adicionales]){
  const n=Number(item.recibida);
  if(Number.isFinite(n)&&n>=0)bySku.set(String(item.sku),Math.round(n*1000)/1000);
 }
 return {bySku,periodo:fechaRecuperada?'Desde '+fechaRecuperada+' · 00:00 (Chile)':cutoff?'Desde revisión anterior':'Hoy desde 00:00 (Chile)'};
}
// En el primer cierre, no perder el conteo de la noche anterior al cambiar de fecha.
// Solo se ofrece si la bodega aún no tiene cierre y no se empezó otro conteo hoy.
async function primerCierrePendiente(sql,branch){
 const rows=await sql.query(`WITH reloj AS (
   SELECT (now() AT TIME ZONE 'America/Santiago')::date AS hoy
  ), limites AS (
   SELECT hoy, hoy::timestamp AT TIME ZONE 'America/Santiago' AS inicio_hoy,
     (hoy-1)::timestamp AT TIME ZONE 'America/Santiago' AS inicio_ayer
   FROM reloj
  ), conteos AS (
   SELECT creado_en AS fecha FROM public.uki_inventario_movimientos_live,limites
   WHERE branch=$1 AND accion='conteo' AND creado_en>=inicio_ayer
   UNION ALL
   SELECT created_at FROM public.uki_inventario_extras_movimientos_live,limites
   WHERE branch=$1 AND action='conteo' AND created_at>=inicio_ayer
  ) SELECT inicio_ayer AS desde,(hoy-1)::text AS fecha_recuperada FROM limites
  WHERE NOT EXISTS (SELECT 1 FROM conteos WHERE fecha>=inicio_hoy)
    AND EXISTS (SELECT 1 FROM conteos WHERE fecha<inicio_hoy)`,[branch]);
 return rows[0]||null;
}
// Evidencia de conteo desde la revisión anterior. No presume conteo por saldo existente.
async function conteosDesdeUltimaRevision(sql,branch,cutoff){
 if(cutoff===undefined){
  const prev=await sql.query('SELECT created_at FROM public.uki_inventario_revisiones_live WHERE branch=$1 ORDER BY created_at DESC LIMIT 1',[branch]);
  cutoff=prev[0]?.created_at||null;
 }
 const desde="COALESCE($2::timestamptz, date_trunc('day',now() AT TIME ZONE 'America/Santiago') AT TIME ZONE 'America/Santiago')";
 const conteos=(table,dt,action)=>sql.query(`SELECT sku, MAX(${dt}) FILTER (WHERE ${action}='conteo') AS contado_en
  FROM public.${table} WHERE branch=$1 AND ${action} IN ('conteo','entrada') AND ${dt} > ${desde}
  GROUP BY sku HAVING MAX(${dt}) FILTER (WHERE ${action}='conteo') >
  COALESCE(MAX(${dt}) FILTER (WHERE ${action}='entrada'), '-infinity'::timestamptz)`,[branch,cutoff]);
 const [base,extras]=await Promise.all([
  conteos('uki_inventario_movimientos_live','creado_en','accion'),
  conteos('uki_inventario_extras_movimientos_live','created_at','action')
 ]);
 return new Map([...base,...extras].map(r=>[String(r.sku),r.contado_en]));
}
// Consulta de solo lectura con el mismo PIN y la misma bodega que el inventario.
async function flujoCierre(sql,branch){
 const [cierre]=await sql.query(`SELECT id,created_at,worker_name,items,summary
  FROM public.uki_inventario_revisiones_live WHERE branch=$1
  ORDER BY created_at DESC,id DESC LIMIT 1`,[branch]);
 let recovered=null,counts=null;
 try{
  if(!cierre)recovered=await primerCierrePendiente(sql,branch);
  counts=await conteosDesdeUltimaRevision(sql,branch,cierre?.created_at||recovered?.desde||null);
 }catch{}
 return {cierre:cierre||null,conteos:counts?[...counts].map(([sku,fecha])=>({sku,fecha})):null,
  ...(counts?.size&&recovered?{fecha_conteos_recuperada:recovered.fecha_recuperada}:{} )};
}
function textoReporte(branch,worker,summary,fecha){
 const date=fechaHoraChile(fecha);
 const a=['📦 UKI SUSHI · LISTA PARA REPONER','Sucursal: '+BRANCH_NAME[branch],
  'Revisión: '+date,'Responsable: '+worker,''];
 if(!summary.configurados)a.push('Falta configurar los mínimos en Existencias y mínimos.');
 else if(!summary.faltantes.length)a.push('Sin faltantes según los mínimos configurados.');
 else summary.faltantes.forEach((f,i)=>a.push((i+1)+'. '+f.nombre+(f.llevar===0?' · comprar, mínimo alcanzado':' · llevar '+f.llevar+' '+f.unidad)+' (hay '+f.hay+' '+f.unidad+'; mínimo '+f.minimo+' '+f.unidad+')'));
 if(summary.sinMinimo)a.push('','Sin mínimo configurado: '+summary.sinMinimo+' artículos.');
 a.push('','Esta revisión no es un cierre de caja. Disponible/Agotado se controla manualmente.');
 return a.join('\n');
}
async function admin(req) {
 const bearer=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!bearer||bearer.startsWith('UKIDEV1.'))return null;
 const {createRemoteJWKSet,jwtVerify}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(bearer,jwks,{issuer:'https://securetoken.google.com/'+PROJECT,
  audience:PROJECT,algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const uids=String(process.env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const emails=String(process.env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 return uids.includes(payload.sub)||payload.email_verified===true&&emails.includes(String(payload.email||'').toLowerCase())?String(payload.sub):null;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const origin=String(req.headers?.origin||''),romoOrigin=origin==='https://romos-sushi-panel.vercel.app';
 const allow=permitido(origin)||(romoOrigin&&process.env.UKI_BODEGA_SERENA_COMPARTIDA==='true');
 if(allow){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 }
 if(req.method==='OPTIONS')return res.status(allow?204:403).end();
 if(req.method!=='POST')return fail(res,405,'Método no permitido');
 if(!allow||!pin.habilitado())return fail(res,403,'Inventario no habilitado');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const input=req.body;
 if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>(input.action==='factura-preparar-articulos'?8500:4000))
  return fail(res,400,'Solicitud de inventario inválida');
 const branch=String(input.branch||''),action=String(input.action||'');
 if(!BRANCHES.has(branch))return fail(res,400,'Sucursal no válida');
 if(romoOrigin&&(branch!=='serena'||!['articulos','reportes','historial','revision','crear-articulo','editar-articulo','configurar-unidad'].includes(action)))return fail(res,403,'Romo solo puede administrar la bodega compartida La Serena con Google autorizado.');
 if(!['estado','crear-codigo','listar','contar','recibir','factura-consultar','factura-preparar-articulos','factura-recibir','finalizar','reportes','historial','revision','articulos','crear-articulo','editar-articulo','configurar-unidad','justificar','crear-insumo-trabajador','movimientos-trabajador','revisiones-trabajador','revision-trabajador','guardar-minimo-trabajador'].includes(action))
  return fail(res,400,'Acción no permitida');
 const dbUrl=liveDbUrl();
 if(!dbUrl)return fail(res,503,'Base de inventario no habilitada');
 let sql;
 try{sql=require('@neondatabase/serverless').neon(dbUrl);}
 catch{return fail(res,503,'Base de inventario no disponible');}
 let etapa='autorizacion';
 try{
  if(['estado','crear-codigo','reportes','historial','revision','articulos','crear-articulo','editar-articulo','configurar-unidad'].includes(action)){
   const uid=await admin(req).catch(()=>null);
   if(!uid)return fail(res,403,'Solo administración autorizada');
   if(action==='estado')return res.status(200).json({ok:true,configurado:!!(await pin.consultar(sql))});
   if(action==='crear-codigo'){
    if(await pin.consultar(sql))return fail(res,409,'Ya existe un código de inventario. No se reemplazó.');
    const created=pin.crear(input.codigo);
    const result=await sql.query(`INSERT INTO public.uki_inventario_pin_live
     (id,salt,hash,created_by) VALUES(1,$1,$2,$3)
     ON CONFLICT(id) DO NOTHING RETURNING id`,[created.salt,created.hash,uid]);
    return result.length?res.status(201).json({ok:true,configurado:true}):
     fail(res,409,'El código ya fue configurado');
   }
   if(action==='articulos'){
    const [catalog,added]=await Promise.all([leerInventario(sql,branch),extra.listar(sql,branch)]);
    return res.status(200).json({ok:true,branch,items:[...catalog.filter(x=>x.kind==='ingredient').map(i=>({sku:i.sku,name:i.name,kind:i.kind,stock_unit:i.stock_unit,stock_qty:i.stock_qty,min_stock_qty:i.min_stock_qty,version:i.version,inventory_only:false})),...added]});
   }
   if(action==='crear-articulo'){
    const item=await extra.crear(sql,branch,input.item,uid);
    return res.status(201).json({ok:true,branch,item});
   }
   if(action==='editar-articulo'){
    const sku=String(input.sku||'');
    if(!/^inv:[a-f0-9-]{36}$/.test(sku))return fail(res,400,'Artículo de inventario no válido');
    const item=await extra.editar(sql,branch,sku,input.item,input.expected_version,uid);
    return res.status(200).json({ok:true,branch,item});
   }
   if(action==='configurar-unidad'){
    const sku=String(input.sku||'');
    if(!/^ingredient:[a-z0-9-]{3,105}$/.test(sku))return fail(res,400,'Ingrediente no válido');
    const next=extra.crearDatos({name:'Validación ingrediente',stock_unit:input.stock_unit,stock_qty:input.stock_qty,min_stock_qty:input.min_stock_qty});
    const item=await core.configurar(sql,branch,sku,{stock_unit:next.stock_unit,stock_qty:next.stock_qty,min_stock_qty:next.min_stock_qty},input.expected_version,uid);
    return res.status(200).json({ok:true,branch,item:{sku:item.sku,name:item.name,kind:item.kind,stock_unit:item.stock_unit,stock_qty:item.stock_qty,min_stock_qty:item.min_stock_qty,version:item.version,inventory_only:false}});
   }
   if(action==='revision'){
    const id=String(input.id||'');
    if(!/^[a-zA-Z0-9-]{1,60}$/.test(id))return fail(res,400,'Revisión inválida');
    const rows=await sql.query(`SELECT id,worker_name,summary,items,created_at
     FROM public.uki_inventario_revisiones_live WHERE branch=$1 AND id::text=$2 LIMIT 1`,[branch,id]);
    if(!rows.length)return fail(res,404,'Revisión no encontrada en esta sucursal');
    return res.status(200).json({ok:true,branch,revision:rows[0]});
   }
   if(action==='historial'){
    const from=input.desde==null?'':String(input.desde),to=input.hasta==null?'':String(input.hasta);
    const worker=input.trabajador==null?'':String(input.trabajador).trim();
    const offset=input.offset??0;
    if((from&&!validDate(from))||(to&&!validDate(to))||(from&&to&&from>to)||
     worker.length>60||!Number.isSafeInteger(offset)||offset<0||offset>100000)
     return fail(res,400,'Filtros del historial inválidos');
    const rows=await sql.query(`SELECT id,worker_name,summary,created_at,
       COUNT(*) OVER ()::int AS total
      FROM public.uki_inventario_revisiones_live WHERE branch=$1
       AND ($2::text='' OR (created_at AT TIME ZONE 'America/Santiago')::date >= NULLIF($2::text,'')::date)
       AND ($3::text='' OR (created_at AT TIME ZONE 'America/Santiago')::date <= NULLIF($3::text,'')::date)
       AND ($4::text='' OR worker_name ILIKE '%' || $4 || '%')
      ORDER BY created_at DESC,id DESC LIMIT 25 OFFSET $5`,
      [branch,from,to,worker,offset]);
    return res.status(200).json({ok:true,branch,revisiones:rows.map(({total,...r})=>r),
     total:rows.length?Number(rows[0].total):0,offset,limite:25});
   }
   const rows=await sql.query(`SELECT id,worker_name,summary,created_at
     FROM public.uki_inventario_revisiones_live WHERE branch=$1
     ORDER BY created_at DESC LIMIT 20`,[branch]);
   return res.status(200).json({ok:true,branch,revisiones:rows});
  }
  // Las mismas tres operaciones de factura se pueden realizar desde el
  // panel normal con Google autorizado, sin pedir el PIN del trabajador.
  // Todo lo demás conserva las restricciones y roles anteriores.
  const desdePanel=action==='factura-consultar'||action==='factura-preparar-articulos'||
   action==='factura-recibir';
  let worker;
  etapa='verificando-codigo';
  if(desdePanel&&req.headers?.authorization){
   const uid=await admin(req).catch(()=>null);
   if(!uid)return fail(res,403,'Solo administración Google autorizada.');
   worker='Administración Google · '+uid.slice(0,10);
  }else{
   // El trabajador sigue entrando exclusivamente con su código de inventario.
   // Nunca recibe permisos de pedidos, caja, ni acceso Google de administración.
   worker=nombre(input.worker_name);
   if(input.acceso==='romo'){
    if(branch!=='serena'||process.env.UKI_BODEGA_SERENA_COMPARTIDA!=='true')return fail(res,403,'Acceso Romo disponible únicamente en la bodega compartida La Serena.');
    if(!/^\d{6}$/.test(String(input.codigo||'')))return fail(res,400,'Código de inventario inválido.');
    const resp=await fetch('https://romos-sushi-panel.vercel.app/api/romo-pin-inventario-qa',{method:'POST',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json',Origin:'https://romos-sushi-panel.vercel.app'},body:JSON.stringify({action:'verificar-bodega-compartida',codigo:input.codigo,worker_name:worker}),signal:AbortSignal.timeout(8000)});
    const verified=await resp.json().catch(()=>null);
    if(!resp.ok||verified?.authorized!==true||verified.storeId!=='romo:serena'||verified.warehouse!=='serena')return fail(res,403,'Código Romo no autorizado o temporalmente bloqueado.');
   }else if(input.acceso!=null&&input.acceso!=='uki')return fail(res,403,'Acceso de inventario inválido.');
   else if(!await pin.autorizar(sql,input.codigo,branch,'inventario-compartido'))
    return fail(res,403,'Código incorrecto o temporalmente bloqueado');
  }
  etapa='consulta-catalogo';
  if(action==='guardar-minimo-trabajador'){
   const sku=String(input.sku||'');
   const esInsumo=/^inv:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(sku);
   if(!esInsumo&&!/^ingredient:[a-z0-9-]{3,105}$/.test(sku))return fail(res,400,'Artículo no válido.');
   etapa='guardar-minimo';
   const service=esInsumo?extra:core;
   const item=await service.guardarMinimo(sql,branch,sku,input.min_stock_qty,input.expected_version,worker);
   return res.status(200).json({ok:true,branch,item});
  }
  if(action==='movimientos-trabajador'){
   const [base,added]=await Promise.all([leerInventario(sql,branch),extra.listar(sql,branch)]);
   const report=await require('../lib/inventario-movimientos-reporte-v1.cjs').read(sql,branch,input,[...base,...added],process.env.UKI_INVENTARIO_JUSTIFICACIONES_ENABLED==='true');
   return res.status(200).json({ok:true,...report});
  }
  if(action==='revisiones-trabajador'){
   const {desde,hasta}=require('../lib/inventario-movimientos-reporte-v1.cjs').range({...input,tipo:'todos'});
   const rows=await sql.query("SELECT id,worker_name,summary,created_at FROM public.uki_inventario_revisiones_live WHERE branch=$1 AND (created_at AT TIME ZONE 'America/Santiago')::date BETWEEN $2::date AND $3::date ORDER BY created_at DESC,id DESC LIMIT 201",[branch,desde,hasta]);
   if(rows.length>200)return fail(res,400,'Consulta un período más corto.');
   return res.status(200).json({ok:true,branch,revisiones:rows});
  }
  if(action==='revision-trabajador'){
   const id=String(input.id||'');
   if(!/^[a-zA-Z0-9-]{1,60}$/.test(id))return fail(res,400,'Revisión inválida.');
   const rows=await sql.query('SELECT id,worker_name,summary,items,created_at FROM public.uki_inventario_revisiones_live WHERE branch=$1 AND id::text=$2 LIMIT 1',[branch,id]);
   if(!rows.length)return fail(res,404,'Revisión no encontrada en esta bodega.');
   return res.status(200).json({ok:true,branch,reporte:{branch,...rows[0]}});
  }
  if(action==='crear-insumo-trabajador'){
   // Alta exclusivamente de inventario con el PIN habitual. Reutiliza el
   // servicio de artículos adicionales; el primer conteo se guarda aparte.
   const data=extra.crearDatos({...input.item,stock_qty:0,min_stock_qty:0});
   const [base,added]=await Promise.all([leerInventario(sql,branch),extra.listar(sql,branch)]);
   const same=[...base,...added].find(x=>altasFactura.normalizar(x.name)===altasFactura.normalizar(data.name));
   if(same)return fail(res,409,'Ya existe «'+same.name+'». Busca el artículo antes de crear otro.');
   const item=await extra.crear(sql,branch,data,worker);
   return res.status(201).json({ok:true,branch,item});
  }
  if(action==='listar'){
   const [data,added,flujo]=await Promise.all([
    leerInventario(sql,branch),extra.listar(sql,branch),
    input.flujo_cierre===true?flujoCierre(sql,branch).catch(()=>null):null
   ]);
   return res.status(200).json({ok:true,branch,...(input.flujo_cierre===true?{flujo}:{}),bodegaCompartida:process.env.UKI_BODEGA_SERENA_COMPARTIDA==='true',items:[...data.map(i=>({
    sku:i.sku,kind:i.kind,group_key:i.group_key,name:i.name,available:i.available,
    stock_qty:i.stock_qty,stock_unit:i.stock_unit,min_stock_qty:i.min_stock_qty,version:i.version
   })),...added]});
  }
  // Facturas independientes: el PIN de inventario autoriza la lectura y la recepción;
  // la DB bloquea la misma línea/entrega entre celulares.
  if(action==='factura-consultar'){
   const doc=facturas.identidad(input);
   const [lineas,entregas]=await Promise.all([
    sql.query("SELECT linea,descripcion,sku,unidad_base,cantidad_factura_base,cantidad_recibida_base FROM public.uki_factura_lineas_live WHERE branch=$1 AND rut_emisor=$2 AND tipo_doc=$3 AND folio=$4 ORDER BY linea",[branch,doc.rut,doc.tipo,doc.folio]),
    sql.query("SELECT linea,entrega,cantidad_base,unidad_original,cantidad_original,creado_en FROM public.uki_factura_recepciones_live WHERE branch=$1 AND rut_emisor=$2 AND tipo_doc=$3 AND folio=$4 ORDER BY linea,entrega",[branch,doc.rut,doc.tipo,doc.folio])
   ]);
   return res.status(200).json({ok:true,branch,lineas,entregas});
  }
  if(action==='factura-preparar-articulos'){
   // PIN exclusivo de inventario: sólo crea artículos con cero existencias.
   const [catalog,existingExtras]=await Promise.all([leerInventario(sql,branch),extra.listar(sql,branch)]);
   const result=await altasFactura.preparar(sql,branch,input,worker,catalog,existingExtras);
   return res.status(200).json({ok:true,branch,...result});
  }
  if(action==='factura-recibir'){
   const sku=String(input.sku||'');
   if(!/^[a-z0-9:-]{3,120}$/.test(sku))return fail(res,400,'Artículo inválido.');
   const extraItem=sku.startsWith('inv:');
   const catalog=extraItem?await extra.listar(sql,branch):await leerInventario(sql,branch);
   const item=catalog.find(x=>x.sku===sku);
   if(!item)return fail(res,404,'Artículo no encontrado en esta sucursal.');
   const d=facturas.linea(input,item);
   const args=[branch,d.rut,d.tipo,d.folio,d.index,d.description,sku,
     d.cantidad,d.unidad,d.amount,d.limit,input.expected_version,worker,d.entrega,d.request];
   const rows=await sql.query(
    "SELECT public.uki_factura_recibir_live($1::text,$2::text,$3::text,$4::text,$5::integer,$6::text,$7::text,$8::numeric,$9::text,$10::numeric,$11::numeric,$12::integer,$13::text,$14::integer,$15::uuid) AS resultado",args);
   const saved=rows[0]?.resultado;
   if(!saved?.guardada)return fail(res,503,'No se pudo verificar el ingreso de la factura.');
   return res.status(200).json({ok:true,branch,...saved});
  }
  if(action==='justificar'){
   if(process.env.UKI_INVENTARIO_JUSTIFICACIONES_ENABLED!=='true')return fail(res,503,'Registro de movimientos aún no habilitado.');
   const sku=String(input.sku||''),list=sku.startsWith('inv:')?await extra.listar(sql,branch):await leerInventario(sql,branch);
   const item=list.find(x=>x.sku===sku);
   if(!item||!['ingredient','inventory'].includes(item.kind))return fail(res,404,'Insumo no encontrado en esta sucursal.');
   const lib=require('../lib/inventario-justificaciones-v1.cjs');
   if(process.env.UKI_BODEGA_SERENA_COMPARTIDA==='true'&&input.contraparte==='romo:serena')
    return fail(res,400,'Uki y Romo La Serena comparten bodega. Selecciona La Serena o Regimiento.');
   const data=lib.validate('uki:'+branch,input,item,worker);
   return res.status(200).json({...await lib.save(sql,data),branch});
  }
  if(action==='contar'||action==='recibir'){
   const sku=String(input.sku||''),n=input.cantidad;
   if(!/^[a-z0-9:-]{3,120}$/.test(sku)||!enteroVersion(input.expected_version))
    return fail(res,400,'Cantidad o artículo no válido');
   const esInsumo=sku.startsWith('inv:');
   const listado=esInsumo?await extra.listar(sql,branch):await leerInventario(sql,branch);
   const actual=listado.find(i=>i.sku===sku);
   if(!actual)return fail(res,404,'Artículo no encontrado en esta sucursal.');
   if(Number(actual.version)!==input.expected_version)
    return fail(res,409,'El inventario cambió. Actualiza antes de guardar.');
   const unidadOrigen=String(input.unidad||actual.stock_unit||'');
   const base=unidades.convertir(n,unidadOrigen,actual.stock_unit);
   if(action==='recibir'&&base===0)return fail(res,400,'La entrada debe ser mayor que cero.');
   const detalle={cantidad:n,unidad:unidadOrigen,base,unidadBase:actual.stock_unit};
   etapa='guardar-movimiento';
   if(esInsumo){
    const item=await extra.guardarMovimiento(sql,branch,sku,action==='contar'?'conteo':'entrada',base,input.expected_version,worker,detalle);
    return res.status(200).json({ok:true,branch,item,registro:detalle});
   }
   const result=await core.guardarMovimiento(sql,branch,sku,action==='contar'?'conteo':'entrada',
    base,input.expected_version,worker,detalle);
   return res.status(200).json({ok:true,branch,registro:detalle,item:{
    sku:result.sku,stock_qty:result.stock_qty,stock_unit:result.stock_unit,
    available:result.available,min_stock_qty:result.min_stock_qty,version:result.version
   }});
  }
  // El informe se calcula EN EL SERVIDOR sobre el stock vigente, nunca sobre
  // una lista libre enviada desde el navegador.
  const requestId=String(input.request_id||'');
  if(!/^[a-f0-9-]{36}$/.test(requestId))return fail(res,400,'Código de revisión inválido');
  const indicada=input.fecha_conteos_recuperada??null;
  if(indicada!==null&&!validDate(indicada))return fail(res,400,'Fecha de conteos inválida.');
  const [prev]=await sql.query('SELECT id,request_id,worker_name,items,summary,created_at FROM public.uki_inventario_revisiones_live WHERE branch=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[branch]);
  if(prev&&String(prev.request_id)===requestId)return responderCierre(res,branch,worker,prev);
  const periodo=prev?null:await primerCierrePendiente(sql,branch);
  const cutoff=prev?.created_at||periodo?.desde||null;
  const counts=await conteosDesdeUltimaRevision(sql,branch,cutoff).catch(()=>null);
  const recuperada=counts?.size&&periodo?periodo.fecha_recuperada:null;
  if(indicada!==recuperada)return fail(res,409,'Cambió el período de los conteos. Vuelve a abrir el inventario y revisa el cierre.');
  const [catalog,added]=await Promise.all([leerInventario(sql,branch),extra.listar(sql,branch)]);
  const data=resumen([...catalog,...added]);
  // Solo enriquecemos la copia del informe. No se actualizan existencias ni caja.
  try{
   const entradas=await entradasDesdeUltimaRevision(sql,branch,cutoff,recuperada);
   data.items=data.items.map(item=>({...item,received_qty:entradas.bySku.get(item.sku)||0}));
   data.summary.entradas_periodo=entradas.periodo;
   data.summary.entradas_verificadas=true;
   data.summary.articulos_con_entradas=[...entradas.bySku.values()].filter(q=>q>0).length;
  }catch{
   // Si falta un registro histórico, no afirmar que hubo cero entradas.
   data.summary.entradas_periodo='No verificadas';
   data.summary.entradas_verificadas=false;
  }
  // Se consulta evidencia de catálogo y artículos adicionales.
  if(counts){
   data.items=data.items.map(i=>({...i,conteo_registrado:counts.has(i.sku),conteo_fecha:counts.get(i.sku)||null}));
   data.summary.conteos_verificados=true;
   data.summary.articulos_sin_conteo=data.items.filter(i=>!i.conteo_registrado).length;
   if(recuperada)data.summary.fecha_conteos_recuperada=recuperada;
  }else data.summary.conteos_verificados=false;
  const created=await sql.query(`INSERT INTO public.uki_inventario_revisiones_live
   (branch,request_id,worker_name,identity,items,summary)
   VALUES($1,$2::uuid,$3,$4,$5::jsonb,$6::jsonb)
   ON CONFLICT(branch,request_id) DO NOTHING
   RETURNING id,created_at,worker_name,items,summary`,
   [branch,requestId,worker,'inventario:codigo-live',JSON.stringify(data.items),JSON.stringify(data.summary)]);
  const result=created.length?created[0]:
    (await sql.query(`SELECT id,created_at,worker_name,items,summary FROM public.uki_inventario_revisiones_live
      WHERE branch=$1 AND request_id=$2::uuid LIMIT 1`,[branch,requestId]))[0];
  if(!result)return fail(res,409,'No se pudo confirmar el guardado; no reenvíes sin comprobar');
  return responderCierre(res,branch,worker,result);
 }catch(e){
  const status=e?.status||(['23505','40001','P0001'].includes(e?.code)?409:e?.code==='22023'?400:(String(e?.message||'').includes('código')?400:503));
  // Solo identificador de etapa: no mostrar SQL, datos ni el código privado.
  const etiqueta=etapa==='guardar-minimo'?'INV-MIN':etapa==='guardar-movimiento'?'INV-GUARDAR':etapa==='consulta-catalogo'?'INV-CAT':etapa==='verificando-codigo'?'INV-PIN':'INV-API';
  console.error('Inventario LIVE error etapa',etiqueta,'tipo',String(e?.code||e?.name||'error').slice(0,70));
  return fail(res,status,status===503?
   (etapa==='guardar-minimo'?'No se pudo confirmar el mínimo.':etapa==='guardar-movimiento'?'No se pudo confirmar el movimiento.':'No se pudo abrir el inventario.')+' ('+etiqueta+').':String(e.message));
 }
};
function responderCierre(res,branch,worker,result){
 const summary=result.summary||{}, responsable=result.worker_name||worker;
 return res.status(200).json({ok:true,branch,id:result.id,fecha:result.created_at,guardado:true,
  mensaje:textoReporte(branch,responsable,summary,result.created_at),
  reporte:{branch,created_at:result.created_at,worker_name:responsable,items:result.items||[],summary}});
}
module.exports._testing={permitido,admin,resumen,textoReporte,validDate,fechaHoraChile,entradasDesdeUltimaRevision,conteosDesdeUltimaRevision,flujoCierre,primerCierrePendiente};
