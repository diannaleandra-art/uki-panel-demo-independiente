'use strict';
/* Archivo mensual de dueños: Google y PIN ya verificados por mi-administracion-live.
 * Los datos comprimidos se cifran antes de almacenarlos; nunca se borran cierres.
 */
const crypto=require('node:crypto'),zlib=require('node:zlib');
const LOCAL={'uki:arica':'Uki Regimiento Arica','uki:serena':'Uki La Serena',
 'romo:serena':'Romo’s Sushi La Serena'};
const SECTIONS=['pedidos','cierres','gastos','retiros','propinas','deliveriesManuales',
 'incidencias','ajustesHistoricos','solicitudesWhatsApp','clientes'];
const validObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const todayChile=()=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
};
function fechaHabilitacion(mes){
 if(typeof mes!=='string'||!/^20\d\d-(0[1-9]|1[0-2])$/.test(mes))return null;
 return new Date(Date.UTC(Number(mes.slice(0,4)),Number(mes.slice(5)),5)).toISOString().slice(0,10);
}
function validateArchive(doc,sucursal,mes){
 if(!validObj(doc)||doc.formato!=='uki-archivo-mensual-v1'||
  doc.sucursal!==LOCAL[sucursal]||doc.mes!==mes||!validObj(doc.secciones)||
  Object.keys(doc.secciones).sort().join('|')!==[...SECTIONS].sort().join('|'))
  throw Error('Informe mensual de otra sucursal o período');
 const conteos={};
 for(const section of SECTIONS){
  const entries=doc.secciones[section];
  if(!Array.isArray(entries)||entries.length>20000||entries.some(e=>!validObj(e)))
   throw Error('Contenido mensual incorrecto');
  if(section!=='clientes'&&entries.some(e=>e.suc!==LOCAL[sucursal]))
   throw Error('Registros de una sucursal diferente');
  conteos[section]=entries.length;
 }
 return conteos;
}
const fail=(res,n,msg)=>res.status(n).json({ok:false,error:msg});
const ok=(res,data)=>res.status(200).json({ok:true,...data});
module.exports=async({sql,body,who,res,env=process.env})=>{
 const action=body.action,keyText=String(env.UKI_FIN_ARCHIVO_AES_KEY||'');
 if(env.UKI_FIN_ARCHIVO_MENSUAL_ENABLED!=='true'||!/^[0-9a-f]{64}$/i.test(keyText))
  return fail(res,503,'Archivo mensual privado no configurado');
 const key=Buffer.from(keyText,'hex');
 if(action==='archivo_operativo_listar'){
  const year=String(body.anio||'');
  if(!/^(20\d\d|todos)$/.test(year))return fail(res,400,'Año de consulta inválido');
  const archives=await sql.query(
   "SELECT id,sucursal,mes,sha256,conteos,creado_en,bytes_comprimidos FROM public.fin_archivos_operativos_v1 "+
   "WHERE ($1='todos' OR left(mes,4)=$1) ORDER BY mes DESC,creado_en DESC LIMIT 400",[year]);
  return ok(res,{archivos:archives,permanentes:true});
 }
 if(action==='archivo_operativo_obtener'){
  const id=String(body.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id))return fail(res,400,'Identificador inválido');
  const rows=await sql.query("SELECT sucursal,mes,sha256,encode(iv,'hex') AS iv_hex,encode(tag,'hex') AS tag_hex,encode(payload_cifrado,'base64') AS payload_base64,conteos FROM public.fin_archivos_operativos_v1 WHERE id=$1::uuid LIMIT 1",[id]);
  if(rows.length!==1)return fail(res,404,'Archivo no encontrado');
  const x=rows[0],dec=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(x.iv_hex,'hex'));
  dec.setAuthTag(Buffer.from(x.tag_hex,'hex'));
  const packed=Buffer.concat([dec.update(Buffer.from(x.payload_base64.replace(/\s/g,''),'base64')),dec.final()]);
  if(crypto.createHash('sha256').update(packed).digest('hex')!==x.sha256)
   throw Error('Fallo al verificar la integridad del archivo');
  return ok(res,{sucursal:x.sucursal,mes:x.mes,sha256:x.sha256,
   comprimido:packed.toString('base64'),conteos:x.conteos,verificado:true});
 }
 if(action!=='archivo_operativo_guardar')return fail(res,400,'Acción no reconocida');
 const sucursal=String(body.sucursal||''),mes=String(body.mes||'');
 const fecha=fechaHabilitacion(mes);
 if(!LOCAL[sucursal]||!fecha||mes<'2026-11'||fecha>todayChile())
  return fail(res,409,'Primer ciclo autorizado: 5 de diciembre de 2026');
 const b64=String(body.comprimido||'');
 if(b64.length<30||b64.length>2100000||!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))
  return fail(res,413,'Informe comprimido demasiado grande');
 const bytes=Buffer.from(b64,'base64');
 if(bytes.length<30||bytes.length>1550000)return fail(res,413,'Archivo fuera del límite');
 const sha=crypto.createHash('sha256').update(bytes).digest('hex');
 if(sha!==body.sha256)return fail(res,400,'Huella del archivo incorrecta');
 let doc,conteos;
 try{
  doc=JSON.parse(zlib.gunzipSync(bytes,{maxOutputLength:8*1024*1024}).toString('utf8'));
  conteos=validateArchive(doc,sucursal,mes);
 }catch{return fail(res,400,'Informe no válido o de otra sucursal');}
 const iv=crypto.randomBytes(12),enc=crypto.createCipheriv('aes-256-gcm',key,iv);
 const cipher=Buffer.concat([enc.update(bytes),enc.final()]);
 await sql.query(
  'INSERT INTO public.fin_archivos_operativos_v1(sucursal,mes,sha256,iv,tag,payload_cifrado,bytes_comprimidos,conteos,creado_por) '+
  "VALUES($1,$2,$3,decode($4,'hex'),decode($5,'hex'),decode($6,'hex'),$7,$8::jsonb,$9) ON CONFLICT(sucursal,mes,sha256) DO NOTHING",
  [sucursal,mes,sha,iv.toString('hex'),enc.getAuthTag().toString('hex'),cipher.toString('hex'),bytes.length,JSON.stringify(conteos),who.uid]);
 const r=await sql.query('SELECT id,sha256,conteos,creado_en FROM public.fin_archivos_operativos_v1 WHERE sucursal=$1 AND mes=$2 AND sha256=$3 LIMIT 1',[sucursal,mes,sha]);
 if(r.length!==1)return fail(res,503,'El archivo aún no está confirmado');
 return ok(res,{verificado:true,permanente:true,limpiezaHabilitada:false,
  archivo:{...r[0],sucursal,mes},fechaHabilitacion:fecha});
};
module.exports._testing={fechaHabilitacion,validateArchive,SECTIONS,LOCAL};
