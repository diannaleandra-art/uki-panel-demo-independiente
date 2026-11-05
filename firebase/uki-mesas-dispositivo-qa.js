/* Uki Sushi - autorización de trabajador EXCLUSIVAMENTE en Preview QA.
 * IndexedDB independiente: nunca reutiliza llaves del equipo QR real.
 */
const DB_NAME='uki-inventario-dispositivos-qa-v1';
const BRANCHES=new Set(['arica','serena']);
const cache=new Map();
function endpointValido(endpoint){
 const url=new URL(String(endpoint||''));
 if(url.protocol!=='https:'||
    !/^uki-sushi-pedidos-[a-z0-9]+-diannaleandra-7046\.vercel\.app$/.test(url.hostname)||
    url.pathname!=='/api/mesa-dispositivo-qa'||url.search||url.hash)
  throw Error('La autorización QA no puede contactar la carta de producción.');
 return url.href;
}
function branchValido(branch){
 if(!BRANCHES.has(branch))throw Error('Sucursal QA no reconocida.');
}
function openDb(){
 return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB)return reject(Error('Este navegador no permite guardar la autorización QA.'));
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>req.result.createObjectStore('devices');
  req.onerror=()=>reject(Error('No se puede acceder al almacenamiento QA.'));
  req.onsuccess=()=>resolve(req.result);
 });
}
async function get(branch){
 branchValido(branch);
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('devices','readonly');
  const req=tx.objectStore('devices').get(branch);
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(Error('No se pudo consultar el equipo QA.'));
  tx.oncomplete=()=>db.close();
 });
}
async function put(branch,value){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('devices','readwrite');
  tx.objectStore('devices').put(value,branch);
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(Error('No se pudo guardar el equipo QA.'));};
 });
}
function b64url(bytes){
 let str='';for(const b of new Uint8Array(bytes))str+=String.fromCharCode(b);
 return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
async function call(body,adminToken,endpoint){
 const headers={'Content-Type':'application/json'};
 if(adminToken)headers.Authorization='Bearer '+adminToken;
 const r=await fetch(endpointValido(endpoint),{
  method:'POST',headers,body:JSON.stringify(body),cache:'no-store',
  credentials:'omit',mode:'cors',signal:AbortSignal.timeout(15000)
 });
 const result=await r.json().catch(()=>({}));
 if(!r.ok||!result.ok)throw Error(String(result.error||'Autorización de prueba no disponible.'));
 return result;
}
export async function estadoEquipoQA(branch){
 const record=await get(branch);
 return {autorizado:!!(record?.deviceId&&record.privateKey)};
}
export async function autorizarEquipoQA(branch,adminToken,endpoint){
 branchValido(branch);
 if(!adminToken)throw Error('Primero inicia sesión con Google administrador.');
 const actual=await get(branch);
 if(actual?.deviceId&&actual.privateKey)return {autorizado:true};
 if(!crypto?.subtle)throw Error('No se pueden generar llaves seguras en este iPhone.');
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 if(pair.privateKey.extractable)throw Error('La llave QA no es suficientemente segura.');
 const pub=await crypto.subtle.exportKey('jwk',pair.publicKey);
 const publicKey={kty:pub.kty,crv:pub.crv,x:pub.x,y:pub.y};
 const response=await call({action:'pair',branch,publicKey,label:'Inventario QA '+branch},adminToken,endpoint);
 await put(branch,{deviceId:response.deviceId,branch,privateKey:pair.privateKey});
 return {autorizado:true};
}
export async function obtenerSesionQA(branch,endpoint){
 branchValido(branch);
 const existing=cache.get(branch);
 if(existing?.expiry>Date.now()+30000)return existing.token;
 const record=await get(branch);
 if(!record?.deviceId||!record.privateKey)throw Error('Equipo QA sin autorización administrativa.');
 const challenge=await call({action:'challenge',branch,deviceId:record.deviceId},null,endpoint);
 const message='UKI-MESAS-DEVICE-LIVE-V1|'+branch+'|'+record.deviceId+'|'+challenge.nonce;
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},
  record.privateKey,new TextEncoder().encode(message));
 const response=await call({action:'session',branch,deviceId:record.deviceId,
  nonce:challenge.nonce,signature:b64url(signature)},null,endpoint);
 cache.set(branch,{token:response.token,expiry:Date.now()+response.expiresInSeconds*1000});
 return response.token;
}
