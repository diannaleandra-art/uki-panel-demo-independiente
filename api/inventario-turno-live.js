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
const permitido=origin=>new Set(['https://uki-sushi-inventario.vercel.app','https://uki-sushi-inventario-diannaleandra-7046.vercel.app']).has(String(origin||''));
const nombre=n=>{
 const v=String(n||'').trim().replace(/\s+/g,' ');
 if(v.length<2||v.length>60)throw Object.assign(Error('Indica el nombre de quien revisa'),{status:400});
 return v;
};
const enteroVersion=n=>Number.isSafeInteger(n)&&n>=0;
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
function textoReporte(branch,worker,summary,fecha){
 const date=new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(fecha));
 const a=['📦 UKI SUSHI · LISTA PARA REPONER','Sucursal: '+BRANCH_NAME[branch],
  'Revisión: '+date,'Responsable: '+worker,''];
 if(!summary.configurados)a.push('Falta configurar los mínimos desde administración.');
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
 const origin=String(req.headers?.origin||''),allow=permitido(origin);
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
 if(!['estado','crear-codigo','listar','contar','recibir','factura-consultar','factura-preparar-articulos','factura-recibir','finalizar','reportes','articulos','crear-articulo','editar-articulo','configurar-unidad'].includes(action))
  return fail(res,400,'Acción no permitida');
 const dbUrl=liveDbUrl();
 if(!dbUrl)return fail(res,503,'Base de inventario no habilitada');
 let sql;
 try{sql=require('@neondatabase/serverless').neon(dbUrl);}
 catch{return fail(res,503,'Base de inventario no disponible');}
 let etapa='autorizacion';
 try{
  if(['estado','crear-codigo','reportes','articulos','crear-articulo','editar-articulo','configurar-unidad'].includes(action)){
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
   const rows=await sql.query(`SELECT id,worker_name,summary,created_at
     FROM public.uki_inventario_revisiones_live WHERE branch=$1
     ORDER BY created_at DESC LIMIT 20`,[branch]);
   return res.status(200).json({ok:true,branch,revisiones:rows});
  }
  // A diferencia del agendador, el inventarista nunca recibe un token para
  // mesas/pedidos, ni el catálogo acepta este código como rol administrador.
  const worker=nombre(input.worker_name);
  etapa='verificando-codigo';
  if(!await pin.autorizar(sql,input.codigo,branch,'inventario-compartido'))
   return fail(res,403,'Código incorrecto o temporalmente bloqueado');
  etapa='consulta-catalogo';
  if(action==='listar'){
   const [data,added]=await Promise.all([leerInventario(sql,branch),extra.listar(sql,branch)]);
   return res.status(200).json({ok:true,branch,items:[...data.map(i=>({
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
  const [catalog,added]=await Promise.all([leerInventario(sql,branch),extra.listar(sql,branch)]);
  const data=resumen([...catalog,...added]);
  const created=await sql.query(`INSERT INTO public.uki_inventario_revisiones_live
   (branch,request_id,worker_name,identity,items,summary)
   VALUES($1,$2::uuid,$3,$4,$5::jsonb,$6::jsonb)
   ON CONFLICT(branch,request_id) DO NOTHING
   RETURNING id,created_at`,
   [branch,requestId,worker,'inventario:codigo-live',JSON.stringify(data.items),JSON.stringify(data.summary)]);
  const result=created.length?created[0]:
    (await sql.query(`SELECT id,created_at,worker_name,summary FROM public.uki_inventario_revisiones_live
      WHERE branch=$1 AND request_id=$2::uuid LIMIT 1`,[branch,requestId]))[0];
  if(!result)return fail(res,409,'No se pudo confirmar el guardado; no reenvíes sin comprobar');
  const summary=result.summary||data.summary;
  const reportText=textoReporte(branch,result.worker_name||worker,summary,result.created_at);
  return res.status(200).json({ok:true,branch,id:result.id,
   fecha:result.created_at,guardado:true,mensaje:reportText});
 }catch(e){
  const status=e?.status||(['23505','40001','P0001'].includes(e?.code)?409:e?.code==='22023'?400:(String(e?.message||'').includes('código')?400:503));
  // Solo identificador de etapa: no mostrar SQL, datos ni el código privado.
  const etiqueta=etapa==='consulta-catalogo'?'INV-CAT':etapa==='verificando-codigo'?'INV-PIN':'INV-API';
  console.error('Inventario LIVE error etapa',etiqueta,'tipo',String(e?.code||e?.name||'error').slice(0,70));
  return fail(res,status,status===503?'No se pudo abrir el inventario de pruebas ('+etiqueta+'). No se modificó la caja.':String(e.message));
 }
};
module.exports._testing={permitido,admin,resumen,textoReporte};
