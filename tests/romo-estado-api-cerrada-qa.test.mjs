import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as store from '../lib/romo-estado-operativo-qa.mjs';
const require=createRequire(import.meta.url);

const source=readFileSync(new URL('../api/romo-estado-operativo-qa.js',import.meta.url),'utf8');
const origin='https://diannaleandra-art.github.io';
const baseEnv={
 VERCEL_ENV:'production',ROMO_OPERATIVO_LIVE_ENABLED:'true',
 ROMO_PANEL_ALLOWED_ORIGIN:origin,
 ROMO_PRIVATE_DATABASE_URL:'postgresql://romo_writer:s3cret@ep-romo-test.us-east-2.aws.neon.tech/romos_sushi',
 ROMO_PRIVATE_DATABASE_HOST:'ep-romo-test.us-east-2.aws.neon.tech'
};
const owner={userId:'owner_test_UID',brand:'romo',role:'duenos',branches:['serena']};
const agenda={userId:'agenda_test_UID',brand:'romo',role:'agendador',branches:['serena']};
function fakeDb(){
 let stored=null;
 const queries=[];
 return {
  queries,
  async query(sql,args){
   queries.push({sql,args});
   if(!sql.includes('public.romo_estado_operativo_v1'))
     throw Error('No se admite leer otra tabla');
   if(sql.startsWith('SELECT '))return stored?[{revision:stored.rev,snapshot:stored.snapshot}]:[];
   if(sql.startsWith('INSERT ')){
    if(stored)return [];
    stored={rev:1,snapshot:JSON.parse(args[1]),actor:args[2]};return [{revision:1}];
   }
   if(sql.startsWith('UPDATE ')){
    if(!stored||stored.rev!==args[1])return [];
    stored={rev:stored.rev+1,snapshot:JSON.parse(args[2]),actor:args[3]};
    return [{revision:stored.rev}];
   }
   throw Error('Escritura desconocida');
  }
 };
}
function handlerFor(env,db,identity=owner){
 const auth={
  verifyFirebaseGoogleToken:async()=>{throw Error('no debe llamar verificador en prueba')},
  resolveRomoIdentity:async({authorization,env:actual})=>{
   assert.equal(actual,env);
   return authorization==='Bearer valid_mock_token'?identity:null;
  }
 };
 const module={exports:{}};
 const injected=source
  .replace("await import('../lib/romo-estado-operativo-qa.mjs')","await Promise.resolve(storeMock)")
  .replace("await import('../lib/romo-identidad-servidor-qa.mjs')","await Promise.resolve(authMock)");
 new Function('module','process','require','storeMock','authMock',injected)(
  module,{env},name=>{
   assert.equal(name,'@neondatabase/serverless');
   return {neon:url=>{assert.match(url,/\/romos_sushi/);return db}};
  },store,auth);
 return module.exports;
}
function fakeResponse(){
 return {
  statusCode:0,body:null,headers:{},ended:false,
  setHeader(k,v){this.headers[k]=v;return this},
  status(v){this.statusCode=v;return this},
  json(x){this.body=x;return this},
  end(){this.ended=true;return this}
 };
}
const invoke=async(handler,{method='GET',auth='Bearer valid_mock_token',body=null,
 requestOrigin=origin,contentType='application/json'}={})=>{
 const response=fakeResponse();
 await handler({method,body,headers:{
  origin:requestOrigin,authorization:auth,'content-type':contentType
 }},response);
 return response;
};
const snapshot=()=>({
 formato:'uki-v813-browser',version:1,sucursal:'Romo’s Sushi La Serena',
 salt:Buffer.alloc(16,7).toString('base64'),
 iv:Buffer.alloc(12,8).toString('base64'),
 cifrado:Buffer.from('only encrypted information for Romo').toString('base64')
});

test('API cerrada por defecto sin acceder a la base',async()=>{
 const db=fakeDb(),handler=handlerFor({},db);
 const r=await invoke(handler);
 assert.equal(r.statusCode,503);
 assert.equal(db.queries.length,0);
 assert.equal(r.headers['Cache-Control'],'private, no-store, max-age=0');
});
test('también cerrada en preview aun con la bandera activada',async()=>{
 const db=fakeDb(),handler=handlerFor({...baseEnv,VERCEL_ENV:'preview'},db);
 assert.equal((await invoke(handler)).statusCode,503);
 assert.equal(db.queries.length,0);
});
test('origen ajeno, verbo indebido y formato inválido se rechazan',async()=>{
 const db=fakeDb(),handler=handlerFor(baseEnv,db);
 assert.equal((await invoke(handler,{requestOrigin:'https://otro-sitio.example'})).statusCode,403);
 assert.equal((await invoke(handler,{method:'DELETE'})).statusCode,405);
 assert.equal((await invoke(handler,{method:'POST',contentType:'text/plain',body:{}})).statusCode,415);
 assert.equal(db.queries.length,0);
});
test('OPTIONS funciona únicamente desde el sitio permitido',async()=>{
 const handler=handlerFor(baseEnv,fakeDb());
 const r=await invoke(handler,{method:'OPTIONS'});
 assert.equal(r.statusCode,204);
 assert.equal(r.ended,true);
 assert.equal(r.headers['Access-Control-Allow-Origin'],origin);
});
test('sin autenticación Google autorizada no consulta ni cambia Romo',async()=>{
 const db=fakeDb(),handler=handlerFor(baseEnv,db,null);
 assert.equal((await invoke(handler)).statusCode,403);
 assert.equal((await invoke(handler,{method:'POST',body:{expectedRevision:0,snapshot:snapshot()}})).statusCode,403);
 assert.equal(db.queries.length,0);
});
test('un usuario autorizado lee y guarda un snapshot cifrado, no datos Uki',async()=>{
 const db=fakeDb(),handler=handlerFor(baseEnv,db);
 const before=await invoke(handler);
 assert.equal(before.statusCode,200);
 assert.equal(before.body.revision,0);
 assert.equal(before.body.snapshot,null);
 const saved=await invoke(handler,{method:'POST',body:{expectedRevision:0,snapshot:snapshot()}});
 assert.equal(saved.statusCode,200);
 assert.equal(saved.body.revision,1);
 const after=await invoke(handler);
 assert.equal(after.statusCode,200);
 assert.deepEqual(after.body.snapshot,snapshot());
 assert.equal(JSON.stringify(db.queries).includes('Uki La Serena'),false);
 assert.equal(JSON.stringify(db.queries).includes('password'),false);
});
test('cliente atrasado recibe conflicto 409 y no pisa el cierre de otro equipo',async()=>{
 const db=fakeDb(),handler=handlerFor(baseEnv,db,agenda);
 const first={expectedRevision:0,snapshot:snapshot()};
 const a=await invoke(handler,{method:'POST',body:first});
 assert.equal(a.statusCode,200);
 const b=await invoke(handler,{method:'POST',body:first});
 assert.equal(b.statusCode,409);
 assert.equal((await invoke(handler)).body.revision,1);
});
test('no admite JSON con contraseñas o campos no cifrados',async()=>{
 const db=fakeDb(),handler=handlerFor(baseEnv,db);
 const bad=await invoke(handler,{method:'POST',
  body:{expectedRevision:0,snapshot:{...snapshot(),password:'nunca guardar'}}});
 assert.equal(bad.statusCode,400);
 assert.equal(db.queries.length,0,'No consulta la tabla ni escribe un respaldo inválido');
});
test('trabajador de inventario no puede leer todos los pedidos ni caja',async()=>{
 const db=fakeDb(),handler=handlerFor(baseEnv,db,{
  userId:'inventory_UID',brand:'romo',role:'inventario',branches:['serena']
 });
 assert.equal((await invoke(handler)).statusCode,403);
 assert.equal((await invoke(handler,{method:'POST',body:{expectedRevision:0,snapshot:snapshot()}})).statusCode,403);
 assert.equal(db.queries.length,0);
});
