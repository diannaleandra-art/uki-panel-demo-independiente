'use strict';
/* Mi Administración · backend QA aislado, nunca opera sobre caja/pedidos Uki.
   Acceso: Google autorizado + PIN exclusivo de finanzas; primer PIN exige clave
   de instalación privada en Vercel. No habilitar producción sin revisión. */
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
const envOk=(e=process.env)=>e.VERCEL_ENV==='preview'&&e.UKI_FIN_QA_ENABLED==='true'; // Nunca en producción.
function dbUrl(e=process.env){
 if(!envOk(e))return null;
 // Reusar exclusivamente la conexión QA ya habilitada, nunca producción.
 const candidate=e.UKI_FIN_QA_DATABASE_URL; // Solo la conexión QA independiente de finanzas.
 if(!candidate)return null;
 let url;try{url=new URL(candidate)}catch{return null}
 if(!['postgres:','postgresql:'].includes(url.protocol))return null;
 const hosts=new Set(['ep-lingering-glade-b5m4hfhu.c-7.us-east-2.aws.neon.tech',
  'ep-lingering-glade-b5m4hfhu-pooler.c-7.us-east-2.aws.neon.tech']);
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
 if(!envOk())return fail(res,404,'Este módulo financiero todavía no está habilitado.');
 if(req.method==='OPTIONS')return res.status(allowedOrigin?204:403).end();
 if(req.method!=='POST'||!allowedOrigin)return fail(res,403,'Origen no permitido.');
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return fail(res,415,'Solo JSON.');
 const body=req.body||{};
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2600000)return fail(res,413,'Solicitud demasiado grande.');
 const who=await google(req).catch(()=>null);
 if(!who)return fail(res,403,'Acceso Google no autorizado.');
 const db=dbUrl();
 if(!db)return fail(res,503,'Base de pruebas financiera no configurada.');
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
   const secret=String(process.env.UKI_FIN_QA_BOOTSTRAP_KEY||'');
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
  if(action==='salir'){
   await sql.query('DELETE FROM public.fin_sesiones WHERE token_hash=$1 AND usuario_uid=$2',[hash(req.headers['x-fin-session']),who.uid]);
   return ok(res,{cerrado:true});
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
  if(action==='guardar_movimiento'){
   const tipo=String(body.tipo||''),monto=Number(body.monto),fecha=body.fecha;
   if(!MODES.has(tipo)||!money(monto)||!validDate(fecha))return fail(res,400,'Revisa tipo, monto y fecha.');
   await belongs(sql,body.negocio_id,body.sucursal_id||null);
   const medios=checkMethods(body.medios||{});
   if(tipo==='venta'&&Object.keys(medios).length&&Object.values(medios).reduce((a,b)=>a+b,0)!==monto)
    return fail(res,409,'La suma de los medios de pago debe coincidir con la venta.');
   const fuente=body.fuente==='cierre'?'cierre':'manual';
   const referencia=text(body.referencia,130),concepto=text(body.concepto,240);
   if(fuente==='cierre'&&referencia.length<3)return fail(res,400,'Indica el número o referencia del cierre.');
   const clave=fuente==='cierre'?hash(['cierre',body.negocio_id,body.sucursal_id||'',fecha,referencia.toLowerCase()].join('|')):null;
   if(tipo==='venta'&&!body.confirmar_duplicado){
    const dupe=await sql.query("SELECT id FROM public.fin_movimientos WHERE negocio_id=$1 AND sucursal_id IS NOT DISTINCT FROM $2::uuid AND fecha=$3 AND tipo='venta' AND estado<>'anulado' LIMIT 3",[body.negocio_id,body.sucursal_id||null,fecha]);
    if(dupe.length)return fail(res,409,'Ya existen ventas ese día para este local. Confirma que no estás duplicando un cierre.');
   }
   const estado=['gasto','compra','retiro'].includes(tipo)&&body.pendiente===true?'pendiente':(['gasto','compra','retiro'].includes(tipo)?'pagado':'registrado');
   const datos=typeof body.datos==='object'&&body.datos&&!Array.isArray(body.datos)?body.datos:{};
   if(JSON.stringify(datos).length>3000)return fail(res,413,'Demasiados detalles.');
   const r=await sql.query('INSERT INTO public.fin_movimientos(negocio_id,sucursal_id,tipo,fecha,monto,medios,categoria,concepto,proveedor,referencia,estado,fuente,datos,clave_unica,creado_por) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15) ON CONFLICT DO NOTHING RETURNING id',
    [body.negocio_id,body.sucursal_id||null,tipo,fecha,monto,JSON.stringify(medios),text(body.categoria,90),concepto,text(body.proveedor,120),referencia,estado,fuente,JSON.stringify(datos),clave,who.uid]);
   if(!r.length)return fail(res,409,'Ese cierre ya se importó anteriormente. No se duplicó.');
   await audit(sql,'movimiento',r[0].id,'crear',who,{tipo,fecha,monto,negocio_id:body.negocio_id,sucursal_id:body.sucursal_id,fuente});
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
  if(action==='listar_movimientos'){
   const b=body.negocio_id||null,s=body.sucursal_id||null;
   if(b)await belongs(sql,b,s);
   else if(s)return fail(res,400,'Selecciona negocio.');
   const from=validDate(body.desde)?body.desde:'2000-01-01';
   const to=validDate(body.hasta)?body.hasta:'2099-12-31';
   const r=await sql.query('SELECT id,negocio_id,sucursal_id,tipo,fecha,monto,medios,categoria,concepto,proveedor,referencia,estado,fuente,datos,creado_en FROM public.fin_movimientos WHERE ($1::uuid IS NULL OR negocio_id=$1) AND ($2::uuid IS NULL OR sucursal_id=$2) AND fecha BETWEEN $3 AND $4 ORDER BY fecha DESC, creado_en DESC LIMIT 250',[b,s,from,to]);
   return ok(res,{movimientos:r});
  }
  if(action==='anular_movimiento'){
   if(!uuid.test(String(body.id||'')))return fail(res,400,'Registro inválido.');
   const old=await sql.query('SELECT id,estado,tipo,fecha,monto,negocio_id FROM public.fin_movimientos WHERE id=$1',[body.id]);
   if(!old.length)return fail(res,404,'No se encontró el registro.');
   if(old[0].estado==='anulado')return fail(res,409,'Ya estaba anulado.');
   await sql.query("UPDATE public.fin_movimientos SET estado='anulado',actualizado_en=now() WHERE id=$1",[body.id]);
   await audit(sql,'movimiento',body.id,'anular',who,old[0]);
   return ok(res,{anulado:true});
  }
  if(action==='marcar_pagado'){
   if(!uuid.test(String(body.id||'')))return fail(res,400,'Registro inválido.');
   if(!validDate(body.fecha_pago))return fail(res,400,'Selecciona la fecha real del pago.');
   const rows=await sql.query("UPDATE public.fin_movimientos SET estado='pagado',datos=coalesce(datos,'{}'::jsonb)||jsonb_build_object('fecha_pago',$2::text),actualizado_en=now() WHERE id=$1 AND tipo IN ('gasto','compra','retiro') AND estado='pendiente' RETURNING id,tipo,monto,fecha,negocio_id",[body.id,body.fecha_pago]);
   if(!rows.length)return fail(res,409,'Solo se puede pagar un gasto, compra o retiro que esté pendiente.');
   await audit(sql,'movimiento',body.id,'pagar',who,{antes:'pendiente',despues:'pagado',fecha_pago:validDate(body.fecha_pago)?body.fecha_pago:null});
   return ok(res,{pagado:true});
  }
  if(action==='resumen'){
   const b=body.negocio_id||null,s=body.sucursal_id||null;
   if(b)await belongs(sql,b,s);
   else if(s)return fail(res,400,'Selecciona negocio.');
   const from=validDate(body.desde)?body.desde:'2000-01-01';
   const to=validDate(body.hasta)?body.hasta:'2099-12-31';
   const rows=await sql.query("SELECT tipo,estado,SUM(monto)::bigint AS total,COUNT(*)::int AS cantidad FROM public.fin_movimientos WHERE ($1::uuid IS NULL OR negocio_id=$1) AND ($2::uuid IS NULL OR sucursal_id=$2) AND fecha BETWEEN $3 AND $4 AND estado<>'anulado' GROUP BY tipo,estado",[b,s,from,to]);
   // El desglose de pagos usa todas las ventas del período (no solamente los 250 registros del historial).
   const pagos=await sql.query("SELECT pago.key AS medio,SUM((pago.value)::bigint)::bigint AS total FROM public.fin_movimientos m CROSS JOIN LATERAL jsonb_each_text(m.medios) AS pago(key,value) WHERE ($1::uuid IS NULL OR m.negocio_id=$1) AND ($2::uuid IS NULL OR m.sucursal_id=$2) AND m.fecha BETWEEN $3 AND $4 AND m.tipo='venta' AND m.estado<>'anulado' GROUP BY pago.key ORDER BY pago.key",[b,s,from,to]);
   return ok(res,{resumen:rows,pagos,nota:'Resultado preliminar = ventas - gastos y compras pagadas. No es utilidad contable definitiva.'});
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
   if(movimiento){
    if(!uuid.test(String(movimiento)))return fail(res,400,'Referencia inválida.');
    const linked=await sql.query('SELECT 1 FROM public.fin_movimientos WHERE id=$1 AND negocio_id=$2',[movimiento,body.negocio_id]);
    if(!linked.length)return fail(res,400,'La referencia pertenece a otro negocio.');
   }
   const r=await sql.query('INSERT INTO public.fin_documentos(negocio_id,sucursal_id,movimiento_id,nombre,mime,bytes,contenido,sha256,tipo,fecha_documento,proveedor,creado_por) VALUES($1,$2,$3,$4,$5,$6,decode($7,\'hex\'),$8,$9,$10,$11,$12) RETURNING id',
   [body.negocio_id,body.sucursal_id||null,movimiento,name,mime,buffer.length,buffer.toString('hex'),hash(buffer),tipo,validDate(body.fecha_documento)?body.fecha_documento:null,text(body.proveedor,120),who.uid]);
   await audit(sql,'documento',r[0].id,'cargar',who,{nombre:name,mime,bytes:buffer.length,tipo});
   return ok(res,{id:r[0].id});
  }
  if(action==='documentos'){
   const b=body.negocio_id||null;
   if(b)await belongs(sql,b,null);
   const rows=await sql.query('SELECT id,negocio_id,sucursal_id,movimiento_id,nombre,mime,bytes,tipo,fecha_documento,proveedor,creado_en FROM public.fin_documentos WHERE ($1::uuid IS NULL OR negocio_id=$1) ORDER BY creado_en DESC LIMIT 100',[b]);
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
  if(/invalid input|violates|duplicate key|foreign key|out of range|uuid|synt[aá]x|base64/i.test(msg))return fail(res,400,'Revisa los datos del formulario antes de guardar.');
  if(/invalid|negocio|sucursal|medios|código|documento|archivo|cantidad|Revisa|Indica|Selecciona|importe/i.test(msg))return fail(res,400,msg.slice(0,230));
  console.error('Finanzas QA:',String(e.code||e.name||'error').slice(0,60));
  return fail(res,503,'No se pudo guardar ni consultar. Comprueba la conexión.');
 }
};
module.exports._testing={envOk,dbUrl,validDate,money,mimeOK,checkMethods,hash};