'use strict';
/* Mi Administración · servicio privado de dueños aislado de pedidos y caja Uki.
   Acceso: Google autorizado + PIN exclusivo de finanzas; primer PIN exige clave
   de instalación privada en Vercel, con lectura protegida por PIN. */
const crypto=require('node:crypto');
const MAX_BYTES=1700000;
const MODES=new Set(['venta','gasto','compra','costo_producto','retiro','ingreso_extra']);
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
 // El formulario está en GitHub Pages, dominio ya autorizado por Firebase.
 // Solo este origen propio y el mismo deployment QA reciben autorización CORS.
 const allowedOrigin=origin==='https://diannaleandra-art.github.io'||origin===self;
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
    incluirCierres=/\\buki\\b/i.test(String(b[0]?.nombre||''));
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
  if(action==='guardar_costo'){
   await belongs(sql,body.negocio_id,null);
   const nombre=text(body.nombre,100),venta=Number(body.precio_venta),costo=Number(body.costo_estimado);
   if(nombre.length<2||!money(venta)||!money(costo))return fail(res,400,'Revisa nombre y costos.');
   const r=await sql.query('INSERT INTO public.fin_costos_productos(negocio_id,nombre,precio_venta,costo_estimado,detalle) VALUES($1,$2,$3,$4,$5) RETURNING id',[body.negocio_id,nombre,venta,costo,text(body.detalle,500)]);
   await audit(sql,'costo',r[0].id,'crear',who,{nombre,venta,costo});
   return ok(res,{id:r[0].id});
  }
  if(action==='costos'){
   const b=body.negocio_id||null;if(b)await belongs(sql,b,null);
   const rows=await sql.query('SELECT id,negocio_id,nombre,precio_venta,costo_estimado,detalle FROM public.fin_costos_productos WHERE ($1::uuid IS NULL OR negocio_id=$1) ORDER BY nombre LIMIT 200',[b]);
   return ok(res,{productos:rows});
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
