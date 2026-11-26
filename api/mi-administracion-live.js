'use strict';
/* Mi Administración · servicio privado de dueños aislado de pedidos y caja Uki.
   Acceso: Google autorizado + PIN exclusivo de finanzas; primer PIN exige clave
   de instalación privada en Vercel, con lectura protegida por PIN. */
const crypto=require('node:crypto');
const MAX_BYTES=1700000;
const MODES=new Set(['venta','gasto','compra','costo_producto','retiro','ingreso_extra']);
// Fuente única del precio público de carta. Aislada de escrituras de carta y caja.
const CARTA_LOCAL_OFICIAL=Object.freeze({
 '47278e71-42d5-4156-8d07-6d1d2101d50b':{biz:'6ba9065d-6031-46af-bc76-22f04b009397',brand:'uki',branch:'arica'},
 '94560de2-f0dd-4ea3-8a9c-b84dc7787cdc':{biz:'6ba9065d-6031-46af-bc76-22f04b009397',brand:'uki',branch:'serena'},
 'e8c2323c-030c-48c6-8861-64029df112fe':{biz:'ce130c9c-b2fc-4bff-9d70-41badf4778a4',brand:'romo',branch:'serena'}
});
function mapProductoCarta(p){
 if(!p||typeof p!=='object'||Array.isArray(p))return null;
 const sku=String(p.sku||''),nombre=String(p.name||'').trim();
 const price=Number(p.precioFinal??p.price);
 if(!sku||sku.length>180||nombre.length<2||nombre.length>120||
    !Number.isSafeInteger(price)||price<=0||price>1000000||
    p.available===false||p.visible===false||p.archived===true)return null;
 const config=p.config||p,kind=String(p.kind||''),n=Number(sku.split(':')[1]);
 let rolls=null;
 if(['classic','premium'].includes(kind)&&Number.isSafeInteger(n)&&n>0&&
    n%(kind==='classic'?12:10)===0)rolls=n/(kind==='classic'?12:10);
 else if(kind==='monthly'&&config.promoType!=='gohan'&&config.promoType!=='pizza'&&
         config.promoType!=='combo'){
  const count=Number(config.rollCount),size=Number(config.size),pieces=Number(config.piecesPerRoll);
  if(Number.isSafeInteger(count)&&count>0)rolls=count;
  else if(Number.isSafeInteger(size)&&Number.isSafeInteger(pieces)&&pieces>0&&size%pieces===0)rolls=size/pieces;
 }
 if(rolls===null&&['dish','extra','topping'].includes(kind))rolls=1;
 if(rolls!==null&&(!Number.isSafeInteger(rolls)||rolls<1||rolls>100))rolls=null;
 const pieces=kind==='classic'?12:kind==='premium'?10:
  kind==='monthly'&&Number.isSafeInteger(Number(config.piecesPerRoll))?
   Number(config.piecesPerRoll):null;
 const piecesPerRoll=pieces!==null&&pieces>=8&&pieces<=16?pieces:null;
 return {sku,name:nombre,price,kind,rolls,piecesPerRoll};
}
async function obtenerCartaCosto(req,negocio,sucursal){
 const local=CARTA_LOCAL_OFICIAL[String(sucursal||'')];
 if(!local||local.biz!==negocio)throw Error('Este local no tiene carta oficial vinculada al costeo.');
 let url,headers={Accept:'application/json'};
 if(local.brand==='uki')url='https://uki-sushi-inventario.vercel.app/api/uki-carta-precios-live?branch='+local.branch;
 else{
  url='https://romos-sushi-panel.vercel.app/api/romo-carta-ediciones-seguras-qa';
  const bearer=String(req.headers.authorization||'');
  if(!/^Bearer [A-Za-z0-9_.-]+$/.test(bearer))throw Error('Vuelve a confirmar el acceso a Romo.');
  headers={...headers,Authorization:bearer,Origin:'https://romos-sushi-panel.vercel.app'};
 }
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),9000);
 let data;
 try{
  const response=await fetch(url,{method:'GET',cache:'no-store',redirect:'error',headers,signal:ctrl.signal});
  if(!response.ok)throw Error('La carta oficial no devolvió un precio confirmado.');
  const raw=await response.text();
  if(raw.length>500000)throw Error('Respuesta de carta inválida.');
  data=JSON.parse(raw);
 }finally{clearTimeout(timer)}
 if(!data||data.ok!==true)throw Error('La carta oficial no confirmó el catálogo.');
 let items;
 if(local.brand==='uki'){
  if(data.branch!==local.branch||!Array.isArray(data.items))throw Error('Sucursal de la carta no coincide.');
  items=data.items;
 }else{
  if(data.storeId!=='romo:serena'||!Array.isArray(data.products)||
     !Array.isArray(data.publishedPromotions))throw Error('La carta Romo no confirmó sus productos.');
  const retirados=new Set(data.archivedProducts||[]),categorias=new Set(data.archivedCategories||[]);
  items=[...data.products,...data.publishedPromotions].filter(p=>
   !retirados.has(p.sku)&&!categorias.has(p.categoriaSlug));
 }
 const mapped=items.map(mapProductoCarta).filter(Boolean);
 if(!mapped.length||mapped.length>500)throw Error('La carta no devolvió productos vigentes.');
 if(new Set(mapped.map(x=>x.sku)).size!==mapped.length)throw Error('Identificadores duplicados en la carta.');
 return {store:local.brand+':'+local.branch,items:mapped};
}

const PAYMENTS=new Set(['Efectivo','Transferencia','Débito','Crédito','Edenred','Junaeb','Uber','Rappi','PedidosYa','Otro']);
const DOC_TYPES=new Set(['factura','boleta','cierre','comprobante','otro']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const day=/^\d{4}-\d{2}-\d{2}$/;
const pinRegex=/^\d{6}$/;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const ok=(res,data)=>res.status(200).json({ok:true,...data});
const fail=(res,status,msg)=>res.status(status).json({ok:false,error:msg});
const text=(v,max=150)=>String(v??'').trim().slice(0,max);
const validDate=d=>typeof d==='string'&&day.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000000;
const envOk=(e=process.env)=>e.VERCEL_ENV==='production'&&e.UKI_FIN_PRIVATE_ENABLED==='true';
function dbUrl(e=process.env){
 if(!envOk(e))return null;
 // Reusar exclusivamente la conexión QA ya habilitada, nunca producción.
 const candidate=e.UKI_FIN_PRIVATE_DATABASE_URL; // Rama privada separada de pedidos.
 if(!candidate)return null;
 let url;try{url=new URL(candidate)}catch{return null}
 if(!['postgres:','postgresql:'].includes(url.protocol))return null;
 const hosts=new Set(['ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech',
  'ep-silent-cloud-b57g2l4g-pooler.c-7.us-east-2.aws.neon.tech']);
 return hosts.has(url.hostname)?candidate:null;
}
async function google(req,e=process.env){
 const bearer=String(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!bearer||bearer.startsWith('UKIDEV1.'))return null;
 const {jwtVerify,createRemoteJWKSet}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(bearer,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com'||!payload.email_verified)return null;
 const emails=String(e.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
 if(!emails.includes(String(payload.email||'').toLowerCase()))return null;
 return {uid:String(payload.sub),email:String(payload.email).toLowerCase()};
}
const equal=(a,b)=>{const x=Buffer.from(hash(String(a)),'hex'),y=Buffer.from(hash(String(b)),'hex');return crypto.timingSafeEqual(x,y)};
const pwdHash=(p,salt)=>crypto.pbkdf2Sync(p,Buffer.from(salt,'hex'),220000,32,'sha256').toString('hex');
async function authorized(sql,req,who){
 const session=String(req.headers['x-fin-session']||'');
 if(!/^[0-9a-f]{64}$/i.test(session))return false;
 const rows=await sql.query('SELECT 1 FROM public.fin_sesiones WHERE token_hash=$1 AND usuario_uid=$2 AND expira_en>now() LIMIT 1',[hash(session),who.uid]);
 return rows.length===1;
}
const audit=(sql,what,id,action,who,newData)=>sql.query(
 'INSERT INTO public.fin_auditoria(entidad,entidad_id,accion,nuevo,actor_uid) VALUES ($1,$2,$3,$4::jsonb,$5)',
 [what,String(id),action,JSON.stringify(newData),who.uid]);
async function belongs(sql,b,s){
 if(!uuid.test(String(b||'')))throw Error('Selecciona un negocio válido.');
 const business=await sql.query('SELECT id,nombre FROM public.fin_negocios WHERE id=$1 AND activo=true',[b]);
 if(!business.length)throw Error('Negocio no encontrado.');
 if(s){
  if(!uuid.test(String(s)))throw Error('Sucursal inválida.');
  const rows=await sql.query('SELECT id FROM public.fin_sucursales WHERE id=$1 AND negocio_id=$2 AND activo=true',[s,b]);
  if(!rows.length)throw Error('La sucursal no pertenece a este negocio.');
 }
}
function checkMethods(methods){
 if(!methods||typeof methods!=='object'||Array.isArray(methods))throw Error('Revisa los medios de pago.');
 const keys=Object.keys(methods);
 if(keys.length>PAYMENTS.size||keys.some(k=>!PAYMENTS.has(k)||!money(methods[k])))throw Error('Medios de pago inválidos.');
 return methods;
}
function mimeOK(data,mime){
 if(mime==='application/pdf')return data.subarray(0,5).toString()==='%PDF-';
 if(mime==='image/jpeg')return data[0]===255&&data[1]===216&&data[2]===255;
 if(mime==='image/png')return data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/webp')return data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP';
 return false;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const origin=String(req.headers.origin||''),self='https://'+String(req.headers.host||'');
 // Exclusivamente los dominios oficiales de los tres locales y este mismo host.
 // Google de dueños y PIN se verifican igualmente para cualquier origen permitido.
 const allowedOrigin=origin==='https://diannaleandra-art.github.io'||
  origin==='https://romos-sushi-panel.vercel.app'||
  origin===self;
 if(allowedOrigin){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Fin-Session');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 }
 if(!envOk())return fail(res,404,'Módulo privado de dueños no habilitado.');
 if(req.method==='OPTIONS')return res.status(allowedOrigin?204:403).end();
 if(req.method!=='POST'||!allowedOrigin)return fail(res,403,'Origen no permitido.');
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return fail(res,415,'Solo JSON.');
 const body=req.body||{};
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2600000)return fail(res,413,'Solicitud demasiado grande.');
 const who=await google(req).catch(()=>null);
 if(!who)return fail(res,403,'Acceso Google no autorizado.');
 const db=dbUrl();
 if(!db)return fail(res,503,'Base privada de dueños no configurada.');
 const sql=require('@neondatabase/serverless').neon(db);
 const action=String(body.action||'');
 try{
  if(action==='estado'){
   const rows=await sql.query('SELECT 1 FROM public.fin_pin_privado WHERE id=1');
   const active=await authorized(sql,req,who);
   return ok(res,{pin_configurado:!!rows.length,autorizado:active});
  }
  if(action==='configurar_pin'){
   if(!pinRegex.test(String(body.pin||'')))return fail(res,400,'Elige un PIN de seis números.');
   const secret=String(process.env.UKI_FIN_PRIVATE_BOOTSTRAP_KEY||'');
   if(secret.length<32||!equal(body.clave_instalacion,secret))return fail(res,403,'Clave de instalación incorrecta.');
   const found=await sql.query('SELECT 1 FROM public.fin_pin_privado WHERE id=1');
   if(found.length)return fail(res,409,'El PIN ya fue configurado.');
   const salt=crypto.randomBytes(16).toString('hex');
   const rows=await sql.query('INSERT INTO public.fin_pin_privado(id,salt,hash) VALUES (1,$1,$2) ON CONFLICT(id) DO NOTHING RETURNING id',[salt,pwdHash(body.pin,salt)]);
   if(!rows.length)return fail(res,409,'Ya existe un PIN privado.');
   await audit(sql,'seguridad','1','pin_inicializado',who,{ok:true});
   return ok(res,{configurado:true});
  }
  if(action==='ingresar_pin'){
   const identity=hash(who.uid).slice(0,45);
   const old=await sql.query('SELECT fallos,bloqueado_hasta FROM public.fin_pin_intentos WHERE identidad=$1',[identity]);
   if(old.length&&old[0].bloqueado_hasta&&new Date(old[0].bloqueado_hasta)>new Date())
    return fail(res,429,'Demasiados intentos. Vuelve a probar después de 15 minutos.');
   if(!pinRegex.test(String(body.pin||'')))return fail(res,403,'PIN inválido.');
   const rows=await sql.query('SELECT salt,hash FROM public.fin_pin_privado WHERE id=1');
   if(!rows.length)return fail(res,409,'El acceso privado aún no se ha configurado.');
   if(!equal(pwdHash(body.pin,rows[0].salt),rows[0].hash)){
    await sql.query("INSERT INTO public.fin_pin_intentos(identidad,fallos,bloqueado_hasta) VALUES($1,1,NULL) ON CONFLICT(identidad) DO UPDATE SET fallos=CASE WHEN fin_pin_intentos.actualizado_en<now()-interval '15 minutes' THEN 1 ELSE LEAST(5,fin_pin_intentos.fallos+1) END,bloqueado_hasta=CASE WHEN fin_pin_intentos.fallos>=4 AND fin_pin_intentos.actualizado_en>now()-interval '15 minutes' THEN now()+interval '15 minutes' ELSE NULL END, actualizado_en=now()",[identity]);
    return fail(res,403,'PIN incorrecto.');
   }
   await sql.query('DELETE FROM public.fin_pin_intentos WHERE identidad=$1',[identity]);
   const token=crypto.randomBytes(32).toString('hex');
   await sql.query("INSERT INTO public.fin_sesiones(token_hash,usuario_uid,expira_en) VALUES($1,$2,now()+interval '30 minutes')",[hash(token),who.uid]);
   return ok(res,{sesion:token,minutos:30});
  }
  if(!await authorized(sql,req,who))return fail(res,401,'Introduce el código privado para continuar.');
  if(action==='guardar_rendimiento_consumo'){
   if(process.env.UKI_CONSUMO_VENTAS_LIVE_ENABLED!=='true')return fail(res,404,'Control de consumo todavía no habilitado.');
   if(!['uki:arica','uki:serena','romo:serena'].includes(body.store))return fail(res,400,'Local inválido.');
   const report=await require('../lib/costeo-admin-resumen-v1.cjs').physicalReport(sql,process.env,req.headers.authorization);
   const local=report.find(r=>r.store===body.store);
   if(!local?.available)return fail(res,409,'Se requiere un conteo físico verificable de este local.');
   const lib=require('../lib/inventario-rendimientos-v1.cjs');
   try{const v=lib.validate(body,local.rows||[]);const saved=await lib.save(sql,v,who.uid);return ok(res,{saved:true,store:v.store,ingredient:v.name,revision:Number(saved.revision)});}
   catch(e){if([400,409].includes(e.status))return fail(res,e.status,e.message);if(e.code==='23505')return fail(res,409,'Este insumo ya tiene otra equivalencia.');throw e;}
  }
  if(action==='resumen_conteos_inventario'){
   if(process.env.UKI_CONSUMO_VENTAS_LIVE_ENABLED!=='true')return fail(res,404,'Control de consumo todavía no habilitado.');
   const locales=await require('../lib/costeo-admin-resumen-v1.cjs').physicalReport(sql,process.env,req.headers.authorization);
   const traspasos=require('../lib/inventario-traspasos-conciliacion-v1.cjs').compareTransfers(locales);
   const compartida=process.env.UKI_BODEGA_SERENA_COMPARTIDA==='true';
   const bodegas=compartida?require('../lib/inventario-bodegas-compartidas-v1.cjs').physicalWarehouses(locales).map(({warehouse,brands,sales})=>({warehouse,brands,sales})):null;
   return ok(res,{locales,traspasos,bodegas,compartida,soloLectura:true,totalesFinancierosModificados:false,coberturaVentasCompleta:false});
  }
  if(action==='resumen_costeo_inventario'){
   if(process.env.UKI_COSTEO_ADMIN_V1_ENABLED!=='true')return fail(res,404,'Rentabilidad de inventario todavía no habilitada.');
   if(!validDate(body.desde)||!validDate(body.hasta)||body.desde>body.hasta)return fail(res,400,'Selecciona fechas válidas.');
   const rows=await require('../lib/costeo-admin-resumen-v1.cjs').report(body.desde,body.hasta);
   return ok(res,{desde:body.desde,hasta:body.hasta,locales:rows,soloLectura:true,totalesFinancierosModificados:false});
  }
  if(action==='listar_cierres'){
   const desde=validDate(body.desde)?body.desde:'2000-01-01';
   const hasta=validDate(body.hasta)?body.hasta:'2099-12-31';
   const branch=String(body.branch||'todos');
   if(!['todos','arica','serena'].includes(branch)||desde>hasta)
    return fail(res,400,'Fechas o sucursal inválidas.');
   const rows=await sql.query(
    "SELECT branch,source_key,turno_ref,fecha_operativa::text AS fecha_operativa,venta_total,"+
    "pedidos,medios,gastos_cierre,delivery_por_pagar,propinas,retiros,actualizado_en"+
    " FROM public.fin_uki_cierres_live_v1 WHERE estado='cerrado'"+
    " AND fecha_operativa BETWEEN $1::date AND $2::date AND ($3='todos' OR branch=$3)"+
    " ORDER BY fecha_operativa DESC,turno_ref DESC LIMIT 250",
    [desde,hasta,branch]);
   return ok(res,{cierres:rows,nota:'Cierres definitivos informativos; no sumarlos a ventas manuales.'});
  }
  if(action==='salir'){
   await sql.query('DELETE FROM public.fin_sesiones WHERE token_hash=$1 AND usuario_uid=$2',[hash(req.headers['x-fin-session']),who.uid]);
   return ok(res,{cerrado:true});
  }
  if(action==='razones_sociales'){
   const reasons=await sql.query('SELECT id,nombre,rut FROM public.fin_razones_sociales WHERE activo=true ORDER BY nombre');
   const links=await sql.query('SELECT nr.negocio_id,nr.razon_social_id FROM public.fin_negocio_razones nr JOIN public.fin_razones_sociales r ON r.id=nr.razon_social_id WHERE r.activo=true');
   return ok(res,{razones:reasons,vinculos:links});
  }
  if(action==='crear_razon_social'){
   const nombre=text(body.nombre,140),rut=text(body.rut,20).toUpperCase();
   if(nombre.length<2||/[\x00-\x1f]/.test(nombre))return fail(res,400,'Escribe el nombre legal de la razón social.');
   if(rut&&!/^[0-9.]{6,13}-[0-9K]$/.test(rut))return fail(res,400,'Revisa el RUT. Ejemplo: 78.165.233-4');
   const biz=body.negocio_id||null;
   if(biz)await belongs(sql,biz,null);
   const repeated=await sql.query('SELECT id,nombre FROM public.fin_razones_sociales WHERE lower(btrim(nombre))=lower($1) LIMIT 1',[nombre]);
   if(repeated.length)return fail(res,409,'Esta razón social ya existe. Selecciónala y vincúlala al negocio.');
   const x=await sql.query('INSERT INTO public.fin_razones_sociales(nombre,rut) VALUES($1,$2) RETURNING id,nombre,rut',[nombre,rut]);
   if(biz)await sql.query('INSERT INTO public.fin_negocio_razones(negocio_id,razon_social_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[biz,x[0].id]);
   await audit(sql,'razon_social',x[0].id,'crear',who,{nombre,rut,negocio_id:biz});
   return ok(res,{razon:x[0]});
  }
  if(action==='vincular_razon_negocio'){
   const biz=body.negocio_id,id=body.razon_social_id;
   await belongs(sql,biz,null);
   if(!uuid.test(String(id||'')))return fail(res,400,'Razón social inválida.');
   const valid=await sql.query('SELECT 1 FROM public.fin_razones_sociales WHERE id=$1 AND activo=true',[id]);
   if(!valid.length)return fail(res,404,'No se encontró la razón social.');
   await sql.query('INSERT INTO public.fin_negocio_razones(negocio_id,razon_social_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[biz,id]);
   await audit(sql,'razon_social',id,'vincular_negocio',who,{negocio_id:biz});
   return ok(res,{vinculado:true});
  }
  if(action==='clasificar_compra'){
   const id=String(body.id||''),razon=String(body.razon_social_id||'');
   if(!uuid.test(id)||!uuid.test(razon))return fail(res,400,'Selecciona una factura y su razón social.');
   const existing=await sql.query("SELECT id,negocio_id,sucursal_id,razon_social_id FROM public.fin_movimientos WHERE id=$1 AND tipo='compra' AND fuente='factura' AND estado<>'anulado'",[id]);
   if(!existing.length)return fail(res,404,'Compra no encontrada.');
   const b=existing[0].negocio_id;
   const linked=await sql.query('SELECT 1 FROM public.fin_negocio_razones nr JOIN public.fin_razones_sociales r ON r.id=nr.razon_social_id WHERE nr.negocio_id=$1 AND nr.razon_social_id=$2 AND r.activo=true',[b,razon]);
   if(!linked.length)return fail(res,400,'Vincula primero la razón social a ese negocio.');
   const local=body.sucursal_id;
   if(local!==undefined&&local!==null&&local!=='')await belongs(sql,b,local);
   const nextLocal=local===undefined?existing[0].sucursal_id:(local||null);
   await sql.query('UPDATE public.fin_movimientos SET razon_social_id=$2,sucursal_id=$3,actualizado_en=now() WHERE id=$1',[id,razon,nextLocal]);
   await sql.query('UPDATE public.fin_documentos SET razon_social_id=$2,sucursal_id=$3 WHERE movimiento_id=$1',[id,razon,nextLocal]);
   await audit(sql,'compra',id,'reclasificar',who,{desde:existing[0].razon_social_id,hasta:razon,sucursal_anterior:existing[0].sucursal_id,sucursal_nueva:nextLocal});
   return ok(res,{actualizado:true});
  }
  if(action==='negocios'){
   const b=await sql.query('SELECT id,nombre,razon_social FROM public.fin_negocios WHERE activo=true ORDER BY nombre');
   const s=await sql.query('SELECT id,negocio_id,nombre FROM public.fin_sucursales WHERE activo=true ORDER BY nombre');
   return ok(res,{negocios:b,sucursales:s});
  }
  if(action==='nuevo_negocio'){
   const nombre=text(body.nombre,100),razon=text(body.razon_social,140);
   if(nombre.length<2)return fail(res,400,'Indica el nombre del negocio.');
   const r=await sql.query('INSERT INTO public.fin_negocios(nombre,razon_social) VALUES($1,$2) RETURNING id,nombre',[nombre,razon]);
   await audit(sql,'negocio',r[0].id,'crear',who,{nombre,razon});
   return ok(res,{negocio:r[0]});
  }
  if(action==='nueva_sucursal'){
   const nombre=text(body.nombre,100);
   if(nombre.length<2)return fail(res,400,'Indica la sucursal.');
   await belongs(sql,body.negocio_id,null);
   const r=await sql.query('INSERT INTO public.fin_sucursales(negocio_id,nombre) VALUES($1,$2) ON CONFLICT(negocio_id,nombre) DO UPDATE SET activo=true RETURNING id,nombre',[body.negocio_id,nombre]);
   await audit(sql,'sucursal',r[0].id,'crear',who,{negocio_id:body.negocio_id,nombre});
   return ok(res,{sucursal:r[0]});
  }
  if(action==='clasificar_movimiento'){
   const id=String(body.id||''),legal=String(body.razon_social_id||'');
   if(!uuid.test(id)||!uuid.test(legal))return fail(res,400,'Selecciona el registro y la razón social.');
   const existing=await sql.query("SELECT id,negocio_id,razon_social_id,tipo,fuente,estado FROM public.fin_movimientos WHERE id=$1",[id]);
   if(!existing.length||existing[0].estado==='anulado')return fail(res,404,'Registro no disponible.');
   if(existing[0].tipo==='compra'&&existing[0].fuente==='factura')
    return fail(res,400,'Utiliza el detalle de la factura para cambiar su clasificación.');
   const business=existing[0].negocio_id;
   const linked=await sql.query('SELECT 1 FROM public.fin_negocio_razones WHERE negocio_id=$1 AND razon_social_id=$2',[business,legal]);
   if(!linked.length)return fail(res,400,'Vincula primero la razón social al negocio.');
   await sql.query('UPDATE public.fin_movimientos SET razon_social_id=$2,actualizado_en=now() WHERE id=$1',[id,legal]);
   await audit(sql,'movimiento',id,'clasificar_razon',who,{antes:existing[0].razon_social_id,despues:legal,responsable_cuenta:who.email});
   return ok(res,{actualizado:true});
  }
  if(action==='guardar_movimiento'){
   const tipo=String(body.tipo||''),monto=Number(body.monto),fecha=body.fecha;
   if(!MODES.has(tipo)||!money(monto)||!validDate(fecha))return fail(res,400,'Revisa tipo, monto y fecha.');
   await belongs(sql,body.negocio_id,body.sucursal_id||null);
   const legal=String(body.razon_social_id||'');
   if(!uuid.test(legal))return fail(res,400,'Selecciona la razón social de esta operación.');
   const association=await sql.query('SELECT 1 FROM public.fin_negocio_razones WHERE negocio_id=$1 AND razon_social_id=$2',[body.negocio_id,legal]);
   if(!association.length)return fail(res,400,'Primero vincula la razón social a ese negocio.');
   const medios=checkMethods(body.medios||{});
   if(tipo==='venta'&&Object.keys(medios).length&&Object.values(medios).reduce((a,b)=>a+b,0)!==monto)
    return fail(res,409,'La suma de los medios de pago debe coincidir con la venta.');
   const fuente=body.fuente==='cierre'?'cierre':'manual';
   const referencia=text(body.referencia,130),concepto=text(body.concepto,240);
   if(fuente==='cierre'&&referencia.length<3)return fail(res,400,'Indica el número o referencia del cierre.');
   const clave=fuente==='cierre'?hash(['cierre',legal,body.negocio_id,body.sucursal_id||'',fecha,referencia.toLowerCase()].join('|')):null;
   if(tipo==='venta'&&!body.confirmar_duplicado){
    const dupe=await sql.query("SELECT id FROM public.fin_movimientos WHERE negocio_id=$1 AND sucursal_id IS NOT DISTINCT FROM $2::uuid AND fecha=$3 AND razon_social_id=$4 AND tipo='venta' AND estado<>'anulado' LIMIT 3",[body.negocio_id,body.sucursal_id||null,fecha,legal]);
    if(dupe.length)return fail(res,409,'Ya existen ventas ese día para este local. Confirma que no estás duplicando un cierre.');
   }
   const estado=['gasto','compra','retiro'].includes(tipo)&&body.pendiente===true?'pendiente':(['gasto','compra','retiro'].includes(tipo)?'pagado':'registrado');
   const datos=typeof body.datos==='object'&&body.datos&&!Array.isArray(body.datos)?body.datos:{};
   if(JSON.stringify(datos).length>3000)return fail(res,413,'Demasiados detalles.');
   const r=await sql.query('INSERT INTO public.fin_movimientos(negocio_id,sucursal_id,tipo,fecha,monto,medios,categoria,concepto,proveedor,referencia,estado,fuente,datos,clave_unica,creado_por,razon_social_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16::uuid) ON CONFLICT DO NOTHING RETURNING id',
    [body.negocio_id,body.sucursal_id||null,tipo,fecha,monto,JSON.stringify(medios),text(body.categoria,90),concepto,text(body.proveedor,120),referencia,estado,fuente,JSON.stringify(datos),clave,who.uid,legal]);
   if(!r.length)return fail(res,409,'Ese cierre ya se importó anteriormente. No se duplicó.');
   await audit(sql,'movimiento',r[0].id,'crear',who,{tipo,fecha,monto,negocio_id:body.negocio_id,sucursal_id:body.sucursal_id,razon_social_id:legal,fuente,responsable_cuenta:who.email});
   return ok(res,{id:r[0].id});
  }
  if(action==='registrar_cierre'){
   // El cierre importado se guarda íntegro como venta; se conservan las cifras
   // de arqueo en datos, sin convertir los retiros en nuevos gastos automáticamente.
   const cierre=body.cierre||{};
   if(!cierre||typeof cierre!=='object')return fail(res,400,'Cierre inválido.');
   body.action='guardar_movimiento';body.tipo='venta';body.monto=cierre.venta_total;
   body.fecha=cierre.fecha;body.medios=cierre.medios;body.fuente='cierre';
   body.referencia=cierre.referencia;body.datos=cierre.conceptos||{};
   return fail(res,400,'Confirma el cierre en la vista previa y guárdalo como venta con fuente «cierre».');
  }
  if(action==='exportar_informes'){
   // Solo lectura y exclusivamente para una sesión autorizada con Google y PIN.
   // Nunca se almacena el archivo ni se duplican operaciones financieras.
   const biz=body.negocio_id||null,sucursal=body.sucursal_id||null;
   if(biz)await belongs(sql,biz,sucursal);
   else if(sucursal)return fail(res,400,'Selecciona primero el negocio.');
   const desde=body.desde,hasta=body.hasta,legal=String(body.razon_social_id||'todos');
   if(!validDate(desde)||!validDate(hasta)||desde>hasta)
    return fail(res,400,'Selecciona un período de fechas válido.');
   if(!['todos','sin_clasificar'].includes(legal)&&!uuid.test(legal))
    return fail(res,400,'Selecciona una razón social válida.');
   // Filtros idénticos para datos manuales y facturas. Las compras repartidas
   // se imputan exclusivamente por el monto asignado a cada sucursal.
   const p=[biz,sucursal,desde,hasta,legal];
   const legalWhere=" AND ($5::text='todos' OR ($5::text='sin_clasificar' AND m.razon_social_id IS NULL)"+
    " OR m.razon_social_id::text=$5)";
   const alcance=" AND ($1::uuid IS NULL OR m.negocio_id=$1)"+
    " AND ($2::uuid IS NULL OR m.sucursal_id=$2)";
   const movimientos=await sql.query(
    "SELECT m.id,m.tipo,m.fecha::text AS fecha,m.monto,m.categoria,m.concepto,"+
    "m.proveedor,m.referencia,m.estado,m.fuente,m.medios,m.datos,"+
    "b.nombre AS negocio,COALESCE(s.nombre,'General') AS sucursal,"+
    "COALESCE(l.nombre,'Sin clasificar') AS razon_social "+
    "FROM public.fin_movimientos m JOIN public.fin_negocios b ON b.id=m.negocio_id "+
    "LEFT JOIN public.fin_sucursales s ON s.id=m.sucursal_id "+
    "LEFT JOIN public.fin_razones_sociales l ON l.id=m.razon_social_id "+
    "WHERE m.estado<>'anulado' AND NOT (m.tipo='compra' AND m.fuente='factura')"+
    alcance+" AND m.fecha BETWEEN $3::date AND $4::date"+legalWhere+
    " ORDER BY m.fecha DESC,m.creado_en DESC LIMIT 1001",p);
   const invoicesSql=(pendientes)=>{
    const where=" WHERE m.tipo='compra' AND m.fuente='factura' "+
     "AND m.estado"+(pendientes?"='pendiente'":"<>'anulado'")+
     " AND ($1::uuid IS NULL OR COALESCE(r.negocio_id,m.negocio_id)=$1)"+
     " AND ($2::uuid IS NULL OR COALESCE(r.sucursal_id,m.sucursal_id)=$2)"+
     (pendientes?" AND $3::date <= $4::date":" AND m.fecha BETWEEN $3::date AND $4::date")+legalWhere;
    return "SELECT m.id,m.tipo,m.fecha::text AS fecha,m.monto AS total_factura,"+
     "COALESCE(r.monto,m.monto) AS monto,m.categoria,m.concepto,m.proveedor,"+
     "m.referencia,m.estado,m.datos,b.nombre AS negocio,"+
     "COALESCE(s.nombre,'General') AS sucursal,"+
     "COALESCE(l.nombre,'Sin clasificar') AS razon_social "+
     "FROM public.fin_movimientos m LEFT JOIN public.fin_compra_repartos r ON r.compra_id=m.id "+
     "JOIN public.fin_negocios b ON b.id=COALESCE(r.negocio_id,m.negocio_id) "+
     "LEFT JOIN public.fin_sucursales s ON s.id=COALESCE(r.sucursal_id,m.sucursal_id) "+
     "LEFT JOIN public.fin_razones_sociales l ON l.id=m.razon_social_id "+
     where+" ORDER BY m.fecha DESC,m.creado_en DESC LIMIT 1001";
   };
   const manualDueSql="SELECT m.id,m.tipo,m.fecha::text AS fecha,m.monto,m.categoria,"+
    "m.concepto,m.proveedor,m.referencia,m.estado,m.datos,"+
    "b.nombre AS negocio,COALESCE(s.nombre,'General') AS sucursal,"+
    "COALESCE(l.nombre,'Sin clasificar') AS razon_social "+
    "FROM public.fin_movimientos m JOIN public.fin_negocios b ON b.id=m.negocio_id "+
    "LEFT JOIN public.fin_sucursales s ON s.id=m.sucursal_id "+
    "LEFT JOIN public.fin_razones_sociales l ON l.id=m.razon_social_id "+
    "WHERE m.estado='pendiente' AND m.tipo IN ('gasto','compra') "+
    "AND m.fuente<>'factura'"+alcance+" AND $3::date <= $4::date"+legalWhere+
    " ORDER BY m.fecha DESC,m.creado_en DESC LIMIT 1001";
   const [facturas,pendientesManuales,pendientesFacturas]=await Promise.all([
    sql.query(invoicesSql(false),p),
    sql.query(manualDueSql,p),
    sql.query(invoicesSql(true),p)
   ]);
   // Confirmar el nombre en el servidor antes de agregar cierres Uki; una
   // selección de Romo u otra marca jamás recibe ventas automáticas de Uki.
   let branch='todos',incluirCierres=true;
   if(biz){
    const b=await sql.query('SELECT nombre FROM public.fin_negocios WHERE id=$1',[biz]);
    incluirCierres=/\buki\b/i.test(String(b[0]?.nombre||''));
   }
   if(sucursal){
    const l=await sql.query('SELECT nombre FROM public.fin_sucursales WHERE id=$1',[sucursal]);
    const nombre=String(l[0]?.nombre||'');
    branch=/regimiento|arica/i.test(nombre)?'arica':/serena/i.test(nombre)?'serena':'ninguno';
    if(branch==='ninguno')incluirCierres=false;
   }
   // Un filtro por razón social no se puede atribuir sin certeza a un cierre
   // antiguo que no lleva razón_social_id: se excluye, nunca se asigna por suposición.
   if(legal!=='todos')incluirCierres=false;
   const cierres=incluirCierres?await sql.query(
    "SELECT branch,turno_ref,fecha_operativa::text AS fecha,venta_total,"+
    "pedidos,medios,gastos_cierre,delivery_por_pagar,propinas,retiros "+
    "FROM public.fin_uki_cierres_live_v1 WHERE estado='cerrado' "+
    "AND fecha_operativa BETWEEN $1::date AND $2::date "+
    "AND ($3='todos' OR branch=$3) ORDER BY fecha_operativa DESC,turno_ref DESC LIMIT 1001",
    [desde,hasta,branch]):[];
   if([movimientos,facturas,pendientesManuales,pendientesFacturas,cierres].some(rows=>rows.length>1000))
    return fail(res,409,'Hay más de 1.000 registros en algún detalle. Filtra por negocio o elige fechas más cortas antes de exportar, para no omitir información.');
   return ok(res,{desde,hasta,movimientos,facturas,cierres,
    pendientes:[...pendientesManuales,...pendientesFacturas],
    nota:'Resultado de control, no utilidad contable. Las facturas podrían coincidir con gastos de cierre: conciliar antes de contabilizar.'});
  }
  if(action==='listar_movimientos'){
   const b=body.negocio_id||null,s=body.sucursal_id||null;
   if(b)await belongs(sql,b,s);else if(s)return fail(res,400,'Selecciona negocio.');
   const from=validDate(body.desde)?body.desde:'2000-01-01';
   const to=validDate(body.hasta)?body.hasta:'2099-12-31';
   const legal=String(body.razon_social_id||'todos');
   if(!['todos','sin_clasificar'].includes(legal)&&!uuid.test(legal))
    return fail(res,400,'Razón social de consulta inválida.');
   const r=await sql.query("SELECT id,negocio_id,sucursal_id,razon_social_id,tipo,fecha,monto,medios,"+
    "categoria,concepto,proveedor,referencia,estado,fuente,datos,creado_en,actualizado_en "+
    "FROM public.fin_movimientos WHERE ($1::uuid IS NULL OR negocio_id=$1) "+
    "AND ($2::uuid IS NULL OR sucursal_id=$2) AND fecha BETWEEN $3 AND $4 "+
    "AND ($5::text='todos' OR ($5::text='sin_clasificar' AND razon_social_id IS NULL) "+
    "OR razon_social_id::text=$5) ORDER BY fecha DESC,creado_en DESC LIMIT 250",
    [b,s,from,to,legal]);
   return ok(res,{movimientos:r});
  }
  if(action==='listar_pendientes'){
   // Todas las obligaciones aún abiertas (sin restringir al mes consultado).
   // No altera compras, gastos ni cierres; el acceso privado ya fue validado.
   const biz=body.negocio_id||null,branch=body.sucursal_id||null;
   if(biz)await belongs(sql,biz,branch);
   else if(branch)return fail(res,400,'Selecciona el negocio de la sucursal.');
   const legal=String(body.razon_social_id||'todos');
   if(!['todos','sin_clasificar'].includes(legal)&&!uuid.test(legal))
    return fail(res,400,'Razón social inválida.');
   const p=[biz,branch,legal],where=
    " WHERE m.tipo IN ('gasto','compra') AND m.estado='pendiente'"+
    " AND ($1::uuid IS NULL OR m.negocio_id=$1)"+
    " AND ($2::uuid IS NULL OR m.sucursal_id=$2)"+
    " AND ($3::text='todos' OR ($3::text='sin_clasificar' AND m.razon_social_id IS NULL)"+
    " OR m.razon_social_id::text=$3)";
   const [rows,tots]=await Promise.all([
    sql.query("SELECT m.id,m.negocio_id,m.sucursal_id,m.razon_social_id,m.tipo,m.fecha::text AS fecha,"+
      "m.monto,m.categoria,m.concepto,m.proveedor,m.referencia,m.fuente,m.datos,m.actualizado_en "+
      "FROM public.fin_movimientos m"+where+
      " ORDER BY NULLIF(m.datos->>'vence','') ASC NULLS LAST,m.fecha ASC,m.creado_en ASC LIMIT 250",p),
    sql.query("SELECT COUNT(*)::int AS cantidad,COALESCE(SUM(m.monto),0)::bigint AS total "+
      "FROM public.fin_movimientos m"+where,p)
   ]);
   return ok(res,{pendientes:rows,total:tots[0]?.total||0,
    cantidad:Number(tots[0]?.cantidad||0),limitado:Number(tots[0]?.cantidad||0)>rows.length});
  }
  if(action==='auditoria_movimiento'){
   // Historial de un movimiento: solo sesión privada de dueños, solo lectura.
   const id=String(body.id||'');
   if(!uuid.test(id))return fail(res,400,'Selecciona un movimiento válido.');
   const existe=await sql.query('SELECT 1 FROM public.fin_movimientos WHERE id=$1',[id]);
   if(!existe.length)return fail(res,404,'Movimiento no encontrado.');
   const events=await sql.query(
    "SELECT id,accion,actor_uid,anterior,nuevo,creado_en "+
    "FROM public.fin_auditoria WHERE entidad IN ('movimiento','compra') AND entidad_id=$1 "+
    "ORDER BY creado_en DESC,id DESC LIMIT 80",[id]);
   return ok(res,{eventos:events,limitado:events.length===80});
  }
  if(action==='editar_movimiento'){
   // Solo edición financiera manual; los cierres automáticos de Uki viven en otra tabla.
   const id=String(body.id||''),fecha=body.fecha,monto=Number(body.monto);
   const version=String(body.version||'');
   if(!uuid.test(id)||!validDate(fecha)||!money(monto)||!/^\d{4}-\d{2}-\d{2}T/.test(version)||
      !Number.isFinite(Date.parse(version)))
    return fail(res,400,'Revisa registro, fecha y monto antes de guardar.');
   const old=await sql.query(
    'SELECT id,tipo,fuente,estado,fecha::text AS fecha,monto,medios,concepto,referencia,categoria,proveedor,sucursal_id,actualizado_en,negocio_id FROM public.fin_movimientos WHERE id=$1',[id]);
   if(!old.length)return fail(res,404,'No se encontró el registro.');
   const prev=old[0];
   if(prev.estado==='anulado'||prev.fuente==='factura')
    return fail(res,409,'Este registro no admite edición directa. Las facturas se revisan en Compras.');
   if(new Date(prev.actualizado_en).getTime()!==Date.parse(version))
    return fail(res,409,'Este registro cambió en otra sesión. Actualiza antes de editar.');
   const medios=Object.prototype.hasOwnProperty.call(body,'medios')?
    checkMethods(body.medios||{}):checkMethods(prev.medios||{});
   if(Object.keys(medios).length&&Object.values(medios).reduce((a,b)=>a+b,0)!==monto)
    return fail(res,409,'Los medios de pago deben coincidir con el importe.');
   const concepto=text(body.concepto,240),referencia=text(body.referencia,130);
   const nuevaSucursal=Object.prototype.hasOwnProperty.call(body,'sucursal_id')?(body.sucursal_id||null):undefined;
   if(nuevaSucursal!==undefined)await belongs(sql,prev.negocio_id,nuevaSucursal);
   const categoria=Object.prototype.hasOwnProperty.call(body,'categoria')?text(body.categoria,90):prev.categoria;
   const proveedor=Object.prototype.hasOwnProperty.call(body,'proveedor')?text(body.proveedor,120):prev.proveedor;
   if(prev.fuente==='cierre'&&referencia.length<3)
    return fail(res,400,'Conserva una referencia para el cierre ingresado manualmente.');
   const updated=await sql.query(
    'UPDATE public.fin_movimientos SET fecha=$2,monto=$3,medios=$4::jsonb,concepto=$5,referencia=$6,actualizado_en=now(), '+
    'sucursal_id=$8::uuid,categoria=$9,proveedor=$10 '+
    'WHERE id=$1 AND actualizado_en=$7::timestamptz AND estado<>\'anulado\' AND fuente<>\'factura\' RETURNING id',
    [id,fecha,monto,JSON.stringify(medios),concepto,referencia,version,nuevaSucursal===undefined?prev.sucursal_id:nuevaSucursal,categoria,proveedor]);
   if(!updated.length)return fail(res,409,'El registro cambió. Actualiza el panel para revisarlo.');
   await audit(sql,'movimiento',id,'editar',who,{
    antes:{fecha:prev.fecha,monto:Number(prev.monto),medios:prev.medios,concepto:prev.concepto,referencia:prev.referencia,sucursal_id:prev.sucursal_id,categoria:prev.categoria,proveedor:prev.proveedor},
    despues:{fecha,monto,medios,concepto,referencia,sucursal_id:nuevaSucursal===undefined?prev.sucursal_id:nuevaSucursal,categoria,proveedor},
    responsable_cuenta:who.email
   });
   return ok(res,{actualizado:true});
  }
  if(action==='anular_movimiento'){
   if(!uuid.test(String(body.id||'')))return fail(res,400,'Registro inválido.');
   const old=await sql.query('SELECT id,estado,tipo,fecha,monto,negocio_id FROM public.fin_movimientos WHERE id=$1',[body.id]);
   if(!old.length)return fail(res,404,'No se encontró el registro.');
   if(old[0].estado==='anulado')return fail(res,409,'Ya estaba anulado.');
   await sql.query("UPDATE public.fin_movimientos SET estado='anulado',actualizado_en=now() WHERE id=$1",[body.id]);
   await audit(sql,'movimiento',body.id,'anular',who,{antes:old[0],responsable_cuenta:who.email});
   return ok(res,{anulado:true});
  }
  if(action==='marcar_pagado'){
   if(!uuid.test(String(body.id||'')))return fail(res,400,'Registro inválido.');
   if(!validDate(body.fecha_pago))return fail(res,400,'Selecciona la fecha real del pago.');
   const medio=String(body.medio_pago||'');
   if(medio&&!PAYMENTS.has(medio))return fail(res,400,'Medio de pago inválido.');
   // Cambia el estado de la misma obligación; jamás crea un gasto adicional.
   const rows=await sql.query(
    "UPDATE public.fin_movimientos SET estado='pagado',"+
    "datos=coalesce(datos,'{}'::jsonb)||jsonb_build_object('fecha_pago',$2::text,'medio_pago',NULLIF($3::text,'')),"+
    "medios=CASE WHEN $3::text<>'' THEN jsonb_build_object($3::text,monto) ELSE medios END,"+
    "actualizado_en=now() WHERE id=$1 AND tipo IN ('gasto','compra','retiro') AND estado='pendiente' "+
    "RETURNING id,tipo,monto,fecha,negocio_id",
    [body.id,body.fecha_pago,medio]);
   if(!rows.length)return fail(res,409,'Solo se puede pagar una cuenta que esté pendiente.');
   await audit(sql,'movimiento',body.id,'pagar',who,
     {antes:'pendiente',despues:'pagado',fecha_pago:body.fecha_pago,medio_pago:medio||null,
      responsable_cuenta:who.email});
   return ok(res,{pagado:true});
  }
  if(action==='resumen'){
   const b=body.negocio_id||null,s=body.sucursal_id||null;
   if(b)await belongs(sql,b,s);else if(s)return fail(res,400,'Selecciona negocio.');
   const from=validDate(body.desde)?body.desde:'2000-01-01';
   const to=validDate(body.hasta)?body.hasta:'2099-12-31';
   const legal=String(body.razon_social_id||'todos');
   if(!['todos','sin_clasificar'].includes(legal)&&!uuid.test(legal))
    return fail(res,400,'Razón social de consulta inválida.');
   const p=[b,s,from,to,legal];
   const where="WHERE ($1::uuid IS NULL OR m.negocio_id=$1) "+
    "AND ($2::uuid IS NULL OR m.sucursal_id=$2) AND m.fecha BETWEEN $3 AND $4 "+
    "AND ($5::text='todos' OR ($5::text='sin_clasificar' AND m.razon_social_id IS NULL) "+
    "OR m.razon_social_id::text=$5) AND m.estado<>'anulado'";
   // Mantener la categoría al agregar los totales para diferenciar inversión
   // (movimiento patrimonial) de los costos del negocio sin doble registro.
   const rows=await sql.query("SELECT m.tipo,m.estado,m.categoria,SUM(m.monto)::bigint AS total,COUNT(*)::int AS cantidad "+
    "FROM public.fin_movimientos m "+where+" GROUP BY m.tipo,m.estado,m.categoria",p);
   const pagos=await sql.query("SELECT pago.key AS medio,SUM((pago.value)::bigint)::bigint AS total "+
    "FROM public.fin_movimientos m CROSS JOIN LATERAL jsonb_each_text(m.medios) AS pago(key,value) "+
    where+" AND m.tipo='venta' GROUP BY pago.key ORDER BY pago.key",p);
   return ok(res,{resumen:rows,pagos,nota:'Resultado preliminar = ventas - gastos y compras pagadas. No es utilidad contable definitiva.'});
  }
  if(action==='guardar_compra_factura'){
   // Confirmación manual obligatoria: la extracción de foto no autoriza contabilidad.
   if(body.confirmado!==true)return fail(res,400,'Revisa y confirma primero los importes de la factura.');
   const business=body.negocio_id,local=body.sucursal_id||null,fecha=body.fecha;
   await belongs(sql,business,local);
   const legal=String(body.razon_social_id||'');
   if(!uuid.test(legal))return fail(res,400,'Elige la razón social compradora de esta factura.');
   const association=await sql.query('SELECT 1 FROM public.fin_razones_sociales WHERE id=$1 AND activo=true',[legal]);
   if(!association.length)return fail(res,400,'La razón social seleccionada no existe.');
   const proveedor=text(body.proveedor,120),referencia=text(body.referencia,130);
   const total=Number(body.total),neto=Number(body.neto),iva=Number(body.iva);
   const otros=Number(body.otros),descuento=Number(body.descuento);
   if(!validDate(fecha)||proveedor.length<2||![total,neto,iva,otros,descuento].every(money)||
      total<1||neto+iva+otros-descuento!==total)
    return fail(res,400,'Revisa proveedor, fecha, neto, IVA y total. Deben cuadrar.');
   const items=body.articulos;
   if(!Array.isArray(items)||items.length>60)return fail(res,400,'Máximo 60 productos por factura.');
   const cleans=[];
   for(const item of items){
    const nombre=text(item?.nombre,180),cantidad=Number(String(item?.cantidad||'').replace(',','.'));
    const precio=Number(item?.precio_unitario),importe=Number(item?.total),unidad=text(item?.unidad||'un',15);
    if(nombre.length<2||!Number.isFinite(cantidad)||cantidad<=0||cantidad>100000||
       !/^\d{1,6}(\.\d{1,3})?$/.test(String(cantidad))||
       !money(precio)||!money(importe)||Math.abs(Math.round(cantidad*precio)-importe)>2)
      return fail(res,400,'Revisa cantidad, precio o importe de un producto.');
    cleans.push({nombre,cantidad:String(cantidad),precio_unitario:String(precio),
      total:String(importe),unidad:unidad||'un'});
   }
   // La asignación a uno o dos locales se hace en la MISMA transacción que crea la factura.
   // Ausencia de reparto significa 'General' (no se imputa a un local por suposición).
   const destinos=body.destinos==null?null:body.destinos;
   if(destinos!==null){
    if(!Array.isArray(destinos)||destinos.length<1||destinos.length>2)
     return fail(res,400,'La compra puede distribuirse a uno o dos locales.');
    let sum=0;const seen=new Set();
    for(const x of destinos){
     if(!uuid.test(String(x.negocio_id||''))||!uuid.test(String(x.sucursal_id||''))||
       !money(Number(x.monto))||Number(x.monto)<1||seen.has(x.sucursal_id))
      return fail(res,400,'Revisa el reparto entre sucursales.');
     sum+=Number(x.monto);seen.add(x.sucursal_id);
    }
    if(sum!==total)return fail(res,400,'El reparto entre locales debe sumar el total de la factura.');
   }
   const result=await sql.query(
    'SELECT public.fin_registrar_compra_v3($1::uuid,$2::uuid,$3::date,$4,$5,$6::bigint,$7::bigint,$8::bigint,$9::bigint,$10::bigint,$11::boolean,$12::jsonb,$13,$14,$15::uuid,$16,$17,$18::jsonb) AS result',
    [business,local,fecha,proveedor,referencia,total,neto,iva,otros,descuento,
     body.pendiente===true,JSON.stringify(cleans),who.uid,'',legal,text(body.comprador_factura,140),text(body.observacion_factura,140),destinos===null?null:JSON.stringify(destinos)]);
   const saved=result[0]?.result||{};
   if(!saved.ok)return fail(res,409,saved.duplicado?
    'Esta factura ya está registrada. No la guardamos dos veces.':
    'Existe una compra o gasto igual para ese proveedor, fecha y total. Revisa el historial antes de registrarla otra vez.');
   return ok(res,{id:saved.id,articulos:saved.articulos,registrado_como:'compra'});
  }
  if(action==='repartir_compra'){
   const id=String(body.id||'');
   const destinos=body.destinos;
   if(!uuid.test(id)||!Array.isArray(destinos)||destinos.length<1||destinos.length>2)
    return fail(res,400,'Selecciona uno o dos locales de destino.');
   const cleaned=[];
   for(const p of destinos){
    const negocio=String(p?.negocio_id||''),local=String(p?.sucursal_id||''),monto=Number(p?.monto);
    if(!uuid.test(negocio)||!uuid.test(local)||!Number.isSafeInteger(monto)||monto<=0||monto>1000000000)
     return fail(res,400,'Verifica la sucursal y el monto asignado.');
    cleaned.push({negocio_id:negocio,sucursal_id:local,monto:String(monto)});
   }
   if(new Set(cleaned.map(x=>x.sucursal_id)).size!==cleaned.length)
    return fail(res,400,'Cada local debe aparecer una sola vez.');
   const x=await sql.query('SELECT public.fin_repartir_compra_v1($1::uuid,$2::jsonb,$3) AS resultado',
    [id,JSON.stringify(cleaned),who.uid]);
   return ok(res,{distribucion:x[0]?.resultado});
  }
  if(action==='resumen_compras'){
   const biz=body.negocio_id||null,branch=body.sucursal_id||null;
   if(biz)await belongs(sql,biz,branch);else if(branch)return fail(res,400,'Selecciona el negocio de la sucursal.');
   const from=validDate(body.desde)?body.desde:'2000-01-01';
   const to=validDate(body.hasta)?body.hasta:'2099-12-31';
   const reason=String(body.razon_social_id||'todos');
   if(!['todos','sin_clasificar'].includes(reason)&&!uuid.test(reason))
    return fail(res,400,'Filtro de razón social incorrecto.');
   const query=text(body.buscar,100),params=[biz,branch,from,to,reason,query];
   // Si una factura se reparte entre dos locales se cuenta UNA vez en el total general,
   // y cada local recibe solo el importe que se le asignó. Sin reparto -> General.
   const cte=[
    "WITH compras AS (",
    " SELECT m.id,m.negocio_id,m.sucursal_id,m.fecha,m.proveedor,m.referencia,m.estado,",
    " m.datos,m.creado_en,m.razon_social_id,m.monto AS importe_factura,",
    " COALESCE(rs.nombre,'Sin clasificar') AS razon_social,COALESCE(rs.rut,'') AS rut_razon",
    " FROM public.fin_movimientos m",
    " LEFT JOIN public.fin_razones_sociales rs ON rs.id=m.razon_social_id",
    " WHERE m.tipo='compra' AND m.fuente='factura' AND m.estado<>'anulado'",
    "), partes AS (",
    " SELECT c.*,r.negocio_id AS destino_negocio_id,r.sucursal_id AS destino_sucursal_id,",
    " r.monto AS monto_imputado FROM compras c",
    " JOIN public.fin_compra_repartos r ON r.compra_id=c.id",
    " UNION ALL",
    " SELECT c.*,c.negocio_id AS destino_negocio_id,c.sucursal_id AS destino_sucursal_id,",
    " c.importe_factura AS monto_imputado FROM compras c",
    " WHERE NOT EXISTS(SELECT 1 FROM public.fin_compra_repartos r WHERE r.compra_id=c.id)",
    "), filtradas AS (",
    " SELECT p.id,p.destino_negocio_id AS negocio_id,p.destino_sucursal_id AS sucursal_id,",
    " p.fecha,p.proveedor,p.referencia,p.estado,p.datos,p.creado_en,p.razon_social_id,",
    " p.importe_factura,p.monto_imputado AS monto,p.razon_social,p.rut_razon,",
    " b.nombre AS marca,COALESCE(s.nombre,'General') AS local",
    " FROM partes p JOIN public.fin_negocios b ON b.id=p.destino_negocio_id",
    " LEFT JOIN public.fin_sucursales s ON s.id=p.destino_sucursal_id",
    " WHERE ($1::uuid IS NULL OR p.destino_negocio_id=$1)",
    " AND ($2::uuid IS NULL OR p.destino_sucursal_id=$2)",
    " AND p.fecha BETWEEN $3::date AND $4::date",
    " AND ($5::text='todos' OR ($5::text='sin_clasificar' AND p.razon_social_id IS NULL)",
    " OR p.razon_social_id::text=$5::text)",
    " AND ($6::text='' OR position(lower($6) in lower(concat_ws(' ',p.proveedor,p.referencia,",
    " b.nombre,p.razon_social,p.rut_razon)))>0",
    " OR EXISTS(SELECT 1 FROM public.fin_compra_items it WHERE it.compra_id=p.id",
    " AND position(lower($6) in lower(it.descripcion))>0))",
    ") "
   ].join(' ');
   const statements=[
    "SELECT COUNT(DISTINCT id)::int AS facturas,COALESCE(SUM(monto),0)::bigint AS compras,"+
     "COALESCE(SUM(monto) FILTER(WHERE estado='pendiente'),0)::bigint AS pendiente,"+
     "COUNT(DISTINCT id) FILTER(WHERE razon_social_id IS NULL)::int AS sin_clasificar,"+
     "COUNT(DISTINCT proveedor)::int AS proveedores FROM filtradas",
    "SELECT proveedor,COUNT(DISTINCT id)::int AS facturas,SUM(monto)::bigint AS total,"+
     "COALESCE(SUM(monto) FILTER(WHERE estado='pendiente'),0)::bigint AS pendiente"+
     " FROM filtradas GROUP BY proveedor ORDER BY total DESC LIMIT 100",
    "SELECT lower(btrim(i.descripcion)) AS producto,COUNT(DISTINCT i.compra_id)::int AS veces,"+
     "SUM(i.cantidad)::numeric(16,3) AS cantidad,i.unidad,SUM(i.total_linea)::bigint AS importe"+
     " FROM public.fin_compra_items i JOIN (SELECT DISTINCT id FROM filtradas) f ON f.id=i.compra_id"+
     " GROUP BY lower(btrim(i.descripcion)),i.unidad ORDER BY importe DESC LIMIT 120",
    "SELECT * FROM (SELECT DISTINCT ON (id) id,negocio_id,sucursal_id,razon_social_id,razon_social,rut_razon,"+
     "marca,local,fecha,proveedor,referencia,importe_factura AS monto,estado,datos,"+
     "(SELECT SUM(f2.monto)::bigint FROM filtradas f2 WHERE f2.id=filtradas.id) AS monto_filtrado"+
     " FROM filtradas ORDER BY id,fecha DESC,creado_en DESC) x ORDER BY fecha DESC,id LIMIT 200",
    "SELECT razon_social_id,razon_social,rut_razon,COUNT(DISTINCT id)::int AS facturas,"+
     "SUM(monto)::bigint AS total,"+
     "COALESCE(SUM(monto) FILTER(WHERE estado='pendiente'),0)::bigint AS pendiente"+
     " FROM filtradas GROUP BY razon_social_id,razon_social,rut_razon ORDER BY total DESC",
    "SELECT negocio_id,sucursal_id,marca,local,COUNT(DISTINCT id)::int AS facturas,"+
     "SUM(monto)::bigint AS total FROM filtradas GROUP BY negocio_id,sucursal_id,marca,local"+
     " ORDER BY marca,local"
   ];
   const result=await Promise.all(statements.map(st=>sql.query(cte+st,params)));
   return ok(res,{resumen:result[0][0]||{},proveedores:result[1],productos:result[2],
    facturas:result[3],razones:result[4],locales:result[5],
    nota:'Las compras compartidas se reparten por importe sin duplicar la factura. Los artículos son los de la factura completa.'});
  }
  if(action==='detalle_compra'){
   if(!uuid.test(String(body.id||'')))return fail(res,400,'Identificador incorrecto.');
   const compra=await sql.query("SELECT m.id,m.negocio_id,m.sucursal_id,m.razon_social_id,coalesce(r.nombre,\'Sin clasificar\') AS razon_social,m.fecha,m.proveedor,m.referencia,m.monto,m.datos,m.estado FROM public.fin_movimientos m LEFT JOIN public.fin_razones_sociales r ON r.id=m.razon_social_id WHERE m.id=$1 AND m.tipo=\'compra\' AND m.fuente=\'factura\' LIMIT 1",[body.id]);
   if(!compra.length)return fail(res,404,'Compra no encontrada.');
   const articulos=await sql.query('SELECT posicion,descripcion,cantidad,unidad,precio_unitario,total_linea FROM public.fin_compra_items WHERE compra_id=$1 ORDER BY posicion',[body.id]);
   const repartos=await sql.query('SELECT r.negocio_id,r.sucursal_id,r.monto,b.nombre AS negocio,s.nombre AS sucursal FROM public.fin_compra_repartos r JOIN public.fin_negocios b ON b.id=r.negocio_id JOIN public.fin_sucursales s ON s.id=r.sucursal_id WHERE r.compra_id=$1 ORDER BY b.nombre,s.nombre',[body.id]);
   return ok(res,{compra:compra[0],articulos,repartos});
  }
  if(action==='guardar_documento'){
   await belongs(sql,body.negocio_id,body.sucursal_id||null);
   const name=text(body.nombre,150),mime=String(body.mime||''),tipo=String(body.tipo||'');
   const b64=String(body.base64||'');
   if(name.length<3||!DOC_TYPES.has(tipo)||!b64||b64.length>2400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)||!DOC_TYPES.has(tipo))
    return fail(res,400,'Documento inválido.');
   const buffer=Buffer.from(b64,'base64');
   if(buffer.length<1||buffer.length>MAX_BYTES||!mimeOK(buffer,mime))return fail(res,400,'Archivo no permitido; usa una foto o PDF de hasta 1,7 MB.');
   const movimiento=body.movimiento_id||null;
   let razonDocumento=null;
   if(movimiento){
    if(!uuid.test(String(movimiento)))return fail(res,400,'Referencia inválida.');
    const linked=await sql.query('SELECT razon_social_id FROM public.fin_movimientos WHERE id=$1 AND negocio_id=$2',[movimiento,body.negocio_id]);
    if(!linked.length)return fail(res,400,'La referencia pertenece a otro negocio.');
    razonDocumento=linked[0].razon_social_id||null;
   }
   const r=await sql.query('INSERT INTO public.fin_documentos(negocio_id,sucursal_id,movimiento_id,nombre,mime,bytes,contenido,sha256,tipo,fecha_documento,proveedor,creado_por,razon_social_id) VALUES($1,$2,$3,$4,$5,$6,decode($7,\'hex\'),$8,$9,$10,$11,$12,$13) RETURNING id',
   [body.negocio_id,body.sucursal_id||null,movimiento,name,mime,buffer.length,buffer.toString('hex'),hash(buffer),tipo,validDate(body.fecha_documento)?body.fecha_documento:null,text(body.proveedor,120),who.uid,razonDocumento]);
   await audit(sql,'documento',r[0].id,'cargar',who,{nombre:name,mime,bytes:buffer.length,tipo});
   return ok(res,{id:r[0].id});
  }
  if(action==='documentos'){
   const b=body.negocio_id||null;
   if(b)await belongs(sql,b,null);
   const reason=String(body.razon_social_id||'todos');
   if(!['todos','sin_clasificar'].includes(reason)&&!uuid.test(reason))
    return fail(res,400,'Razón social de búsqueda inválida.');
   const rows=await sql.query("SELECT d.id,d.negocio_id,d.sucursal_id,d.movimiento_id,d.nombre,d.mime,"+
     "d.bytes,d.tipo,d.fecha_documento,d.proveedor,d.creado_en,"+
     "coalesce(d.razon_social_id,m.razon_social_id) AS razon_social_id,"+
     "coalesce(r.nombre,'Sin clasificar') AS razon_social "+
     "FROM public.fin_documentos d "+
     "LEFT JOIN public.fin_movimientos m ON m.id=d.movimiento_id "+
     "LEFT JOIN public.fin_razones_sociales r ON r.id=coalesce(d.razon_social_id,m.razon_social_id) "+
     "WHERE ($1::uuid IS NULL OR d.negocio_id=$1) "+
     "AND ($2::text='todos' OR ($2::text='sin_clasificar' AND coalesce(d.razon_social_id,m.razon_social_id) IS NULL) "+
     "OR coalesce(d.razon_social_id,m.razon_social_id)::text=$2::text) "+
     "ORDER BY d.creado_en DESC LIMIT 150",[b,reason]);
   return ok(res,{documentos:rows});
  }
  if(action==='abrir_documento'){
   if(!uuid.test(String(body.id||'')))return fail(res,400,'Documento inválido.');
   const rows=await sql.query("SELECT mime,encode(contenido,'base64') AS base64,nombre FROM public.fin_documentos WHERE id=$1",[body.id]);
   if(!rows.length)return fail(res,404,'No existe ese documento.');
   return ok(res,{mime:rows[0].mime,nombre:rows[0].nombre,base64:rows[0].base64.replace(/\s/g,'')});
  }

  // Costeo por insumos y factura: solo uso privado tras sesión Google + PIN.
  // Las fotos nunca modifican precios sin validación explícita del dueño.

  // Recetario acordado: se consulta/edita solo con Google + PIN privado de dueños.
  // No interviene en la carta pública, los pedidos, el inventario o la caja.
  if(action==='recetas_estandar_listar'){
   const ambito=String(body.ambito||'todos');
   if(!['todos','uki:arica','uki:serena','romo:serena'].includes(ambito))
    return fail(res,400,'Selecciona un local válido.');
   const rows=await sql.query(
    'SELECT sku,ambito,nombre,estado,notas,lineas,version,modificado_por,modificado_en '+
    'FROM public.fin_recetas_estandar_v1 WHERE ambito=$1 OR ambito=\'todos\' '+
    'ORDER BY nombre,ambito',[ambito]);
   const map=new Map();
   for(const row of rows){
    const key=String(row.sku);
    if(row.ambito==='todos'&&!map.has(key))map.set(key,row);
    if(row.ambito===ambito)map.set(key,row);
   }
   const recetas=[...map.values()].map(row=>({
    sku:row.sku,ambito,origen:row.ambito,version:row.ambito===ambito?Number(row.version):0,
    nombre:row.nombre,estado:row.estado,notas:row.notas,lineas:row.lineas,
    modificado_en:row.modificado_en,modificado_por:row.modificado_por
   })).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
   const cambios=await sql.query(
    "SELECT sku,ambito,version_nueva,cambiado_en FROM public.fin_recetas_estandar_historial_v1 "+
    "WHERE ambito='todos' OR ambito=$1 ORDER BY cambiado_en DESC LIMIT 12",[ambito]);
   return ok(res,{ambito,recetas,cambios,soloDueños:true,afectaCaja:false});
  }
  if(action==='recetas_estandar_guardar'){
   const ambito=String(body.ambito||''),sku=String(body.sku||''),
    estado=String(body.estado||''),version=Number(body.version),
    notas=typeof body.notas==='string'?body.notas.trim():'',lineas=body.lineas;
   if(!['todos','uki:arica','uki:serena','romo:serena'].includes(ambito)||
      !/^[a-z0-9-]{2,50}$/.test(sku)||
      !['confirmada','parcial','pendiente'].includes(estado)||
      !Number.isSafeInteger(version)||version<0||
      notas.length>500||!Array.isArray(lineas)||lineas.length<1||lineas.length>40)
    return fail(res,400,'Revisa los datos de la receta.');
   const clean=[];
   for(const line of lineas){
    const nombre=typeof line?.nombre==='string'?line.nombre.trim():'';
    const gramos=Number(line?.gramos);
    if(nombre.length<2||nombre.length>85||!Number.isFinite(gramos)||gramos<=0||gramos>5000||
       Math.abs(gramos*100-Math.round(gramos*100))>1e-6)
      return fail(res,400,'Revisa el nombre y los gramos de cada ingrediente.');
    clean.push({nombre,gramos,pendiente:line?.pendiente===true});
   }
   if(estado==='confirmada'&&clean.some(x=>x.pendiente))
    return fail(res,400,'Hay ingredientes pendientes. Márcalos como confirmados o mantén la receta parcial.');
   const base=await sql.query(
    "SELECT nombre FROM public.fin_recetas_estandar_v1 WHERE sku=$1 AND ambito='todos' LIMIT 1",[sku]);
   if(!base.length)return fail(res,404,'La receta base no existe.');
   const previous=await sql.query(
    'SELECT version,nombre,estado,notas,lineas,modificado_por,modificado_en '+
    'FROM public.fin_recetas_estandar_v1 WHERE sku=$1 AND ambito=$2 LIMIT 1',[sku,ambito]);
   let updated;
   if(version===0){
    if(ambito==='todos'||previous.length)
     return fail(res,409,'La receta fue modificada. Vuelve a consultar antes de guardar.');
    updated=await sql.query(
     'INSERT INTO public.fin_recetas_estandar_v1 '+
     '(sku,ambito,nombre,estado,notas,lineas,version,modificado_por) '+
     'VALUES($1,$2,$3,$4,$5,$6::jsonb,1,$7) ON CONFLICT DO NOTHING RETURNING version,modificado_en',
     [sku,ambito,base[0].nombre,estado,notas,JSON.stringify(clean),who.uid]);
   }else{
    if(!previous.length||Number(previous[0].version)!==version)
     return fail(res,409,'La receta cambió en otro dispositivo. Actualiza para editar.');
    updated=await sql.query(
     'UPDATE public.fin_recetas_estandar_v1 SET estado=$3,notas=$4,lineas=$5::jsonb,'+
     'version=version+1,modificado_por=$6,modificado_en=now() '+
     'WHERE sku=$1 AND ambito=$2 AND version=$7 RETURNING version,modificado_en',
     [sku,ambito,estado,notas,JSON.stringify(clean),who.uid,version]);
   }
   if(!updated.length)return fail(res,409,'No fue posible guardar. Actualiza y vuelve a revisar.');
   await sql.query(
    'INSERT INTO public.fin_recetas_estandar_historial_v1 '+
    '(sku,ambito,version_anterior,version_nueva,receta_anterior,receta_nueva,actor_uid) '+
    'VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)',
    [sku,ambito,previous.length?Number(previous[0].version):null,Number(updated[0].version),
     previous.length?JSON.stringify(previous[0]):null,
     JSON.stringify({nombre:base[0].nombre,estado,notas,lineas:clean}),who.uid]);
   await audit(sql,'receta_estandar',sku,version===0?'crear_sucursal':'editar',who,
    {ambito,version:Number(updated[0].version),estado});
   return ok(res,{sku,ambito,version:Number(updated[0].version),
    modificado_en:updated[0].modificado_en,soloCosteo:true,afectaCaja:false,
    afectaPedidos:false,afectaInventario:false});
  }

  // Solo lectura: compara precios actuales con partes del costo respaldadas por facturas.
  if(action==='costeo_comparar_precios_v1'){
   const localId=String(body.sucursal_id||''),local=CARTA_LOCAL_OFICIAL[localId];
   if(!local)return fail(res,400,'Selecciona una sucursal de Uki o Romo.');
   await belongs(sql,local.biz,localId);
   let catalog;
   try{catalog=await obtenerCartaCosto(req,local.biz,localId);}
   catch(e){return fail(res,503,'No pude confirmar la carta de esta sucursal. No mostraré precios desactualizados.');}
   const compras=await sql.query(
    "SELECT i.descripcion,i.precio_unitario,m.fecha::text AS fecha,n.nombre AS negocio "+
    "FROM public.fin_compra_items i JOIN public.fin_movimientos m ON m.id=i.compra_id "+
    "JOIN public.fin_negocios n ON n.id=m.negocio_id "+
    "WHERE m.tipo='compra' AND m.fuente='factura' AND m.estado<>'anulado' "+
    "AND m.negocio_id=ANY($1::uuid[]) ORDER BY m.fecha DESC,m.creado_en DESC,i.id DESC LIMIT 300",
    [[CARTA_LOCAL_OFICIAL['47278e71-42d5-4156-8d07-6d1d2101d50b'].biz,
      CARTA_LOCAL_OFICIAL['e8c2323c-030c-48c6-8861-64029df112fe'].biz]]);
   const packs=[
    ['arroz','ARROZ TUCAPEL FOOD SERVICE NACIONAL G2',10000,'g','Supuesto: precio de caja de 10 kg; 1 g crudo rinde 2,7 g cocidos'],
    ['pollo','PECHUGA DE POLLO S/HUESO S/PIEL 12 KG',12000,'g','Supuesto: caja 12 kg; rendimiento cocido 75 %'],
    ['queso','QUESO CREMA TOSHIKO BARRAS DE 1,36KG',1360,'g','Barra de queso crema de 1,36 kg'],
    ['nori','NORI GOLD YAKI 100 HOJAS',100,'hojas','Paquete de 100 hojas'],
    ['panko','PANKO AMARILLO X 1 KG',1000,'g','Bolsa de 1 kg'],
    ['soya','SALSA DE SOYA BIDON 5LT',5000,'ml','Bidón de 5 litros']
   ];
   const precios={};
   for(const [key,pattern,contenido,unidad,nota] of packs){
    const found=compras.find(x=>String(x.descripcion||'').toUpperCase().includes(pattern) && Number(x.precio_unitario)>0);
    if(found)precios[key]={precio_por_unidad:Number(found.precio_unitario)/contenido,
     contenido,unidad,nota,fecha:found.fecha,descripcion:found.descripcion,
     negocio:found.negocio,confirmacion_pendiente:true};
   }
   function calc(item){
    const kind=String(item.kind||''),name=String(item.name||''),sku=String(item.sku||'');
    const n=Number(item.rolls||1);
    let rice=0,pollo=0,queso=0,kindReal='otros',faltan='';
    if(kind==='classic'||sku.startsWith('classic:')){
      kindReal='clasico';rice=180*n;pollo=45*n;queso=25*n;
      faltan='Vegetales, envolturas, aceite, salsa, aliño y envases; los otros rellenos cambian el costo.';
    }else if(kind==='premium'||sku.startsWith('premium:')){
      kindReal='premium';rice=180*n;pollo=60*n;queso=25*n;
      faltan='Dos vegetales, cobertura premium, aceite, salsas, envases y proteínas distintas del pollo.';
    }else if(/handroll|antojo doble/i.test(name)||/handroll/i.test(sku)){
      kindReal='handroll';rice=180*n;pollo=45*n;queso=25*n;
      faltan='Vegetal, aceite, tempura o panko, salsa, envase y posibles korokes.';
    }else if(/gohan/i.test(name)){
      kindReal='gohan';rice=150;queso=40;pollo=/pollo/i.test(name)?80:0;
      faltan='Palta, cebollín, proteína si no es pollo, salsa y envase.';
    }else if(/sushi b[uo]rg/i.test(name)){
      kindReal='burger';rice=180;pollo=90;queso=30;
      faltan='Dos vegetales, apanizado, aceite, envase y papas si se incluyen.';
    }else if(kind==='monthly'&&item.piecesPerRoll===12&&Number.isInteger(item.rolls)&&item.rolls>0){
      kindReal='promocion';rice=180*n;pollo=45*n;queso=25*n;
      faltan='Vegetales, envolturas, aceite, salsas, envases, korokes y otros acompañamientos.';
    }else{
      faltan='Ingredientes, preparación y envase aún sin calcular.';
    }
    const desglose=[];
    for(const [key,quantity,ratio] of [['arroz',rice,2.7],['pollo',pollo,0.75],['queso',queso,1]]){
      if(!quantity||!precios[key])continue;
      desglose.push({ingrediente:key,gramos:quantity,
       valor:Math.round(quantity*precios[key].precio_por_unidad/ratio),
       origen:precios[key].descripcion,notas:precios[key].nota,
       fecha_compra:precios[key].fecha,negocio_compra:precios[key].negocio});
    }
    const subtotal=desglose.length?desglose.reduce((a,x)=>a+x.valor,0):null;
    return {sku:item.sku,nombre:item.name,tipo:kindReal,precio_carta:item.price,
      rolls:item.rolls,subtotal_facturas_estimado:subtotal,
      desglose,faltan,completo:false,
      receta_con_pollo_hipotetica:pollo>0,
      precio_minimo_definitivo:null,precio_maximo_definitivo:null};
   }
   return ok(res,{local:local.brand+':'+local.branch,
    productos:catalog.items.map(calc),fuentes:precios,
    consultado_en:new Date().toISOString(),
    aviso:'Los subtotales de facturas usan supuestos de rendimiento; NO incluyen todos los insumos ni gastos de vender y NO son costo final.',
    soloLectura:true,afectaCarta:false,afectaCaja:false,afectaInventario:false});
  }
  if(action==='costeo_carta_productos'){
   const negocio=body.negocio_id,sucursal=body.sucursal_id;
   await belongs(sql,negocio,sucursal);
   try{
    const catalog=await obtenerCartaCosto(req,negocio,sucursal);
    return ok(res,{sucursal_id:sucursal,store:catalog.store,items:catalog.items,soloLectura:true,
     aviso:'Precios vigentes de la carta oficial, sin modificar productos ni pedidos.'});
   }catch(e){
    return fail(res,503,'No se pudo confirmar el precio actual de esta carta. Reintenta sin introducirlo manualmente.');
   }
  }
  if(action==='costeo_ficha_guardar'){
   const negocio=body.negocio_id,sucursal=body.sucursal_id;
   if(!uuid.test(String(sucursal||'')))return fail(res,400,'Selecciona una sucursal para la receta.');
   await belongs(sql,negocio,sucursal);
   // El navegador NO fija el nombre, ni el número de rolls, ni el precio.
   // Todos vienen de la carta oficial verificada al guardar cada receta.
   const sku=String(body.catalog_sku||'');
   if(!sku||sku.length>180)return fail(res,400,'Selecciona un producto de la carta de este local.');
   let catalog;
   try{catalog=await obtenerCartaCosto(req,negocio,sucursal);}
   catch{return fail(res,503,'No se pudo confirmar la carta oficial. La receta no fue modificada.');}
   const product=catalog.items.find(x=>x.sku===sku);
   if(!product)return fail(res,409,'El producto ya no está disponible en esta carta.');
   if(!Number.isSafeInteger(product.rolls)||product.rolls<1)
    return fail(res,409,'No se pudo verificar cuántos rolls contiene. Revisa su configuración en la carta.');
   const nombre=product.name,rolls=product.rolls,precio=product.price,
    completa=body.completa===true,lineas=body.lineas;
   if(!Array.isArray(lineas)||!lineas.length||lineas.length>50)
    return fail(res,400,'Agrega los ingredientes y las cantidades reales de la receta.');
   const clean=[],ids=new Set();
   for(const x of lineas){
    const id=String(x?.insumo_id||''),unidad=String(x?.unidad||''),
      modo=String(x?.modo||''),cantidad=Number(x?.cantidad);
    if(!uuid.test(id)||!['g','ml','un'].includes(unidad)||
       !['roll','producto'].includes(modo)||
       !Number.isFinite(cantidad)||cantidad<=0||cantidad>1000000||
       Math.round(cantidad*1000)!==cantidad*1000||
       ids.has(id+'|'+modo))return fail(res,400,'Revisa los insumos y cantidades de la receta.');
    clean.push({insumo_id:id,unidad,modo,cantidad});ids.add(id+'|'+modo);
   }
   const ingredientRows=await sql.query(
    'SELECT id,unidad_compra FROM public.fin_costeo_insumos_v1 WHERE negocio_id=$1 AND sucursal_id=$2 AND id=ANY($3::uuid[])',
    [negocio,sucursal,clean.map(x=>x.insumo_id)]);
   if(new Set(ingredientRows.map(x=>String(x.id))).size!==new Set(clean.map(x=>x.insumo_id)).size)
    return fail(res,400,'Hay ingredientes de otra sucursal o sin costo registrado.');
   const kinds=new Map(ingredientRows.map(x=>[String(x.id),
      ['kg','g'].includes(x.unidad_compra)?'g':['l','ml'].includes(x.unidad_compra)?'ml':'un']));
   if(clean.some(x=>kinds.get(x.insumo_id)!==x.unidad))
    return fail(res,400,'La unidad de consumo no coincide con la unidad de compra de un ingrediente.');
   const id=body.id;
   if(id!==null&&id!==undefined&&id!==''){
    if(!uuid.test(String(id))||typeof body.version!=='string'||!Number.isFinite(Date.parse(body.version)))
     return fail(res,400,'Actualiza el listado antes de modificar la receta.');
    const r=await sql.query(
     `UPDATE public.fin_costeo_fichas_v1 SET nombre=$4,rolls=$5,precio_venta=$6,
      lineas=$7::jsonb,completa=$8,catalog_sku=$10,actualizado_en=now()
      WHERE id=$1 AND negocio_id=$2 AND sucursal_id=$3
       AND date_trunc('milliseconds',actualizado_en)=date_trunc('milliseconds',$9::timestamptz)
      RETURNING id,actualizado_en`,
     [id,negocio,sucursal,nombre,rolls,precio,JSON.stringify(clean),completa,body.version,sku]);
    if(!r.length)return fail(res,409,'La receta se modificó; actualiza el listado antes de guardarla.');
    await audit(sql,'costeo_ficha',id,'editar',who,{sucursal_id:sucursal,nombre,rolls,completa});
    return ok(res,{id:r[0].id,sucursal_id:sucursal,actualizado_en:r[0].actualizado_en,
      afectaInventario:false,afectaCaja:false});
   }
   const r=await sql.query(
    `INSERT INTO public.fin_costeo_fichas_v1(negocio_id,sucursal_id,nombre,rolls,precio_venta,lineas,completa,catalog_sku)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) ON CONFLICT DO NOTHING RETURNING id,actualizado_en`,
    [negocio,sucursal,nombre,rolls,precio,JSON.stringify(clean),completa,sku]);
   if(!r.length)return fail(res,409,'La receta ya existe para este local. Selecciona Editar.');
   await audit(sql,'costeo_ficha',r[0].id,'crear',who,{sucursal_id:sucursal,nombre,rolls,completa});
   return ok(res,{id:r[0].id,sucursal_id:sucursal,actualizado_en:r[0].actualizado_en,
    afectaInventario:false,afectaCaja:false});
  }
  if(action==='costeo_insumos_listar'){
   const negocio=body.negocio_id,sucursal=body.sucursal_id;
   if(!uuid.test(String(sucursal||'')))return fail(res,400,'Selecciona la sucursal.');
   await belongs(sql,negocio,sucursal);
   const [insumos,facturas,fichas]=await Promise.all([
    sql.query('SELECT id,negocio_id,sucursal_id,nombre,unidad_compra,cantidad_compra::text,precio_compra::text,'+
      'rendimiento_pct::text,cantidad_roll::text,origen_item_id,origen_factura_id,actualizado_en '+
      'FROM public.fin_costeo_insumos_v1 WHERE negocio_id=$1 AND sucursal_id=$2 ORDER BY nombre LIMIT 250',
      [negocio,sucursal]),
    sql.query(`SELECT i.id::text AS item_id,m.id AS factura_id,m.fecha::text AS fecha,
      m.proveedor,i.descripcion,i.cantidad::text AS cantidad_factura,i.unidad,
      i.precio_unitario::text,i.total_linea::text,
      CASE WHEN m.sucursal_id=$2 THEN 'local'
       WHEN EXISTS(SELECT 1 FROM public.fin_compra_repartos r
       WHERE r.compra_id=m.id AND r.sucursal_id=$2) THEN 'compartida'
       ELSE 'general' END AS alcance
      FROM public.fin_compra_items i
      JOIN public.fin_movimientos m ON m.id=i.compra_id
      WHERE m.negocio_id=$1 AND m.tipo='compra' AND m.fuente='factura'
       AND m.estado<>'anulado' AND i.total_linea>0
       AND (m.sucursal_id=$2 OR m.sucursal_id IS NULL
        OR EXISTS(SELECT 1 FROM public.fin_compra_repartos r
          WHERE r.compra_id=m.id AND r.sucursal_id=$2))
      ORDER BY m.fecha DESC,m.creado_en DESC,i.posicion LIMIT 180`,[negocio,sucursal]),
    sql.query('SELECT id,negocio_id,sucursal_id,nombre,rolls,precio_venta,lineas,completa,catalog_sku,actualizado_en '+
     'FROM public.fin_costeo_fichas_v1 WHERE negocio_id=$1 AND sucursal_id=$2 ORDER BY nombre LIMIT 180',
     [negocio,sucursal])
   ]);
   return ok(res,{sucursal_id:sucursal,insumos,facturas,fichas,
    nota:'El valor de línea de factura puede ser neto y no incluye automáticamente IVA, descuentos o fletes. Confirma el contenido del envase y el peso real antes de vincular.'});
  }
  if(action==='costeo_insumo_guardar'){
   const negocio=body.negocio_id,sucursal=body.sucursal_id;
   if(!uuid.test(String(sucursal||'')))return fail(res,400,'Selecciona un local válido.');
   await belongs(sql,negocio,sucursal);
   const nombre=text(body.nombre,100);
   const unidad=String(body.unidad_compra||'');
   const cantidad=Number(body.cantidad_compra),rendimiento=Number(body.rendimiento_pct??100);
   const roll=body.cantidad_roll===null||body.cantidad_roll===''||body.cantidad_roll===undefined?
     null:Number(body.cantidad_roll);
   const validNumber=n=>Number.isFinite(n)&&n>0&&n<=100000000&&
     Math.round(n*1000)===n*1000;
   if(nombre.length<2||!['kg','g','l','ml','un'].includes(unidad)||
      !validNumber(cantidad)||!Number.isFinite(rendimiento)||
      rendimiento<=0||rendimiento>100||
      Math.round(rendimiento*100)!==rendimiento*100||
      (roll!==null&&!validNumber(roll)))
    return fail(res,400,'Revisa nombre, unidad, cantidad y rendimiento del ingrediente.');
   // Fuente documental siempre se verifica en la base, nunca se confía en un
   // valor declarado por el navegador al elegir un artículo de factura.
   const itemId=body.origen_item_id==null||body.origen_item_id===''?null:String(body.origen_item_id);
   if(itemId!==null&&!/^[1-9]\d{0,16}$/.test(itemId))
    return fail(res,400,'Artículo de factura inválido.');
   let precio=Number(body.precio_compra),facturaId=null;
   if(itemId!==null){
    const rows=await sql.query(`SELECT i.total_linea,m.id AS factura_id
      FROM public.fin_compra_items i
      JOIN public.fin_movimientos m ON m.id=i.compra_id
      WHERE i.id=$1::bigint AND m.negocio_id=$2
       AND m.tipo='compra' AND m.fuente='factura' AND m.estado<>'anulado'
       AND (m.sucursal_id=$3 OR m.sucursal_id IS NULL
        OR EXISTS(SELECT 1 FROM public.fin_compra_repartos r
        WHERE r.compra_id=m.id AND r.sucursal_id=$3))`,
       [itemId,negocio,sucursal]);
    if(rows.length!==1)return fail(res,400,'La factura no corresponde a esta marca o sucursal.');
    precio=Number(rows[0].total_linea);facturaId=rows[0].factura_id;
   }
   if(!Number.isSafeInteger(precio)||precio<=0||precio>1000000000)
    return fail(res,400,'No hay un precio de compra válido para este ingrediente.');
   const id=body.id;
   let result;
   if(id!==null&&id!==undefined&&id!==''){
    if(!uuid.test(String(id))||typeof body.version!=='string'||
       !Number.isFinite(Date.parse(body.version)))
     return fail(res,400,'Actualiza antes de editar el ingrediente.');
    const old=await sql.query('SELECT nombre,precio_compra,origen_item_id FROM public.fin_costeo_insumos_v1 '+
     'WHERE id=$1 AND negocio_id=$2 AND sucursal_id=$3',[id,negocio,sucursal]);
    if(!old.length)return fail(res,404,'Ingrediente de otro local o eliminado.');
    result=await sql.query(`UPDATE public.fin_costeo_insumos_v1
     SET nombre=$4,unidad_compra=$5,cantidad_compra=$6,rendimiento_pct=$7,
      cantidad_roll=$8,precio_compra=$9,origen_item_id=$10,origen_factura_id=$11,actualizado_en=now()
     WHERE id=$1 AND negocio_id=$2 AND sucursal_id=$3
      AND date_trunc('milliseconds',actualizado_en)=date_trunc('milliseconds',$12::timestamptz)
     RETURNING id,actualizado_en`,
     [id,negocio,sucursal,nombre,unidad,cantidad,rendimiento,roll,precio,itemId,facturaId,body.version]);
    if(!result.length)return fail(res,409,'El ingrediente cambió. Actualiza y revisa el nuevo precio.');
    await audit(sql,'costeo_insumo',id,'editar',who,{
      sucursal_id:sucursal,nombre,precio,origen_item_id:itemId,
      precio_anterior:Number(old[0].precio_compra)});
   }else{
    result=await sql.query(`INSERT INTO public.fin_costeo_insumos_v1
    (negocio_id,sucursal_id,nombre,unidad_compra,cantidad_compra,precio_compra,
     rendimiento_pct,cantidad_roll,origen_item_id,origen_factura_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING
     RETURNING id,actualizado_en`,
     [negocio,sucursal,nombre,unidad,cantidad,precio,rendimiento,roll,itemId,facturaId]);
    if(!result.length)return fail(res,409,'El ingrediente ya existe en este local. Selecciona Editar.');
    await audit(sql,'costeo_insumo',result[0].id,'crear',who,{
      sucursal_id:sucursal,nombre,precio,origen_item_id:itemId});
   }
   return ok(res,{id:result[0].id,sucursal_id:sucursal,actualizado_en:result[0].actualizado_en,
    precio_compra:precio,soloCosteo:true,
    mensaje:'Precio de ingrediente guardado. Las recetas que lo utilicen tomarán este precio al consultar.'});
  }
  // Costos manuales solo por sucursal, sin tocar cierres, inventario ni caja.
  // Esta ruta solo se alcanza tras verificar Google y PIN de los dueños.
  if(action==='guardar_costo'||action==='editar_costo'){
   const negocio=body.negocio_id,sucursal=body.sucursal_id;
   if(!uuid.test(String(sucursal||'')))return fail(res,400,'Selecciona el local al que pertenece el costo.');
   await belongs(sql,negocio,sucursal);
   const nombre=text(body.nombre,100),venta=Number(body.precio_venta),
    costo=Number(body.costo_estimado),detalle=text(body.detalle,500);
   if(nombre.length<2||!Number.isSafeInteger(venta)||venta<1||venta>1000000000||
      !Number.isSafeInteger(costo)||costo<1||costo>1000000000)
    return fail(res,400,'Ingresa precio de venta y costo estimado reales para esta sucursal.');
   if(action==='guardar_costo'){
    const r=await sql.query(
     'INSERT INTO public.fin_costos_productos(negocio_id,sucursal_id,nombre,precio_venta,costo_estimado,detalle) '+
     'VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',
     [negocio,sucursal,nombre,venta,costo,detalle]);
    if(!r.length)return fail(res,409,'Ese producto ya existe en este local. Usa Editar para cambiarlo.');
    await audit(sql,'costo',r[0].id,'crear',who,{negocio_id:negocio,sucursal_id:sucursal,nombre,venta,costo});
    return ok(res,{id:r[0].id,sucursal_id:sucursal});
   }
   if(!uuid.test(String(body.id||''))||typeof body.version!=='string'||
      !Number.isFinite(Date.parse(body.version)))
    return fail(res,400,'Actualiza la lista antes de editar este costo.');
   const before=await sql.query(
    'SELECT id,nombre,precio_venta,costo_estimado,detalle,actualizado_en '+
    'FROM public.fin_costos_productos WHERE id=$1 AND negocio_id=$2 AND sucursal_id=$3',
    [body.id,negocio,sucursal]);
   if(!before.length)return fail(res,404,'El costo ya no pertenece a esta sucursal.');
   const r=await sql.query(
    'UPDATE public.fin_costos_productos SET nombre=$4,precio_venta=$5,costo_estimado=$6,detalle=$7,actualizado_en=now() '+
    'WHERE id=$1 AND negocio_id=$2 AND sucursal_id=$3 AND date_trunc(\'milliseconds\',actualizado_en)=date_trunc(\'milliseconds\',$8::timestamptz) '+
    'RETURNING id,actualizado_en',
    [body.id,negocio,sucursal,nombre,venta,costo,detalle,body.version]);
   if(!r.length)return fail(res,409,'Este costo fue modificado. Actualiza y vuelve a revisar.');
   await audit(sql,'costo',body.id,'editar',who,{
    sucursal_id:sucursal,
    antes:{nombre:before[0].nombre,precio_venta:Number(before[0].precio_venta),
     costo_estimado:Number(before[0].costo_estimado),detalle:before[0].detalle},
    despues:{nombre,precio_venta:venta,costo_estimado:costo,detalle}});
   return ok(res,{id:r[0].id,sucursal_id:sucursal,actualizado_en:r[0].actualizado_en});
  }
  if(action==='costos'){
   const negocio=body.negocio_id,sucursal=body.sucursal_id;
   if(!uuid.test(String(sucursal||'')))return fail(res,400,'Selecciona una sucursal para ver sus costos.');
   await belongs(sql,negocio,sucursal);
   const rows=await sql.query(
    'SELECT id,negocio_id,sucursal_id,nombre,precio_venta,costo_estimado,detalle,actualizado_en '+
    'FROM public.fin_costos_productos WHERE negocio_id=$1 AND sucursal_id=$2 ORDER BY nombre LIMIT 200',
    [negocio,sucursal]);
   return ok(res,{productos:rows,sucursal_id:sucursal,soloEstimaciones:true});
  }
  return fail(res,400,'Función no reconocida.');
 }catch(e){
  const msg=String(e.message||e);
  if(action==='guardar_compra_factura'&&(e.code==='23505'||/duplicate key/i.test(msg)))return fail(res,409,'Ese proveedor y folio ya están registrados para esta razón social. No se duplicó la compra.');
  if(/invalid input|violates|duplicate key|foreign key|out of range|uuid|synt[aá]x|base64/i.test(msg))return fail(res,400,'Revisa los datos del formulario antes de guardar.');
  if(/invalid|negocio|sucursal|medios|código|documento|archivo|cantidad|Revisa|Indica|Selecciona|importe/i.test(msg))return fail(res,400,msg.slice(0,230));
  console.error('Finanzas QA:',String(e.code||e.name||'error').slice(0,60));
  return fail(res,503,'No se pudo guardar ni consultar. Comprueba la conexión.');
 }
};
module.exports._testing={envOk,dbUrl,validDate,money,mimeOK,checkMethods,hash};
// Solo helpers puros para pruebas de acceso. No exponen PIN ni conexión.
module.exports._testing={envOk,dbUrl,validDate,checkMethods};
