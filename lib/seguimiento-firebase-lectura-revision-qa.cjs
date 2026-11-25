'use strict';
/* Diagnóstico estrictamente de lectura. No devuelve revisión, generación,
 * contenido, UID ni credenciales; no lee bloques cifrados ni escribe Firestore.
 * La API sólo invoca esta función con la identidad dueña de revisión verificada.
 */
const RAMAS=Object.freeze({'uki:arica':'regimiento','uki:serena':'la-serena'});
const ROOT='https://firestore.googleapis.com/v1/projects/uki-panel-f4909/databases/(default)/documents/uki_operacion_v1/';
const MASK='?mask.fieldPaths=branch&mask.fieldPaths=schemaVersion&mask.fieldPaths=rev&mask.fieldPaths=generacion&mask.fieldPaths=totalBloques';
async function check({authorization,fetchFn=fetch}={}){
 const token=typeof authorization==='string'&&authorization.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
 if(!token||token.length>12000||token.startsWith('UKIDEV1.'))throw Object.assign(Error('Sesión Google no válida'),{code:403});
 async function one([storeId,branch]){
  try{
   const response=await fetchFn(ROOT+branch+MASK,{method:'GET',cache:'no-store',redirect:'error',
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)return {storeId,estado:response.status===401?'sesion_no_valida':response.status===403?'sin_permiso':response.status===404?'sin_manifiesto':'no_disponible'};
   const raw=await response.text();
   if(raw.length>16000)return {storeId,estado:'formato_no_valido'};
   let data;try{data=JSON.parse(raw)}catch{return {storeId,estado:'formato_no_valido'}}
   const fields=data?.fields;
   const rev=Number(fields?.rev?.integerValue),count=Number(fields?.totalBloques?.integerValue);
   const ok=data?.name==='projects/uki-panel-f4909/databases/(default)/documents/uki_operacion_v1/'+branch&&
    fields?.branch?.stringValue===branch&&fields?.schemaVersion?.integerValue==='2'&&
    /^[1-9][0-9]{0,9}$/.test(fields?.rev?.integerValue||'')&&Number.isSafeInteger(rev)&&rev<=1000000000&&
    /^[a-f0-9]{32}$/.test(fields?.generacion?.stringValue||'')&&
    /^[1-9][0-9]{0,2}$/.test(fields?.totalBloques?.integerValue||'')&&Number.isSafeInteger(count)&&count<=180;
   return {storeId,estado:ok?'lectura_correcta':'formato_no_valido'};
  }catch{return {storeId,estado:'no_disponible'}}
 }
 return Promise.all(Object.entries(RAMAS).map(one));
}
module.exports={check};
