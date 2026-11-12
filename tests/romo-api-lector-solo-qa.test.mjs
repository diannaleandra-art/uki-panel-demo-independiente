import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/* Prueba integrada del API real con DB ficticia. No conecta Neon ni Uki. */
const original=readFileSync(new URL('../api/romo-estado-operativo-qa.js',import.meta.url),'utf8');
const origin='https://diannaleandra-art.github.io';
const baseEnv={
 VERCEL_ENV:'production',
 ROMO_PANEL_ALLOWED_ORIGIN:origin,
 ROMO_PANEL_LECTURA_SOLA_ENABLED:'true',
 ROMO_OPERATIVO_LIVE_ENABLED:'false',
 ROMO_PANEL_AREAS_LIVE_ENABLED:'false',
 ROMO_PANEL_AREAS_WRITE_LIVE_ENABLED:'false'
};
function fixture(env=baseEnv){
 const calls=[];
 const state={config:0,readConfig:0,resolve:0,panel:0,connections:0};
 const mockStore={romoOperativoConfig(){state.config++;throw Error('No abrir operaciones');}};
 const mockReading={romoPrivateReadConfig(actual){
  state.readConfig++;
  assert.equal(actual,env);
  return {url:'postgresql://private-role:dummy@romo-fixture.neon.tech/romos_sushi',origin,storeId:'romo:serena'};
 }};
 const mockIdentity={verifyFirebaseGoogleToken:async()=>{throw Error('No usar verificador en prueba')},
  async resolveRomoIdentity({authorization,env:actual,db}){
   assert.equal(actual,env);assert.ok(db.query);
   state.resolve++;
   if(authorization!=='Bearer signed_fixture_token')return null;
   return {userId:'signed_owner_fixture',role:'duenos',brand:'romo',branches:['serena']};
  }};
 const mockPanel={async procesarAreaPanelRomoQA({area,method,db,identity}){
  state.panel++;assert.equal(method,'GET');assert.equal(identity.role,'duenos');
  assert.equal(db.query,apiDb.query);
  return {storeId:'romo:serena',area,revision:1,ventasHabilitadas:false,
   ...(area==='catalog'?{catalog:{storeId:'romo:serena'}}:{inventory:{sucursal:'romo:serena'}})};
 }};
 const apiDb={async query(){calls.push('db');throw Error('Consulta de prueba inesperada')}};
 const injected=original
  .replace("await import('../lib/romo-estado-operativo-qa.mjs')","await Promise.resolve(mockStore)")
  .replace("await import('../lib/romo-claves-lectura-servidor-qa.mjs')","await Promise.resolve(mockReading)")
  .replace("await import('../lib/romo-identidad-servidor-qa.mjs')","await Promise.resolve(mockIdentity)")
  .replace("await import('../lib/romo-panel-http-qa.mjs')","await Promise.resolve(mockPanel)");
 assert.notEqual(injected,original);
 const module={exports:{}};
 new Function('module','process','require','mockStore','mockReading','mockIdentity','mockPanel',injected)(
  module,{env},name=>{
   assert.equal(name,'@neondatabase/serverless');
   return {neon:url=>{
    assert.match(url,/\/romos_sushi$/);
    state.connections++;return apiDb;
   }};
  },mockStore,mockReading,mockIdentity,mockPanel
 );
 return {handler:module.exports,state,calls};
}
function response(){
 return {code:0,body:null,headers:{},closed:false,
  setHeader(key,value){this.headers[key]=value;return this;},
  status(code){this.code=code;return this;},
  json(body){this.body=body;return this;},
  end(){this.closed=true;return this;}};
}
async function ask(handler,{method='GET',area='catalog',auth='Bearer signed_fixture_token',
 requestOrigin=origin,contentType='application/json'}={}){
 const res=response();
 await handler({method,query:{area},
  headers:{origin:requestOrigin,authorization:auth,'content-type':contentType}},res);
 return res;
}
test('lectura de catálogo e inventario usa Google y Romo, sin activar ventas',async()=>{
 for(const area of ['catalog','inventory']){
  const {handler,state,calls}=fixture();
  const res=await ask(handler,{area});
  assert.equal(res.code,200);
  assert.equal(res.body.ok,true);
  assert.equal(res.body.storeId,'romo:serena');
  assert.equal(res.body.area,area);
  assert.equal(res.body.ventasHabilitadas,false);
  assert.equal(res.headers['Access-Control-Allow-Methods'],'GET,OPTIONS');
  assert.equal(state.config,0);
  assert.equal(state.readConfig,1);
  assert.equal(state.resolve,1);
  assert.equal(state.panel,1);
  assert.equal(state.connections,1);
  assert.deepEqual(calls,[]);
 }
});
test('POST de catálogo e inventario bloqueados aun con lectura autorizada',async()=>{
 for(const area of ['catalog','inventory']){
  const {handler,state}=fixture();
  const res=await ask(handler,{area,method:'POST'});
  assert.equal(res.code,503);
  assert.equal(state.connections,0);
  assert.equal(state.panel,0);
  assert.equal(state.resolve,0);
 }
});
test('sin firma Google válida no consulta catálogo ni inventario',async()=>{
 const {handler,state}=fixture();
 const denied=await ask(handler,{auth:'Bearer other_fixture'});
 assert.equal(denied.code,403);
 assert.equal(state.panel,0);
});
test('bandera apagada, entorno preview y otro origen impiden lectura',async()=>{
 for(const [env,requestOrigin] of [
  [{...baseEnv,ROMO_PANEL_LECTURA_SOLA_ENABLED:'false'},origin],
  [{...baseEnv,VERCEL_ENV:'preview'},origin],
  [baseEnv,'https://sitio-ajeno.example']
 ]){
  const {handler,state}=fixture(env);
  const res=await ask(handler,{requestOrigin});
  assert.ok([403,503].includes(res.code));
  assert.equal(state.connections,0);assert.equal(state.panel,0);
 }
});
test('preflight solo anuncia GET, nunca POST, y áreas desconocidas se rechazan',async()=>{
 const {handler,state}=fixture();
 const pre=await ask(handler,{method:'OPTIONS'});
 assert.equal(pre.code,204);
 assert.equal(pre.closed,true);
 assert.equal(pre.headers['Access-Control-Allow-Methods'],'GET,OPTIONS');
 assert.equal(state.connections,0);
 const no=await ask(handler,{area:'uki:arica'});
 assert.equal(no.code,400);
 assert.equal(state.connections,0);
});
