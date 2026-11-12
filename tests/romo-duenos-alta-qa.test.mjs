import test from 'node:test';
import assert from 'node:assert/strict';
import {FIREBASE_PROJECT} from '../lib/romo-identidad-servidor-qa.mjs';
import {
 romoAltaDuenosConfigQA,enlazarDuenosRomoConGoogleExistenteQA
} from '../lib/romo-duenos-alta-qa.mjs';
import handler from '../api/romo-duenos-alta-qa.js';

const EMAIL='dueña-fixture@example.test';
const env={
 VERCEL_ENV:'production',
 ROMO_DUENOS_VINCULO_ENABLED:'true',
 ROMO_DUENOS_ALTA_EXPLICITA_ENABLED:'true',
 ROMO_DUENOS_GOOGLE_EMAIL:EMAIL,
 ROMO_PANEL_ALLOWED_ORIGIN:'https://panel-qa.example',
 ROMO_PRIVATE_DATABASE_HOST:'romo-test.example',
 ROMO_DUENOS_ALTA_DATABASE_URL:'postgresql://romo_owner_linker:dummy-pw@romo-test.example/romos_sushi'
};
const signedClaims={
 sub:'Firebase_UID_RealNoSeCopia_Fixture123',
 email:EMAIL,email_verified:true,
 iss:'https://securetoken.google.com/'+FIREBASE_PROJECT,
 aud:FIREBASE_PROJECT,
 firebase:{sign_in_provider:'google.com'}
};
const authorization='Bearer '+('a'.repeat(64));
function dbFixture(rows=[]){
 return {rows:[...rows],calls:[],
  async query(sql,params){
   this.calls.push({sql,params});
   assert.equal(params[1],'romo:serena');
   if(sql.startsWith('SELECT'))return this.rows.filter(r=>r.auth_uid===params[0]).map(({rol,activo})=>({rol,activo}));
   if(!sql.startsWith('INSERT'))throw Error('No debe existir otra operación SQL');
   if(this.rows.some(r=>r.auth_uid===params[0]))return [];
   if(this.rows.some(r=>r.rol==='duenos'&&r.activo&&r.auth_uid!==params[0]))return [];
   const row={auth_uid:params[0],rol:'duenos',activo:true};
   this.rows.push(row);
   return [{rol:row.rol,activo:row.activo}];
  }
 };
}
const enroll=(db,claims=signedClaims,override={})=>
 enlazarDuenosRomoConGoogleExistenteQA({
  authorization,db,env:{...env,...override},verifyToken:async()=>claims
 });
test('sin autorización operativa, secretos o entorno de producción: nunca vincula',()=>{
 for(const change of [
  {VERCEL_ENV:'preview'},
  {ROMO_DUENOS_VINCULO_ENABLED:'false'},
  {ROMO_DUENOS_ALTA_EXPLICITA_ENABLED:'false'},
  {ROMO_DUENOS_ALTA_DATABASE_URL:''},
  {ROMO_DUENOS_ALTA_DATABASE_URL:'postgresql://otro:secreto@romo-test.example/romos_sushi'},
  {ROMO_DUENOS_ALTA_DATABASE_URL:'postgresql://romo_owner_linker:pw@uki-db.example/uki'},
  {ROMO_PANEL_ALLOWED_ORIGIN:'http://panel-qa.example'}
 ])assert.equal(romoAltaDuenosConfigQA({...env,...change}),null);
 assert.equal(romoAltaDuenosConfigQA(env)?.storeId,'romo:serena');
});
test('vincula únicamente la MISMA cuenta Google firmada a rol dueños, Romo Serena',async()=>{
 const db=dbFixture();
 const result=await enroll(db);
 assert.deepEqual(result,{
  ok:true,storeId:'romo:serena',alreadyLinked:false,salesEnabled:false
 });
 assert.equal(db.rows.length,1);
 assert.equal(db.rows[0].auth_uid,signedClaims.sub);
 assert.equal(db.rows[0].rol,'duenos');
 assert.equal(db.rows[0].activo,true);
 assert.equal(db.calls.length,2);
 assert.ok(db.calls[0].sql.startsWith('SELECT'));
 assert.match(db.calls[1].sql,/^INSERT INTO public\.romo_personal_acceso_v1/);
 assert.ok(db.calls.every(c=>!c.sql.includes('uki_operativo')&&!c.sql.includes('uki:')));
 assert.equal(JSON.stringify(result).includes(signedClaims.sub),false);
 assert.equal(JSON.stringify(result).includes(EMAIL),false);
});
test('repetir la solicitud de dueña NO duplica cuentas ni cambia permisos',async()=>{
 const db=dbFixture();
 await enroll(db);
 const again=await enroll(db);
 assert.equal(again.alreadyLinked,true);
 assert.equal(db.rows.length,1);
 assert.equal(db.calls.filter(x=>x.sql.startsWith('INSERT')).length,1);
});
test('nunca convierte un agendador existente en dueña automáticamente',async()=>{
 const db=dbFixture([{auth_uid:signedClaims.sub,rol:'agendador',activo:true}]);
 await assert.rejects(enroll(db),/otro acceso/);
 assert.equal(db.calls.filter(x=>x.sql.startsWith('INSERT')).length,0);
 assert.equal(db.rows[0].rol,'agendador');
});
test('otra dueña ya inscrita exige revisión, no se sustituye',async()=>{
 const db=dbFixture([{auth_uid:'OtroGoogle_123',rol:'duenos',activo:true}]);
 await assert.rejects(enroll(db),/No se completó/);
 assert.equal(db.rows.length,1);
 assert.equal(db.rows[0].auth_uid,'OtroGoogle_123');
});
test('correo distinto, otro proveedor o Google no verificado no crea ningún permiso',async()=>{
 for(const claims of [
  {...signedClaims,email:'otra@example.test'},
  {...signedClaims,email_verified:false},
  {...signedClaims,firebase:{sign_in_provider:'password'}},
  {...signedClaims,aud:'otro-proyecto'}
 ]){
  const db=dbFixture();
  await assert.rejects(enroll(db,claims),/no verificada/);
  assert.equal(db.calls.length,0);
 }
});
const fakeRes=()=>({
 code:0,body:null,headers:{},ended:false,
 setHeader(k,v){this.headers[k]=v;return this},
 status(k){this.code=k;return this},
 json(v){this.body=v;return this},
 end(){this.ended=true;return this}
});
async function withEnv(overrides,fn){
 const names=['VERCEL_ENV','ROMO_DUENOS_VINCULO_ENABLED','ROMO_DUENOS_ALTA_EXPLICITA_ENABLED',
  'ROMO_PANEL_ALLOWED_ORIGIN'];
 const before=Object.fromEntries(names.map(x=>[x,process.env[x]]));
 try{
  for(const name of names){
   if(overrides[name]===undefined)delete process.env[name];
   else process.env[name]=overrides[name];
  }
  await fn();
 }finally{
  for(const name of names){
   if(before[name]===undefined)delete process.env[name];
   else process.env[name]=before[name];
  }
 }
}
test('la API de enlace está APAGADA por defecto y tampoco funciona en preview',async()=>{
 for(const values of [{},{...env,VERCEL_ENV:'preview'}]){
  await withEnv(values,async()=>{
   const res=fakeRes();
   await handler({method:'POST',headers:{origin:env.ROMO_PANEL_ALLOWED_ORIGIN}},res);
   assert.equal(res.code,503);
   assert.equal(res.body.ok,false);
   assert.equal(res.headers['Cache-Control'],'private, no-store, max-age=0');
  });
 }
});
test('la API exige origen exacto y solo recibe cuerpo vacío, sin UID ni contraseña',async()=>{
 await withEnv(env,async()=>{
  for(const req of [
   {method:'POST',headers:{origin:'https://intruso.example','content-type':'application/json'},body:{}},
   {method:'GET',headers:{origin:env.ROMO_PANEL_ALLOWED_ORIGIN}},
   {method:'POST',headers:{origin:env.ROMO_PANEL_ALLOWED_ORIGIN,'content-type':'application/json'},body:{uid:'inventado'}},
   {method:'POST',headers:{origin:env.ROMO_PANEL_ALLOWED_ORIGIN,'content-type':'application/json'},body:{password:'nunca'}},
   {method:'POST',headers:{origin:env.ROMO_PANEL_ALLOWED_ORIGIN,'content-type':'application/json'},body:{rol:'duenos'}}
  ]){
   const res=fakeRes();await handler(req,res);
   assert.ok([503,405,400].includes(res.code));
   assert.equal(res.body.ok,false);
  }
 });
});
