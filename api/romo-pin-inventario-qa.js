'use strict';
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
// Mismo servicio de inventario del proyecto Uki. Alcance exclusivo Romo.
// El PIN del trabajador NO concede sesión Google, acceso a pedidos ni caja.
const {createHmac}=require('node:crypto');
const pin=require('../lib/uki-inventario-pin-live.cjs');
const STORE='romo:serena';
const fail=(r,n,s)=>r.status(n).json({ok:false,storeId:STORE,error:s});
const reject=x=>!x||typeof x!=='object'||Array.isArray(x);
function configuration(env){
 if(!entornoPanelRomoAutorizado(env)||
  env.ROMO_PIN_INVENTARIO_QA_ENABLED!=='true'||
  env.ROMO_INVENTARIO_LECTURA_QA_ENABLED!=='true')return null;
 const origin=String(env.ROMO_PANEL_ALLOWED_ORIGIN||'');
 const host=String(env.ROMO_PRIVATE_DATABASE_HOST||'').toLowerCase();
 const salt=String(env.ROMO_SOLICITUDES_RATE_SALT||'');
 let db;try{db=new URL(String(env.ROMO_PRIVATE_DATABASE_URL||''))}catch{return null}
 if(!/^https:\/\/[^\/\s?#@]+$/.test(origin)||!host||
  !['postgres:','postgresql:'].includes(db.protocol)||db.hostname.toLowerCase()!==host||
  db.pathname!=='/romos_sushi'||db.username!=='romos_app_service'||!db.password||
  salt.length<48)return null;
 return {origin,database:db.toString(),salt,
  write:env.ROMO_INVENTARIO_ESCRITURA_QA_ENABLED==='true'};
}
function fingerprint(req,salt){
 const ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'desconocido').split(',')[0].trim();
 return createHmac('sha256',salt).update('romo-inventario-trabajador-v1|'+ip.slice(0,100)).digest('hex');
}
async function workerAuthorized(db,code,identity){
 // Bloqueo atómico compartido por los dispositivos de un origen IP.
 // Se aplica ANTES de comparar PBKDF2 para limitar la fuerza bruta.
 const attempts=await db.query(`INSERT INTO public.romo_pin_intentos_v1 AS p
  (store_id,identidad_hash,fallos,bloqueado_hasta,actualizado_en)
  VALUES($1,$2,1,NULL,now())
  ON CONFLICT (store_id,identidad_hash) DO UPDATE SET
  fallos=CASE WHEN p.actualizado_en<now()-interval '15 minutes'
   THEN 1 ELSE LEAST(p.fallos+1,5) END,
  bloqueado_hasta=CASE WHEN p.actualizado_en<now()-interval '15 minutes' THEN NULL
   WHEN p.fallos+1>=5 THEN now()+interval '15 minutes' ELSE NULL END,
  actualizado_en=now()
  WHERE p.bloqueado_hasta IS NULL OR p.bloqueado_hasta<=now()
  RETURNING fallos`,[STORE,identity]);
 if(attempts.length!==1)return false;
 const rows=await db.query('SELECT salt,hash FROM public.romo_pin_inventario_v1 WHERE store_id=$1 LIMIT 1',[STORE]);
 if(rows.length!==1||!pin.comprobar(code,rows[0]))return false;
 await db.query('DELETE FROM public.romo_pin_intentos_v1 WHERE store_id=$1 AND identidad_hash=$2',[STORE,identity]);
 return true;
}
module.exports=async function romoPinInventarioQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const cfg=configuration(process.env);
 if(!cfg)return fail(res,503,'Acceso del trabajador Romo todavía no habilitado');
 const origin=String(req.headers?.origin||'');
 if(origin!==cfg.origin)return fail(res,403,'Origen de inventario no autorizado');
 res.setHeader('Access-Control-Allow-Origin',cfg.origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
 res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return fail(res,405,'Método no permitido');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Se requiere JSON');
 const body=req.body;
 if(reject(body)||JSON.stringify(body).length>5000)
  return fail(res,400,'Formulario de inventario inválido');
 const action=String(body.action||'');
 if(!['estado','crear-codigo','listar','conteo','entrada','finalizar','justificar'].includes(action))
  return fail(res,400,'Operación no permitida');
 try{
  const neon=require('@neondatabase/serverless').neon(cfg.database);
  const db={query:(sql,args)=>neon.query(sql,args)};
  if(['estado','crear-codigo'].includes(action)){
   const mod=await import('../lib/romo-identidad-servidor-qa.mjs');
   const identity=await mod.resolveRomoIdentity({
    authorization:req.headers?.authorization,db,verifyToken:mod.verifyFirebaseGoogleToken
   });
   if(identity?.role!=='duenos')return fail(res,403,'Solo dueños pueden configurar el PIN de Romo');
   const rows=await db.query('SELECT 1 FROM public.romo_pin_inventario_v1 WHERE store_id=$1 LIMIT 1',[STORE]);
   if(action==='estado')return res.status(200).json({ok:true,storeId:STORE,configurado:rows.length===1});
   if(!cfg.write)return fail(res,503,'La creación de PIN está deshabilitada');
   if(Object.keys(body).sort().join('|')!=='action|codigo'||!pin.valido(body.codigo))
    return fail(res,400,'Elige seis números para el PIN de inventario');
   if(rows.length)return fail(res,409,'El PIN de Romo ya está configurado');
   const secret=pin.crear(body.codigo);
   const created=await db.query(`INSERT INTO public.romo_pin_inventario_v1
    (store_id,salt,hash,creado_por,actualizado_en) VALUES($1,$2,$3,$4,now())
    ON CONFLICT (store_id) DO NOTHING RETURNING store_id`,
    [STORE,secret.salt,secret.hash,identity.userId]);
   return created.length?res.status(201).json({ok:true,storeId:STORE,configurado:true}):
    fail(res,409,'El PIN de Romo ya existe');
  }
  const name=String(body.worker_name||'').trim().replace(/\s+/g,' ');
  if(!pin.valido(body.codigo)||name.length<2||name.length>60)
   return fail(res,400,'Indica nombre y PIN de seis números');
  const fp=fingerprint(req,cfg.salt);
  if(!await workerAuthorized(db,body.codigo,fp))
   return fail(res,403,'PIN incorrecto o temporalmente bloqueado');
  const inv=await import('../lib/romo-inventario-qa.mjs');
  const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,45);
  const identity={brand:'romo',branches:['serena'],role:'inventario',
   userId:'inv_'+slug+'_'+fp.slice(0,12)};
  if(action==='listar'){
   const data=await inv.readInventarioRomoQA({db,identity});
   const {facturas,...contenido}=data.contenido;
   return res.status(200).json({ok:true,...data,contenido});
  }
  if(!cfg.write)return fail(res,503,'El inventario Romo está en consulta');
  if(action==='justificar'){
   if(process.env.ROMO_INVENTARIO_JUSTIFICACIONES_ENABLED!=='true')return fail(res,503,'Registro de movimientos aún no habilitado.');
   const data=await inv.readInventarioRomoQA({db,identity});
   const item=data.contenido.items.find(x=>x.sku===body.sku&&!x.archived);
   if(!item)return fail(res,404,'Insumo no encontrado en esta sucursal.');
   const lib=require('../lib/inventario-justificaciones-v1.cjs');
   const result=await lib.save(db,lib.validate(STORE,body,item,name));
   return res.status(200).json({...result,storeId:STORE});
  }
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)
   return fail(res,400,'Actualiza el inventario antes de guardar');
  let operation,args;
  if(action==='conteo'){
   operation='conteo';
   args={sku:String(body.sku||''),stock_qty:body.cantidad};
  }else if(action==='entrada'){
   operation='entrada';
   args={sku:String(body.sku||''),cantidad:body.cantidad};
  }else{
   if(!Number.isSafeInteger(body.contados)||!Number.isSafeInteger(body.entradas))
    return fail(res,400,'Resumen de turno inválido');
   operation='revision';
   args={sku:'r_revision',contados:body.contados,entradas:body.entradas,worker_name:name};
  }
  const saved=await inv.guardarOperacionInventarioRomoQA({db,identity,
   expectedRevision:body.expectedRevision,action:operation,args});
  return res.status(200).json({ok:true,...saved,guardado:true});
 }catch(e){
  if([400,409].includes(e?.status))return fail(res,e.status,String(e.message));
  if(e?.code==='REVISION_CONFLICTO')return fail(res,409,'Otro equipo cambió el inventario; actualiza antes de volver a guardar');
  if(/Cantidad|entrada|no existe|archivado|Revisión|Resumen|SKU|inválido|artículo|nombre/i.test(String(e?.message||'')))
   return fail(res,400,'Revisa las cantidades y actualiza el inventario');
  return fail(res,503,'El inventario Romo no confirmó la operación');
 }
};
module.exports._internalQA={configuration};
