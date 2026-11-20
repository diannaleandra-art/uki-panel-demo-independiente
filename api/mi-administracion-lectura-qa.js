'use strict';
/**
 * Puente de LECTURA para Mi Administración en su Preview aislado.
 * La API oficial permite CORS solo a sus propios orígenes. Aquí la
 * verificación Google/PIN sigue ocurriendo en el servidor FIN oficial;
 * este puente NO guarda tokens, NO escribe en fin_movimientos ni permite
 * acciones de caja/contabilidad, y solo responde al alias QA autorizado.
 */
const PROD='https://uki-sushi-inventario.vercel.app';
const BRANCH='preparacion/uki-romo-sobre-main-20261114';
const READ=new Set([
 'estado','negocios','razones_sociales','resumen','listar_movimientos',
 'listar_cierres','listar_pendientes','documentos','abrir_documento',
 'auditoria_movimiento','costos','exportar_informes'
]);
const SESSION=new Set(['ingresar_pin','salir']);
const fail=(res,status,error)=>res.status(status).json({ok:false,error});
function config(env={}){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==BRANCH||
    env.ROMO_CIERRES_DUENOS_LECTURA_QA_ENABLED!=='true')return null;
 let u;
 try{u=new URL(String(env.ROMO_PANEL_ALLOWED_ORIGIN||''));}catch{return null;}
 if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||
    u.hostname!=='uki-sushi-inventario-git-preparacion-c0b0e9-diannaleandra-7046.vercel.app')
  return null;
 return {origin:u.origin,host:u.host};
}
function valid(req,cfg){
 return String(req.headers?.host||'').toLowerCase()===cfg.host&&
        String(req.headers?.origin||'')===cfg.origin;
}
module.exports=async function adminPrivadoSoloLecturaQA(req,res){
 res.setHeader('Cache-Control','private,no-store,max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Vary','Origin');
 const cfg=config(process.env);
 if(!cfg)return fail(res,503,'La consulta privada de pruebas no está habilitada');
 if(req.method!=='POST')return fail(res,405,'Solo POST');
 if(!valid(req,cfg))return fail(res,403,'Origen privado no autorizado');
 if(String(req.headers?.['content-type']||'').split(';')[0]!=='application/json')
  return fail(res,415,'Solo JSON');
 const b=req.body;
 if(!b||typeof b!=='object'||Array.isArray(b)||
    JSON.stringify(b).length>25000||
    typeof b.action!=='string'||(!READ.has(b.action)&&!SESSION.has(b.action)))
  return fail(res,403,'Esta versión es solo de consulta. Para guardar movimientos, utiliza Mi Administración oficial');
 const auth=String(req.headers.authorization||'');
 const token=auth.match(/^Bearer ([A-Za-z0-9_.-]{30,12000})$/)?.[1];
 if(!token)return fail(res,401,'Inicia sesión con tu cuenta Google');
 const pin=String(req.headers['x-fin-session']||'');
 if(pin&&!/^[0-9a-f]{64}$/i.test(pin))return fail(res,401,'Sesión privada inválida');
 if(b.action==='ingresar_pin'&&(!/^[0-9]{6}$/.test(String(b.pin||''))||
    Object.keys(b).sort().join('|')!=='action|pin'))
  return fail(res,400,'Código PIN inválido');
 if(b.action==='salir'&&Object.keys(b).sort().join('|')!=='action')
  return fail(res,400,'Solicitud de salida inválida');
 let timer,abort;
 try{
  abort=new AbortController();
  timer=setTimeout(()=>abort.abort(),12000);
  const response=await fetch(PROD+'/api/mi-administracion-live',{
   method:'POST',cache:'no-store',redirect:'error',credentials:'omit',
   signal:abort.signal,
   headers:{
    'Content-Type':'application/json',
    Authorization:'Bearer '+token,
    'X-Fin-Session':pin,
    Origin:PROD
   },
   body:JSON.stringify(b)
  });
  const result=await response.json().catch(()=>null);
  if(!result||typeof result!=='object'||typeof result.ok!=='boolean')
   return fail(res,502,'Respuesta del servidor financiero no verificable');
  return res.status(response.status).json(result);
 }catch{
  return fail(res,502,'No se pudo conectar con el servicio financiero oficial. Tus datos no se modificaron.');
 }finally{if(timer)clearTimeout(timer);}
};
module.exports._internalQA={config,valid,READ,SESSION};
