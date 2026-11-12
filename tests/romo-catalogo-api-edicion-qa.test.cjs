'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/romo-catalogo-qa.js');
const {enabled,legacyEnabled,validOrigin,dbConfig,draftsOnly}=handler._testing;
const branch='qa/romo-catalogo-inventario-sin-publicar-20261111';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:branch,
 ROMO_CATALOGO_QA_ENABLED:'true',VERCEL_URL:'romo-example.vercel.app'};
function fakeRes(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},
 json(data){this.data=data;return this;},end(){return this;}};}
test('sólo preview de rama QA autorizada enciende lectura',()=>{
 assert.equal(enabled({}),false);assert.equal(enabled({...env,VERCEL_ENV:'production'}),false);
 assert.equal(enabled({...env,VERCEL_GIT_COMMIT_REF:'main'}),false);
 assert.equal(enabled(env),true);
});
test('mismo origen seguro; POST sin Origin o desde otro dominio bloqueado',()=>{
 const req={method:'GET',headers:{host:env.VERCEL_URL}};
 assert.equal(validOrigin(req,env),true);
 assert.equal(validOrigin({...req,method:'POST'},env),false);
 assert.equal(validOrigin({...req,method:'POST',headers:{host:env.VERCEL_URL,origin:'https://romo-example.vercel.app'}},env),true);
 assert.equal(validOrigin({...req,headers:{host:'uki-sushi-inventario.vercel.app'}},env),false);
 assert.equal(validOrigin({...req,headers:{host:env.VERCEL_URL,origin:'https://evil.example'}},env),false);
});
test('base Romo nunca puede reaprovechar Neon Uki',()=>{
 const url='postgresql://romos_app_service:pass@ep-romo.c-9.us-east-2.aws.neon.tech/romos_sushi';
 const settings={ROMO_PRIVATE_DATABASE_URL:url,ROMO_PRIVATE_DATABASE_HOST:'ep-romo.c-9.us-east-2.aws.neon.tech'};
 assert.equal(dbConfig(settings),url);
 assert.equal(dbConfig({...settings,UKI_INVENTARIO_LIVE_DATABASE_URL:url}),null);
 assert.equal(dbConfig({...settings,ROMO_PRIVATE_DATABASE_HOST:'ep-uki.neon.tech'}),null);
 assert.equal(dbConfig({...settings,ROMO_PRIVATE_DATABASE_URL:url.replace('/romos_sushi','/neondb')}),null);
});
test('solo borradores en etapa QA: no activar productos ni promociones sin fotos',()=>{
 const c={productos:[{visible:false}],promociones:[{visible:false}],ingredientes:[{visible:false}]};
 assert.equal(draftsOnly(c),true);
 c.promociones[0].visible=true;
 assert.equal(draftsOnly(c),false);
});
test('API rechaza producción y no toca base de datos',async()=>{
 const saved={VERCEL_ENV:process.env.VERCEL_ENV,
  ROMO_CATALOGO_QA_ENABLED:process.env.ROMO_CATALOGO_QA_ENABLED};
 try{
  process.env.VERCEL_ENV='production';process.env.ROMO_CATALOGO_QA_ENABLED='true';
  const res=fakeRes();
  await handler({method:'POST',headers:{host:env.VERCEL_URL}},res);
  assert.equal(res.code,503);
  assert.match(res.data.error,/pruebas/i);
 }finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});

test('lectura de carta antigua comparte el endpoint Romo, con bandera separada',()=>{
 assert.equal(legacyEnabled(env),false);
 assert.equal(legacyEnabled({...env,ROMO_IMPORTACION_CATALOGO_QA_ENABLED:'true'}),true);
});

test('nuevo modo inventario aislado usa el mismo endpoint y no activa escrituras',()=>{
 const {inventoryEnabled,inventoryWriteEnabled,inventoryMode}=handler._testing;
 const sandbox={...env,ROMO_INVENTARIO_QA_ENABLED:'true'};
 assert.equal(inventoryEnabled(env),false);
 assert.equal(inventoryWriteEnabled(sandbox),false);
 assert.equal(inventoryEnabled(sandbox),true);
 assert.equal(inventoryWriteEnabled({...sandbox,ROMO_INVENTARIO_QA_WRITE_ENABLED:'true'}),true);
 assert.equal(inventoryWriteEnabled({...sandbox,ROMO_INVENTARIO_QA_WRITE_ENABLED:'true',VERCEL_ENV:'production'}),false);
 assert.equal(inventoryMode({origen:'inventario'}),true);
 assert.equal(inventoryMode({origen:'anterior'}),false);
});
test('POST inventario sin bandera de escritura bloquea antes de acceder a base',async()=>{
 const before={};
 for(const key of ['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','ROMO_CATALOGO_QA_ENABLED',
  'ROMO_INVENTARIO_QA_ENABLED','ROMO_INVENTARIO_QA_WRITE_ENABLED','VERCEL_URL'])before[key]=process.env[key];
 try{
  Object.assign(process.env,{...env,ROMO_INVENTARIO_QA_ENABLED:'true',ROMO_INVENTARIO_QA_WRITE_ENABLED:'false'});
  const res=fakeRes();
  await handler({method:'POST',query:{origen:'inventario'},headers:{host:env.VERCEL_URL,origin:'https://'+env.VERCEL_URL}},res);
  assert.equal(res.code,503);
  assert.match(res.data.error,/Guardado de inventario/);
 }finally{for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
});
