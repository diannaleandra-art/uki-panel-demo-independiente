'use strict';
/**
 * Corta rutas de escritura que aceptan sobres cifrados opacos.
 * El servidor no puede comprobar cambios de pago dentro de un sobre AES-GCM.
 * Esto NO habilita la nueva caja ni crea pagos: sólo impide un bypass
 * durante una migración QA en que el registro bancario sea autoritativo.
 *
 * Inactivo por defecto; sólo preview de la rama de seguimiento.
 * NUNCA reutilizar el flag de QA en producción.
 */
const BRANCH='preparacion/enlaces-seguros-3-sucursales-20261124';
const ROUTES=new Set([
 'estado-cifrado','aceptacion-con-snapshot','cancelacion-snapshot',
 'cierre-snapshot','rectificacion-snapshot','olvido-snapshot','inicializar-snapshot'
]);
function strictMode(env=process.env){
 return env?.VERCEL_ENV==='preview'&&
  env?.VERCEL_GIT_COMMIT_REF===BRANCH&&
  env?.SEGUIMIENTO_BLOQUEAR_SNAPSHOT_LEGACY_QA_ENABLED==='true';
}
function blocked({env=process.env,route,method,action}={}){
 if(!strictMode(env)||!ROUTES.has(route))return false;
 const m=String(method||'').toUpperCase();
 if(route==='aceptacion-con-snapshot')return m==='PATCH'&&action==='aceptada';
 if(route==='rectificacion-snapshot'||route==='olvido-snapshot')return m==='POST'&&action==='confirmar';
 return m==='POST';
}
function denial(res){
 return res.status(409).json({
  ok:false,error:'Este guardado cifrado antiguo está bloqueado en pruebas. No se modificó el pedido ni la caja.'
 });
}
module.exports={BRANCH,ROUTES,strictMode,blocked,denial};
