'use strict';
// Administración de Carta y precios (nunca inventario, caja ni pedidos).
const {randomUUID}=require('node:crypto');
const {url:dbUrl}=require('../lib/uki-inventario-db-live.cjs');
const {baseItems}=require('../lib/uki-catalogo-v1.cjs');
const BRANCHES=new Set(['arica','serena']);
const ALLOWED=new Set(['https://diannaleandra-art.github.io','https://uki-sushi-pedidos.vercel.app']);
const QA_REF='feature/uki-disponibilidad-manual-live-2026-11-06';
const QA_REF_ETAPA2='integracion/uki-promociones-ingredientes-seguros-qa-20261109';
const QA_MENU='https://uki-sushi-pedidos-git-feature-uki-dis-eb0d72-diannaleandra-7046.vercel.app';
const QA_PANEL='https://uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app';
const qa=env=>env.VERCEL_ENV==='preview'&&(env.VERCEL_GIT_COMMIT_REF===QA_REF||env.VERCEL_GIT_COMMIT_REF===QA_REF_ETAPA2)&&env.UKI_INVENTARIO_QA_ENABLED==='true';
const qaOrigin=(origin,env=process.env)=>qa(env)&&!!env.VERCEL_URL&&origin==='https://'+env.VERCEL_URL;
// Esta publicación requiere migración aditiva y carta compatible.
// APAGADO por defecto: el servidor conserva EXACTAMENTE la conducta previa.
const promocionesHabilitadas=(env=process.env)=>
 env.UKI_PROMOS_VISIBILIDAD_ENABLED==='true'&&
 (env.VERCEL_ENV==='production'&&env.UKI_INVENTARIO_LIVE_ENABLED==='true'||qa(env));
const originAllowed=(origin,env=process.env)=>ALLOWED.has(origin)||(qa(env)&&(origin===QA_MENU||origin===QA_PANEL))||qaOrigin(origin,env);
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
async function authorized(req,env=process.env){
 const token=String(req.headers?.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
 if(!token||token.startsWith('UKIDEV1.'))return null;
 const {createRemoteJWKSet,jwtVerify}=await import('jose');
 const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
 const {payload}=await jwtVerify(token,jwks,{issuer:'https://securetoken.google.com/uki-panel-f4909',audience:'uki-panel-f4909',algorithms:['RS256']});
 if(payload.firebase?.sign_in_provider!=='google.com')return null;
 const emails=String(env.UKI_INVENTARIO_LIVE_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase());
 const ids=String(env.UKI_INVENTARIO_LIVE_ALLOWED_UIDS||'').split(',').map(x=>x.trim());
 if(!ids.includes(payload.sub)&&!(payload.email_verified===true&&emails.includes(String(payload.email||'').toLowerCase())))return null;
 return {uid:String(payload.sub)};
}
// Estado legible para la dueña: un borrador nunca publicado no es lo mismo
// que una promoción retirada después de haberse ofrecido a clientes.
function estadoPromocion(visible,primeraPublicacion){
 return visible===true?'Publicada':primeraPublicacion?'Retirada':'Borrador';
}
function goodPrice(x){return Number.isSafeInteger(x)&&x>=1&&x<=1000000;}
function goodText(value,max=100){return typeof value==='string'&&value.trim().length>=2&&value.trim().length<=max;}
function getSKU(kind,name){return kind+':'+String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,62)+'-'+randomUUID().slice(0,8);}
function validNew(input,branch){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const kind=input.kind==='pizza'?'pizza':input.kind==='dish'?'dish':null;
 if(!kind||kind==='pizza'&&branch!=='arica'||input.group!==(kind==='pizza'?'pizzas':'entradas'))return null;
 if(!goodText(input.name)||!goodPrice(input.price)||typeof input.description!=='string'||input.description.length>500)return null;
 return {kind,group:input.group,name:input.name.trim(),description:input.description.trim(),price:input.price};
}
function validPromo(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!goodText(input.name)||
   !goodPrice(input.price)||typeof input.description!=='string'||input.description.length>500)return null;
 const count=Number(input.rollCount),per=Number(input.piecesPerRoll),
  sauce=Number(input.sauceCount),korokes=Number(input.korokes);
 if(!Number.isSafeInteger(count)||count<1||count>20||![10,12].includes(per)||
   !Number.isSafeInteger(sauce)||sauce<0||sauce>20||!Number.isSafeInteger(korokes)||korokes<0||korokes>30)
   return null;
 const allowed=new Set(['efectivo','transferencia','debito','credito','edenred']);
 const payments=Array.isArray(input.payments)?[...new Set(input.payments)]:[];
 if(payments.length<1||payments.length>5||payments.some(v=>!allowed.has(v)))return null;
 return {name:input.name.trim(),description:input.description.trim(),price:input.price,
  rollCount:count,piecesPerRoll:per,sauceCount:sauce,korokes,payments};
}
async function listing(sql,branch,conPromos=promocionesHabilitadas()){
 const [base,overrides,custom,promos,vis]=await Promise.all([
  baseItems(branch),
  sql.query("SELECT sku,price,available,version FROM public.uki_carta_items_v1 WHERE branch=$1 AND kind<>'ingredient'",[branch]),
  sql.query("SELECT sku,kind,group_key,name,description,price,available,version FROM public.uki_carta_productos_custom_v1 WHERE branch=$1 ORDER BY group_key,name",[branch]),
  conPromos?sql.query("SELECT sku,name,description,price,available,visible,published_at,version,roll_count,pieces_per_roll,size,sauce_count,korokes,payments FROM public.uki_carta_promos_custom_v1 WHERE branch=$1 ORDER BY name",[branch]):Promise.resolve([]),
  conPromos?sql.query("SELECT sku,visible,version FROM public.uki_carta_visibilidad_v1 WHERE branch=$1",[branch]):Promise.resolve([])
 ]);
 const map=new Map(overrides.map(o=>[String(o.sku),o]));
 const visMap=new Map(vis.map(v=>[String(v.sku),v]));
 const visibility=sku=>({visible:visMap.get(sku)?.visible!==false,
   visibilityVersion:Number(visMap.get(sku)?.version||0)});
 const normal=base.filter(i=>i.kind!=='ingredient').map(i=>{
  const o=map.get(i.sku);return {sku:i.sku,kind:i.kind,group:i.group_key,name:i.name,description:i.description||'',
   price:o&&o.price!==null?Number(o.price):i.price,available:o?o.available===true:true,version:o?Number(o.version):0,custom:false,
   ...visibility(i.sku)};
 });
 return [...normal,...custom.map(x=>({sku:x.sku,kind:x.kind,group:x.group_key,name:x.name,
  description:x.description,price:Number(x.price),available:x.available===true,version:Number(x.version),custom:true,
  ...visibility(x.sku)})),...promos.map(x=>({sku:x.sku,kind:'monthly',group:'promos',name:x.name,
   description:x.description,price:Number(x.price),available:x.available===true,
   visible:x.visible===true,visibilityVersion:Number(x.version),version:Number(x.version),custom:true,
   estadoPublicacion:estadoPromocion(x.visible,x.published_at),
   config:{rollCount:Number(x.roll_count),piecesPerRoll:Number(x.pieces_per_roll),size:Number(x.size),
    sauceCount:Number(x.sauce_count),korokes:Number(x.korokes),payments:x.payments}}))];
}
async function modifyPrice(sql,branch,item,price,version,uid){
 if(item.custom){
  if(item.kind==='monthly')
   return sql.query('UPDATE public.uki_carta_promos_custom_v1 SET price=$3,version=version+1,updated_by=$5,updated_at=NOW() WHERE branch=$1 AND sku=$2 AND version=$4 AND price IS DISTINCT FROM $3 RETURNING sku,price,version',[branch,item.sku,price,version,uid]);
  return sql.query("UPDATE public.uki_carta_productos_custom_v1 SET price=$3,version=version+1,updated_by=$5,updated_at=NOW() WHERE branch=$1 AND sku=$2 AND version=$4 AND price IS DISTINCT FROM $3 RETURNING sku,price,version",[branch,item.sku,price,version,uid]);
 }
 return sql.query(`INSERT INTO public.uki_carta_items_v1
 (branch,sku,kind,group_key,custom,name,description,price,available,stock_qty,stock_unit,version,updated_by)
 SELECT $1,$2,$3,$4,FALSE,$5,$6,$7,TRUE,0,'un',1,$8
 WHERE $9=0 OR EXISTS (SELECT 1 FROM public.uki_carta_items_v1 WHERE branch=$1 AND sku=$2 AND version=$9)
 ON CONFLICT(branch,sku) DO UPDATE SET price=$7,version=public.uki_carta_items_v1.version+1,updated_by=$8,updated_at=NOW()
 WHERE public.uki_carta_items_v1.version=$9 AND public.uki_carta_items_v1.price IS DISTINCT FROM $7
 RETURNING sku,price,version`,[branch,item.sku,item.kind,item.group,item.name,item.description,price,uid,version]);
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 res.setHeader('X-Content-Type-Options','nosniff');
 const origin=String(req.headers?.origin||'');
 if(origin&&originAllowed(origin)){res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');}
 if(req.method==='OPTIONS')return res.status(originAllowed(origin)?204:403).end();
 if(!['GET','POST'].includes(req.method))return fail(res,405,'Método no permitido');
 if(origin&&!originAllowed(origin))return fail(res,403,'Origen no autorizado');
 const branch=String(req.method==='GET'?req.query?.branch||'':req.body?.branch||'');
 if(!BRANCHES.has(branch))return fail(res,400,'Sucursal inválida');
 const url=dbUrl();if(!url)return fail(res,503,'Servicio de carta no disponible');
 let sql;try{sql=require('@neondatabase/serverless').neon(url);}catch{return fail(res,503,'Servicio no disponible');}
 try{
  if(req.method==='GET'){
   // Incluir visibilidad explícita para que la carta pueda ocultar también
   // promociones originales, sin borrar los pedidos que las utilizaron.
   const nuevos=promocionesHabilitadas();
   const items=(await listing(sql,branch,nuevos)).filter(i=>nuevos||!i.custom||i.available);
   return res.status(200).json({ok:true,branch,items,promocionesHabilitadas:nuevos});
  }
  if(origin!=='https://diannaleandra-art.github.io'&&!(qa(process.env)&&origin===QA_PANEL)&&!qaOrigin(origin))
   return fail(res,403,'Solo administración');
  if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')return fail(res,415,'Se requiere JSON');
  if(!req.body||JSON.stringify(req.body).length>1800)return fail(res,400,'Solicitud inválida');
  const user=await authorized(req).catch(()=>null);if(!user)return fail(res,403,'Solo administración Google autorizada');
  const action=String(req.body.action||'');
  if(action==='listar')return res.status(200).json({ok:true,branch,
   items:await listing(sql,branch),promocionesHabilitadas:promocionesHabilitadas()});
  if(!promocionesHabilitadas()&&['crear-promocion','editar-promocion','publicar-promocion'].includes(action))
   return fail(res,503,'Promociones aún no habilitadas: falta publicación conjunta de carta y servidor.');
  if(action==='crear-promocion'){
   const p=validPromo(req.body.item);if(!p)return fail(res,400,'Revisa rolls, piezas, salsas, korokes, medios y precio.');
   const sku=getSKU('monthly',p.name);
   const rows=await sql.query(`INSERT INTO public.uki_carta_promos_custom_v1
    (branch,sku,name,description,price,roll_count,pieces_per_roll,sauce_count,korokes,payments,visible,updated_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text[],false,$11)
    RETURNING sku,version,visible`,
    [branch,sku,p.name,p.description,p.price,p.rollCount,p.piecesPerRoll,p.sauceCount,p.korokes,p.payments,user.uid]);
   return res.status(201).json({ok:true,branch,item:rows[0],
    message:'Promoción creada como borrador. Agrega fotografía para publicarla.'});
  }
  if(action==='crear-producto'){
   const input=validNew(req.body.item,branch);if(!input)return fail(res,400,'Solo pizzas de Regimiento Arica y entradas simples; revisa nombre y precio');
   const sku=getSKU(input.kind,input.name);
   const rows=await sql.query(`INSERT INTO public.uki_carta_productos_custom_v1
   (branch,sku,kind,group_key,name,description,price,updated_by)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
   RETURNING sku,kind,group_key,name,description,price,available,version`,
   [branch,sku,input.kind,input.group,input.name,input.description,input.price,user.uid]);
   return res.status(201).json({ok:true,branch,item:rows[0]});
  }
  if(!['editar-precio','editar-producto','editar-promocion','publicar-promocion','retirar-producto','restaurar-producto'].includes(action))return fail(res,400,'Acción no permitida');
  const sku=String(req.body.sku||''),version=req.body.expected_version;
  if(!Number.isSafeInteger(version)||version<0||!sku||sku.length>120)return fail(res,400,'Actualiza la lista y vuelve a intentar');
  const items=await listing(sql,branch),entry=items.find(x=>x.sku===sku);
  if(!entry)return fail(res,404,'Producto no encontrado');
  if(!promocionesHabilitadas()&&(action==='retirar-producto'||action==='restaurar-producto')){
   // Compatibilidad operativa con el panel anterior, sin tabla de visibilidad.
   if(!entry.custom)return fail(res,400,'Los productos originales se controlan con Disponible/Agotado; solo puedes retirar los agregados.');
   const disponible=action==='restaurar-producto';
   if(entry.available===disponible)return fail(res,409,'El producto ya tiene ese estado.');
   const changed=await sql.query('UPDATE public.uki_carta_productos_custom_v1 SET available=$3,version=version+1,updated_by=$5,updated_at=NOW() WHERE branch=$1 AND sku=$2 AND available IS DISTINCT FROM $3 AND version=$4 RETURNING sku,available,version',
    [branch,sku,disponible,version,user.uid]);
   if(!changed.length)return fail(res,409,'El producto cambió. Actualiza antes de continuar.');
   return res.status(200).json({ok:true,branch,item:changed[0]});
  }
  if(action==='retirar-producto'||action==='restaurar-producto'||action==='publicar-promocion'){
   const visible=action!=='retirar-producto';
   if(action==='publicar-promocion'&&entry.kind!=='monthly')return fail(res,400,'Solo una promoción puede publicarse con fotografía');
   if(entry.visible===visible)return fail(res,409,'El producto ya tiene ese estado. Actualiza la lista.');
   // Las promos nuevas se publican solamente con una foto guardada en Neon.
   if(entry.kind==='monthly'&&entry.custom&&visible){
    const photo=await sql.query('SELECT 1 FROM public.uki_carta_fotos_v1 WHERE branch=$1 AND sku=$2 LIMIT 1',[branch,sku]);
    if(!photo.length)return fail(res,409,'Primero sube la fotografía de la promoción.');
   }
   if(entry.kind==='monthly'&&entry.custom){
    const changed=await sql.query('UPDATE public.uki_carta_promos_custom_v1 SET visible=$3,published_at=CASE WHEN $3 THEN COALESCE(published_at,NOW()) ELSE published_at END,version=version+1,updated_by=$5,updated_at=NOW() WHERE branch=$1 AND sku=$2 AND version=$4 AND visible IS DISTINCT FROM $3 RETURNING sku,visible,published_at,version',
      [branch,sku,visible,version,user.uid]);
    if(!changed.length)return fail(res,409,'La promoción cambió. Actualiza antes de continuar.');
    return res.status(200).json({ok:true,branch,item:changed[0]});
   }
   const visVersion=req.body.expected_visibility_version;
   if(!Number.isSafeInteger(visVersion)||visVersion<0||visVersion!==entry.visibilityVersion)
    return fail(res,409,'Actualiza la lista antes de cambiar su visibilidad.');
   const changed=await sql.query(`INSERT INTO public.uki_carta_visibilidad_v1
    (branch,sku,visible,version,updated_by) SELECT $1,$2,$3,1,$5 WHERE $4=0
    ON CONFLICT(branch,sku) DO UPDATE SET visible=$3,version=public.uki_carta_visibilidad_v1.version+1,updated_by=$5,updated_at=now()
    WHERE public.uki_carta_visibilidad_v1.version=$4 AND public.uki_carta_visibilidad_v1.visible IS DISTINCT FROM $3
    RETURNING sku,visible,version`,[branch,sku,visible,visVersion,user.uid]);
   if(!changed.length)return fail(res,409,'La visibilidad cambió en otro dispositivo. Actualiza y repite.');
   return res.status(200).json({ok:true,branch,item:changed[0]});
  }
  if(action==='editar-promocion'){
   if(!entry.custom||entry.kind!=='monthly')return fail(res,400,'Esta opción es exclusiva de promociones agregadas.');
   const p=validPromo(req.body.item);if(!p)return fail(res,400,'Revisa la composición de la promoción.');
   const changed=await sql.query(`UPDATE public.uki_carta_promos_custom_v1
     SET name=$3,description=$4,price=$5,roll_count=$6,pieces_per_roll=$7,sauce_count=$8,
       korokes=$9,payments=$10::text[],version=version+1,updated_by=$12,updated_at=now()
     WHERE branch=$1 AND sku=$2 AND version=$11
     RETURNING sku,version`,[branch,sku,p.name,p.description,p.price,p.rollCount,p.piecesPerRoll,p.sauceCount,p.korokes,p.payments,version,user.uid]);
   if(!changed.length)return fail(res,409,'La promoción cambió. Actualiza la lista.');
   return res.status(200).json({ok:true,branch,item:changed[0]});
  }
  if(!goodPrice(req.body.price))return fail(res,400,'Precio inválido');
  let rows;
  if(action==='editar-precio')rows=await modifyPrice(sql,branch,entry,req.body.price,version,user.uid);
  else{
   if(!entry.custom||entry.kind==='monthly'||!goodText(req.body.name)||typeof req.body.description!=='string'||req.body.description.length>500)
    return fail(res,400,'Solo se puede renombrar un producto agregado desde aquí');
   rows=await sql.query(`UPDATE public.uki_carta_productos_custom_v1 SET name=$3,description=$4,price=$5,
     version=version+1,updated_by=$7,updated_at=NOW()
    WHERE branch=$1 AND sku=$2 AND version=$6
    RETURNING sku,name,description,price,version`,
   [branch,sku,req.body.name.trim(),req.body.description.trim(),req.body.price,version,user.uid]);
  }
  if(!rows.length)return fail(res,409,'El producto cambió o ya tiene ese precio. Actualiza la lista.');
  return res.status(200).json({ok:true,branch,item:rows[0]});
 }catch(e){console.error('Carta precios',String(e?.code||e?.name||'error').slice(0,60));
  return fail(res,503,'No se pudo completar la operación. Inventario y caja siguen intactos');}
};
module.exports._testing={goodPrice,validNew,validPromo,originAllowed,getSKU,listing,modifyPrice,promocionesHabilitadas,estadoPromocion};
