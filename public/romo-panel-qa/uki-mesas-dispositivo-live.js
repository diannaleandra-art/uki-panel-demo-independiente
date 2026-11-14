/* Uki Sushi — vinculación de equipo, solo equipos operativos autorizados.
 * No solicita ni transmite la clave compartida que descifra la caja.
 * La llave privada se genera no exportable y queda únicamente en IndexedDB de este equipo.
 */
const ENDPOINT='https://uki-sushi-pedidos.vercel.app/api/mesa-dispositivo-live';
const DBNAME='uki-mesas-dispositivos-live-v1';
const BRANCHES=new Set(['arica','serena']);
const cached=new Map();
function branchValid(branch){if(!BRANCHES.has(branch))throw Error('Sucursal no reconocida');}
function requestStore(){
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB) return reject(Error('Este navegador no permite almacenar la llave del equipo.'));
  const r=indexedDB.open(DBNAME,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('devices');
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(Error('No se pudo abrir el almacén seguro del equipo.'));
 });
}
async function recordGet(branch){
 branchValid(branch);
 const db=await requestStore();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('devices','readonly');
  const req=tx.objectStore('devices').get(branch);
  req.onsuccess=()=>{const result=req.result||null;resolve(result);};
  req.onerror=()=>reject(Error('No se pudo consultar el equipo.'));
  tx.oncomplete=()=>db.close();
  tx.onerror=()=>{db.close();reject(Error('No se pudo consultar el equipo.'));};
 });
}
async function recordPut(branch,data){
 const db=await requestStore();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('devices','readwrite');
  tx.objectStore('devices').put(data,branch);
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(Error('No se pudo conservar la autorización del equipo.'));};
 });
}
async function recordDelete(branch){
 const db=await requestStore();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('devices','readwrite');
  tx.objectStore('devices').delete(branch);
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(Error('No se pudo quitar la autorización guardada.'));};
 });
}
const B64URL=array=>{
 let s='';for(const byte of new Uint8Array(array))s+=String.fromCharCode(byte);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
};
async function call(body,adminToken){
 const headers={'Content-Type':'application/json'};
 if(adminToken)headers.Authorization='Bearer '+adminToken;
 const r=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify(body),
  cache:'no-store',credentials:'omit',mode:'cors',signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok)throw Error(String(data.error||'Servicio QR no disponible'));
 return data;
}
export async function estadoEquipoQR(branch){
 const record=await recordGet(branch);
 return {autorizado:!!record?.deviceId,id:record?.deviceId||null};
}
export async function autorizarEquipoQR(branch,adminToken,label='Equipo Uki'){
 branchValid(branch);
 if(typeof adminToken!=='string'||!adminToken)throw Error('Necesitas iniciar sesión como administradora.');
 if(!globalThis.crypto?.subtle)throw Error('Este navegador no permite llaves seguras.');
 const existing=await recordGet(branch);
 if(existing)throw Error('Este equipo ya tiene una autorización en esta sucursal.');
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},
  false,['sign','verify']); // privateKey no exportable
 if(pair.privateKey.extractable)throw Error('La llave privada debe ser no exportable.');
 const exported=await crypto.subtle.exportKey('jwk',pair.publicKey);
 // Safari incluye key_ops/ext en su JWK exportado. La API solo acepta los
 // cuatro datos públicos de P-256 y rechaza metadatos adicionales, por seguridad.
 const publicKey={kty:exported.kty,crv:exported.crv,x:exported.x,y:exported.y};
 const response=await call({action:'pair',branch,publicKey,label},adminToken);
 await recordPut(branch,{deviceId:response.deviceId,privateKey:pair.privateKey,branch});
 return {autorizado:true,id:response.deviceId};
}
export async function obtenerSesionQR(branch){
 branchValid(branch);
 const live=cached.get(branch);
 if(live?.exp>Date.now()+30000)return live.token;
 const record=await recordGet(branch);
 if(!record?.deviceId||!record.privateKey)throw Error('Este dispositivo aún no está autorizado para los pedidos QR.');
 const challenge=await call({action:'challenge',branch,deviceId:record.deviceId});
 const msg='UKI-MESAS-DEVICE-LIVE-V1|'+branch+'|'+record.deviceId+'|'+challenge.nonce;
 const raw=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},
  record.privateKey,new TextEncoder().encode(msg));
 const response=await call({action:'session',branch,deviceId:record.deviceId,
  nonce:challenge.nonce,signature:B64URL(raw)});
 cached.set(branch,{token:response.token,exp:Date.now()+(response.expiresInSeconds*1000)});
 return response.token;
}
export async function revocarEquipoQR(branch,adminToken){
 branchValid(branch);
 if(!adminToken)throw Error('Necesitas iniciar sesión como administradora.');
 const record=await recordGet(branch);
 if(!record?.deviceId)throw Error('No hay equipo vinculado en esta sucursal.');
 await call({action:'revoke',branch,deviceId:record.deviceId},adminToken);
 cached.delete(branch);
 await recordDelete(branch);
 return true;
}
