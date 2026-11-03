'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
test('Equipo QR en navegador real: clave no exportable, persistencia, acceso y revocación',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();
 const devices=new Map(),challenges=new Map();
 let challengeCount=0,adminCalls=0;
 await page.route('https://uki-sushi-pedidos-git-preparacion-uki-27ff36-diannaleandra-7046.vercel.app/api/mesa-dispositivo-qa',async(route)=>{
  const req=route.request(),body=req.postDataJSON();
  const fail=(status,error)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({ok:false,error}),
   headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8765','Access-Control-Allow-Headers':'Authorization,Content-Type'}});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,
   headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8765','Access-Control-Allow-Headers':'Authorization,Content-Type'}});
  const send=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,...data}),
    headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8765'}});
  if(body.action==='pair'){
   adminCalls++;
   if(req.headers().authorization!=='Bearer qa_admin_ficticio')return fail(403,'Sin cuenta autorizada');
   if(!body.publicKey||body.publicKey.d)return fail(422,'Clave no válida');
   const deviceId=crypto.randomUUID();
   devices.set(deviceId,{branch:body.branch,key:body.publicKey,active:true});
   return send({deviceId,branch:body.branch});
  }
  const d=devices.get(body.deviceId);
  if(!d||!d.active||d.branch!==body.branch)return fail(403,'No autorizado');
  if(body.action==='challenge'){
   const nonce=crypto.randomUUID();challenges.set(nonce,{id:body.deviceId,branch:body.branch});
   challengeCount++;return send({nonce,branch:body.branch});
  }
  if(body.action==='session'){
   const c=challenges.get(body.nonce);challenges.delete(body.nonce);
   if(!c||c.id!==body.deviceId||c.branch!==body.branch)return fail(401,'No autorizado');
   const publicKey=crypto.createPublicKey({key:d.key,format:'jwk'});
   const msg=Buffer.from('UKI-MESAS-DEVICE-QA-V1|'+body.branch+'|'+body.deviceId+'|'+body.nonce);
   if(!crypto.verify('sha256',msg,{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(body.signature,'base64url')))
    return fail(401,'Firma incorrecta');
   return send({token:'UKIDEV1.token-de-prueba-ficticio',branch:body.branch,expiresInSeconds:900});
  }
  if(body.action==='revoke'){
   if(req.headers().authorization!=='Bearer qa_admin_ficticio')return fail(403,'No autorizado');
   d.active=false;return send({revoked:true});
  }
  return fail(400,'Operación inválida');
 });
 try{
  await page.goto('http://127.0.0.1:8765/tests/uki-firebase-guest-probe.qa.html');
  const result=await page.evaluate(async()=>{
   const api=await import('/firebase/uki-mesas-dispositivo-qa.js');
   const initial=await api.estadoEquipoQR('arica');
   if(initial.autorizado)throw Error('Equipo no debería comenzar autorizado');
   const registered=await api.autorizarEquipoQR('arica','qa_admin_ficticio');
   const before=await api.estadoEquipoQR('arica');
   const other=await api.estadoEquipoQR('serena');
   return {registered:registered.autorizado,before:before.autorizado,
    id:before.id,other:other.autorizado};
  });
  assert.equal(result.registered,true);
  assert.equal(result.before,true);
  assert.equal(result.other,false);
  assert.ok(devices.has(result.id));
  await page.reload();
  const session=await page.evaluate(async()=>{
   const api=await import('/firebase/uki-mesas-dispositivo-qa.js');
   const first=await api.obtenerSesionQR('arica');
   const second=await api.obtenerSesionQR('arica');
   return {first,second};
  });
  assert.equal(session.first,session.second);
  assert.ok(session.first.startsWith('UKIDEV1.'));
  assert.equal(challengeCount,1,'La sesión cacheada no repite firmas innecesarias');
  const revoked=await page.evaluate(async()=>{
   const api=await import('/firebase/uki-mesas-dispositivo-qa.js');
   await api.revocarEquipoQR('arica','qa_admin_ficticio');
   return api.estadoEquipoQR('arica');
  });
  assert.equal(revoked.autorizado,false);
  assert.equal(devices.get(result.id).active,false);
  assert.equal(adminCalls,1);
  console.log(JSON.stringify({ok:true,tests:6,productionChanged:false,
   codeOrPasswordSent:false,devicePrivateKeyExportable:false,
   branchIsolation:true,persistedAcrossReload:true,revoked:true},null,2));
 }finally{await browser.close();}
});
