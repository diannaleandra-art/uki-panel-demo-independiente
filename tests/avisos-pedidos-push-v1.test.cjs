const {test}=require('node:test'),assert=require('node:assert/strict'),{createECDH,randomBytes}=require('node:crypto');
const webpush=require('web-push');
const push=require('../lib/avisos-pedidos-push-v1.cjs');
const {publicKey,privateKey}=webpush.generateVAPIDKeys();
const env={VERCEL_ENV:'production',AVISOS_PEDIDOS_PUSH_ENABLED:'true',AVISOS_PEDIDOS_PUSH_PUBLIC_KEY:publicKey,AVISOS_PEDIDOS_PUSH_PRIVATE_KEY:privateKey};
const key=createECDH('prime256v1');key.generateKeys();
const sub={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-device',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
test('Push sólo admite destinos oficiales y validados, no reenvíos',()=>{
 for(const hostname of ['https://abc.push.apple.com/3/device/fake','https://wns.windows.com/path','https://hk2p.notify.windows.com/path','https://updates.push.services.mozilla.com/wpush/v2/test'])assert.match(push.endpoint(hostname),/^https/);
 for(const hostname of ['http://fcm.googleapis.com/fcm/send/test','https://fcm.googleapis.com.evil.invalid/stuff','https://fcm.googleapis.com@evil.invalid/long','https://127.0.0.1/something/else','https://localhost.some.invalid/long/path','https://fcm.googleapis.com:8443/fcm/a'])assert.throws(()=>push.endpoint(hostname));
 assert.throws(()=>push.subscription({...sub,keys:{...sub.keys,p256dh:'AQID'}}));
 assert.equal(push.config({...env,VERCEL_ENV:'preview'}),null);
});
test('Cifra el aviso para el proveedor y no incluye datos del cliente',()=>{
 const msg=push.payload('uki:arica','00000000-0000-0000-0000-000000000009');
 const r=webpush.generateRequestDetails(sub,JSON.stringify(msg),{vapidDetails:push.config(env),TTL:600,urgency:'high'});
 assert.equal(r.headers['Content-Encoding'],'aes128gcm');assert.match(r.headers.Authorization,/vapid/);
 assert.match(msg.title,/Regimiento Arica/);assert.equal(msg.branch,'arica');assert(!r.body.includes(msg.title));
 assert.deepEqual(Object.keys(msg).sort(),['body','branch','tag','title']);
});
test('Sólo consulta suscripciones del local y borra una única suscripción vencida',async()=>{
 const qs=[],messages=[];
 const db={query:async(q,p)=>{qs.push([q,p]);return q.startsWith('SELECT')?[{endpoint_hash:'x',subscription:sub},{endpoint_hash:'y',subscription:{...sub,endpoint:sub.endpoint+'-e'}}]:[];}};
 const t=await push.dispatch({db,store:'romo:serena',id:'00000000-0000-0000-0000-000000000009',env,
  deliver:async(s,p)=>{messages.push(JSON.parse(p));if(s.endpoint.endsWith('-e'))throw Object.assign(Error('expirado'),{statusCode:410});}});
 assert.equal(t.sent,1);assert.deepEqual(qs[0][1],['romo:serena']);assert.equal(qs[1][1][0],'y');
 assert(messages.every(s=>s.branch==='romo'&&s.title.includes('Romo')));
});
test('La prueba y la desactivación están ligadas a dueño y sucursal',async()=>{
 const q=[];let sent=0;
 const db={query:async(sql,p)=>{q.push([sql,p]);return sql.startsWith('UPDATE')?[{subscription:sub}]:[];}};
 const common={db,store:'uki:serena',principal:'sintetico',env,deliver:async()=>{sent++;}};
 await push.manage({...common,body:{operacion:'activar',subscription:sub}});
 await push.manage({...common,body:{operacion:'prueba',endpoint:sub.endpoint}});
 await push.manage({...common,body:{operacion:'desactivar',endpoint:sub.endpoint}});
 assert.equal(sent,1);assert.equal(q[1][1][1],'uki:serena');assert.equal(q[1][1][2].length,64);
 assert.equal(q[1][1][2],q[2][1][2]);assert.match(q[1][0],/last_test_at<now\(\)-interval/);
});
