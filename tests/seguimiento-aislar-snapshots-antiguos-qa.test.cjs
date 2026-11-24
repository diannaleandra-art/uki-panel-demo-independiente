'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const G=require('../lib/seguimiento-aislar-escrituras-legadas-qa.cjs');
const branch=G.BRANCH;
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch,
 SEGUIMIENTO_BLOQUEAR_SNAPSHOT_LEGACY_QA_ENABLED:'true'};
const writing=[
 ['estado-cifrado','POST'],
 ['aceptacion-con-snapshot','PATCH','aceptada'],
 ['cancelacion-snapshot','POST'],
 ['cierre-snapshot','POST'],
 ['rectificacion-snapshot','POST','confirmar'],
 ['olvido-snapshot','POST','confirmar'],
 ['inicializar-snapshot','POST']
];
const apis=[
 'api/romo-estado-cifrado-panel-qa.js',
 'api/romo-solicitudes-carta-qa.js',
 'api/romo-cancelacion-cifrada-solo-qa.js',
 'api/romo-cierre-definitivo-qa.js',
 'api/romo-rectificacion-cierre-v2-qa.js',
 'api/romo-pedidos-olvidados-qa.js',
 'api/romo-inicializar-vacio-qa.js'
];
test('bloqueo solo por bandera explícita y rama QA específica',()=>{
 assert.equal(G.strictMode(env),true);
 for(const bad of [
  {...env,VERCEL_ENV:'production'},
  {...env,VERCEL_GIT_COMMIT_REF:'main'},
  {...env,SEGUIMIENTO_BLOQUEAR_SNAPSHOT_LEGACY_QA_ENABLED:'false'},
  {...env,SEGUIMIENTO_BLOQUEAR_SNAPSHOT_LEGACY_QA_ENABLED:undefined}
 ])assert.equal(G.strictMode(bad),false);
});
for(const [route,method,action] of writing){
 test('QA bloquea sobres opacos: '+route,()=>{
  assert.equal(G.blocked({env,route,method,action}),true);
  assert.equal(G.blocked({env:{...env,VERCEL_ENV:'production'},route,method,action}),false);
  assert.equal(G.blocked({env,route,method:'GET',action}),false);
 });
}
test('consultas y acciones no financieras de la bandeja siguen disponibles',()=>{
 assert.equal(G.blocked({env,route:'aceptacion-con-snapshot',method:'PATCH',action:'reservar'}),false);
 assert.equal(G.blocked({env,route:'aceptacion-con-snapshot',method:'PATCH',action:'rechazada'}),false);
 assert.equal(G.blocked({env,route:'rectificacion-snapshot',method:'POST',action:'consultar'}),false);
 assert.equal(G.blocked({env,route:'olvido-snapshot',method:'POST',action:'consultar'}),false);
 assert.equal(G.blocked({env,route:'seguimiento-cliente',method:'POST',action:'avisar_transferencia'}),false);
});
test('los siete servidores verifican la compuerta antes de escribir',()=>{
 for(const filename of apis){
  const c=fs.readFileSync(path.join(__dirname,'..',filename),'utf8');
  assert.match(c,/seguimiento-aislar-escrituras-legadas-qa\.cjs/,filename);
  assert.match(c,/MIGRACION\.blocked\(/,filename);
  assert.match(c,/MIGRACION\.denial\(res\)/,filename);
 }
});
test('la respuesta de bloqueo no acredita caja o transferencias',()=>{
 let result=null;
 const res={status(code){result={status:code};return {json(body){result.body=body;return body}}}};
 G.denial(res);
 assert.equal(result.status,409);
 assert.equal(result.body.ok,false);
 assert.match(result.body.error,/No se modificó el pedido ni la caja/);
});
