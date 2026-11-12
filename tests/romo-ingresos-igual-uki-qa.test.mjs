import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {authorizeRomoOperation} from '../lib/romo-scope-operativo-qa.mjs';
import {resolveRomoIdentity,FIREBASE_PROJECT} from '../lib/romo-identidad-servidor-qa.mjs';
const require=createRequire(import.meta.url);
const ukiPin=require('../lib/uki-inventario-pin-live.cjs');
const uid='qa_owner_test_1';
const ownerEmail='duenos-ejemplo@test.invalid';
const claims={sub:uid,email:ownerEmail,email_verified:true,
 iss:'https://securetoken.google.com/'+FIREBASE_PROJECT,
 aud:FIREBASE_PROJECT,firebase:{sign_in_provider:'google.com'}};
const env={ROMO_DUENOS_GOOGLE_EMAIL:ownerEmail};
const db={query:async(sql,parameters)=>{
 assert.match(sql,/public\.romo_personal_acceso_v1/);
 assert.deepEqual(parameters,[uid,'romo:serena']);
 return [{rol:'duenos'}];
}};
test('dueños: misma sesión Google verificada pero exige rol independiente de Romo',async()=>{
 const identity=await resolveRomoIdentity({
  authorization:'Bearer '+ 'x'.repeat(35),
  db,verifyToken:async()=>claims,env
 });
 assert.equal(identity.brand,'romo');
 assert.equal(identity.role,'duenos');
 assert.equal(authorizeRomoOperation(identity,'romo','serena','inventory.read').scope,'romo:serena');
 assert.throws(()=>authorizeRomoOperation(identity,'uki','serena','inventory.read'));
});
test('Google por sí solo no concede acceso a Romo',async()=>{
 const denied=await resolveRomoIdentity({
  authorization:'Bearer '+ 'x'.repeat(35),
  db:{query:async()=>[]},verifyToken:async()=>claims,env
 });
 assert.equal(denied,null);
});
test('trabajador: mismo formato de seis dígitos que Uki, pero sin acceso a caja',()=>{
 assert.equal(ukiPin.valido('654321'),true);
 assert.equal(ukiPin.valido('54321'),false);
 assert.equal(ukiPin.valido('abcdef'),false);
 const worker={userId:'worker_qa',brand:'romo',role:'inventario',branches:['serena']};
 assert.equal(authorizeRomoOperation(worker,'romo','serena','inventory.read').scope,'romo:serena');
 assert.throws(()=>authorizeRomoOperation(worker,'romo','serena','cash.read'));
 assert.throws(()=>authorizeRomoOperation(worker,'romo','serena','orders.read'));
 assert.throws(()=>authorizeRomoOperation(worker,'uki','serena','inventory.read'));
});
