import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRomoPassProof,verifyRomoPassProof} from '../lib/romo-clave-compartida-qa.mjs';
import {verificarAltaClaveRomoQA,enrolarClaveExistenteRomoQA} from '../lib/romo-claves-alta-qa.mjs';
import {guardarVerificadorUkiEnRomoQA} from '../firebase/uki-romo-alta-clave-qa.mjs';
const owner={userId:'owner_test_123',brand:'romo',role:'duenos',branches:['serena']};
const worker={userId:'worker_test_123',brand:'romo',role:'inventario',branches:['serena']};
const pass='EjemploDeClaveUki_2026';
const create=()=>createRomoPassProof({password:pass,ukiSource:'uki:serena',cryptoProvider:webcrypto});
function db(){
 const rows=new Map(),calls=[];
 return {calls,rows,async query(sql,params){
  calls.push({sql,params});
  assert.match(sql,/^INSERT INTO public\.romo_clave_compartida_v1/);
  assert.match(sql,/ON CONFLICT \(store_id,uki_source\) DO NOTHING/);
  assert.equal(params[0],'romo:serena');
  assert.equal(params[3],owner.userId);
  if(rows.has(params[1]))return [];
  rows.set(params[1],JSON.parse(params[2]));
  return [{uki_source:params[1]}];
 }};
}
test('enrolar usa la misma clave Uki y guarda solo un verificador cifrado',async()=>{
 const proof=await create(),store=db();
 const result=await enrolarClaveExistenteRomoQA({db:store,identity:owner,proof});
 assert.equal(result.saved,true);
 assert.equal(result.ventasHabilitadas,false);
 assert.equal(result.storeId,'romo:serena');
 assert.equal(store.calls.length,1);
 assert.equal(store.rows.get('uki:serena').storeId,'romo:serena');
 assert.equal(JSON.stringify(store.calls).includes(pass),false);
 assert.equal(JSON.stringify(store.calls).includes('pedido'),false);
 assert.equal(await verifyRomoPassProof({
  password:pass,proof:store.rows.get('uki:serena'),cryptoProvider:webcrypto
 }),true);
});
test('reintento no reemplaza la clave existente ni crea duplicados',async()=>{
 const store=db();
 await enrolarClaveExistenteRomoQA({db:store,identity:owner,proof:await create()});
 await assert.rejects(enrolarClaveExistenteRomoQA({db:store,identity:owner,proof:await create()}),
  e=>e.code==='ROMO_PROOF_EXISTS');
 assert.equal(store.rows.size,1);
});
test('agendador o trabajador no puede registrar un verificador',async()=>{
 const store=db();
 await assert.rejects(enrolarClaveExistenteRomoQA({db:store,identity:worker,proof:await create()}),/permiso/);
 assert.equal(store.calls.length,0);
});
test('rechaza inyección de contraseña, otra sucursal y campos adicionales',async()=>{
 const proof=await create(),store=db();
 for(const invalid of [
  {...proof,password:pass},{...proof,storeId:'uki:serena'},
  {...proof,ukiSource:'romo:arica'},{...proof,creadoPor:'duena'}
 ]){
  assert.throws(()=>verificarAltaClaveRomoQA(invalid));
  await assert.rejects(enrolarClaveExistenteRomoQA({db:store,identity:owner,proof:invalid}));
 }
 assert.equal(store.calls.length,0);
});
test('frontend NO envía contraseña, token ni datos si la ruta está apagada',async()=>{
 let called=0;
 await assert.rejects(guardarVerificadorUkiEnRomoQA({
  password:pass,ukiSource:'uki:serena',
  unlockExistingUki:async()=>{called++;throw Error('no')},
  getToken:async()=>{called++;return 'token'},
  fetchFn:async()=>{called++;throw Error('no')}
 }),/todavía no habilitado/);
 assert.equal(called,0);
});
test('API solo puede activarse explícitamente con Google y POST cifrado',()=>{
 const source=readFileSync(new URL('../api/romo-claves-alta-qa.js',import.meta.url),'utf8');
 assert.match(source,/ROMO_ACCESO_CLAVES_ALTA_LIVE_ENABLED/);
 assert.match(source,/resolveRomoIdentity/);
 assert.match(source,/identity.role!=='duenos'/);
 assert.match(source,/Access-Control-Allow-Methods','POST,OPTIONS'/);
 assert.doesNotMatch(source,/UPDATE public\.romo_clave_compartida_v1/);
});
