import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ROMO_OPERATIVO_STORE_ID,ROMO_OPERATIVO_SUCURSAL,ROMO_OPERATIVO_FORMAT,
 validateRomoEncryptedState,romoOperativoConfig,
 readRomoOperativeState,saveRomoOperativeState,RomoConflictoRevision
} from '../lib/romo-estado-operativo-qa.mjs';

const owner={userId:'owner_google_uid',brand:'romo',role:'duenos',branches:['serena']};
const agenda={userId:'agenda_google_uid',brand:'romo',role:'agendador',branches:['serena']};
const inventory={userId:'inventory_google_uid',brand:'romo',role:'inventario',branches:['serena']};

function sampleSnapshot(suffix=''){
 // Base64 of random-like encrypted bytes is DUMMY encrypted data, never real passwords.
 const envelope={
  formato:'uki-v813-browser',version:1,
  sucursal:'Romo’s Sushi La Serena',
  salt:Buffer.alloc(16,1).toString('base64'),
  iv:Buffer.alloc(12,2).toString('base64'),
  cifrado:Buffer.from('encrypted-data-for-romo-and-not-uki'+suffix).toString('base64')
 };
 return envelope;
}
function mockDb(){
 let row=null;
 const calls=[];
 return {
  calls,
  async query(sql,params){
   calls.push({sql,params});
   assert.ok(sql.includes('public.romo_estado_operativo_v1'));
   assert.equal(params[0],'romo:serena');
   if(sql.startsWith('SELECT ')){
    return row?[{revision:row.revision,snapshot:row.snapshot}]:[];
   }
   if(sql.startsWith('INSERT ')){
    if(row)return [];
    row={revision:1,snapshot:JSON.parse(params[1]),actor:params[2]};
    return [{revision:1}];
   }
   if(sql.startsWith('UPDATE ')){
    if(!row||row.revision!==params[1])return [];
    row={revision:row.revision+1,snapshot:JSON.parse(params[2]),actor:params[3]};
    return [{revision:row.revision}];
   }
   throw Error('SQL inesperado');
  },
  current(){return row}
 };
}

test('el ID y la sucursal son únicamente Romo La Serena',()=>{
 assert.equal(ROMO_OPERATIVO_STORE_ID,'romo:serena');
 assert.equal(ROMO_OPERATIVO_SUCURSAL,'Romo’s Sushi La Serena');
 assert.equal(ROMO_OPERATIVO_FORMAT,'uki-v813-browser');
});

test('antes de crear el primer estado, la respuesta es vacía y revisión cero',async()=>{
 const db=mockDb();
 const data=await readRomoOperativeState({db,identity:owner});
 assert.deepEqual(data,{storeId:'romo:serena',revision:0,snapshot:null});
 assert.equal(db.calls.length,1);
 assert.match(db.calls[0].sql,/^SELECT revision, snapshot/);
});

test('primer guardado crea la revisión uno sin enviar datos Uki ni contraseña',async()=>{
 const db=mockDb(),snapshot=sampleSnapshot('01');
 const result=await saveRomoOperativeState({db,identity:owner,expectedRevision:0,snapshot});
 assert.deepEqual(result,{storeId:'romo:serena',revision:1});
 assert.deepEqual(db.current().snapshot,snapshot);
 assert.equal(db.current().actor,'owner_google_uid');
 assert.equal(JSON.stringify(db.calls).includes('password'),false);
 assert.equal(JSON.stringify(db.calls).includes('Uki La Serena'),false);
 const read=await readRomoOperativeState({db,identity:agenda});
 assert.equal(read.revision,1);
 assert.deepEqual(read.snapshot,snapshot);
});

test('dos teléfonos con la misma revisión nunca se sobrescriben',async()=>{
 const db=mockDb();
 await saveRomoOperativeState({db,identity:owner,expectedRevision:0,snapshot:sampleSnapshot('first')});
 const newSnapshot=sampleSnapshot('phone1');
 const writer1=await saveRomoOperativeState({db,identity:agenda,expectedRevision:1,snapshot:newSnapshot});
 assert.equal(writer1.revision,2);
 const outdated=saveRomoOperativeState({db,identity:owner,expectedRevision:1,snapshot:sampleSnapshot('phone2')});
 await assert.rejects(outdated,e=>e instanceof RomoConflictoRevision&&e.code==='REVISION_CONFLICTO');
 const stored=await readRomoOperativeState({db,identity:owner});
 assert.equal(stored.revision,2);
 assert.deepEqual(stored.snapshot,newSnapshot);
 assert.equal(db.current().actor,'agenda_google_uid');
});

test('reintentar la creación si ya se guardó bloquea el duplicado',async()=>{
 const db=mockDb();
 await saveRomoOperativeState({db,identity:owner,expectedRevision:0,snapshot:sampleSnapshot()});
 await assert.rejects(
  saveRomoOperativeState({db,identity:owner,expectedRevision:0,snapshot:sampleSnapshot('another')}),
  {code:'REVISION_CONFLICTO'}
 );
 assert.equal(db.current().revision,1);
});

test('una identidad Uki o un trabajador de inventario no pueden acceder al total de pedidos/caja',async()=>{
 for(const identity of [null,inventory,{...owner,brand:'uki'},{...agenda,branches:['arica']},
  {...agenda,role:'desconocido'}]){
  const db=mockDb();
  await assert.rejects(readRomoOperativeState({db,identity}));
  await assert.rejects(saveRomoOperativeState({db,identity,expectedRevision:0,snapshot:sampleSnapshot()}));
  assert.equal(db.calls.length,0);
 }
});

test('un paquete de Uki o campos extras nunca se guardan',async()=>{
 const bad=[
  {...sampleSnapshot(),sucursal:'Uki La Serena'},
  {...sampleSnapshot(),sucursal:'Romo Regimiento Arica'},
  {...sampleSnapshot(),formato:'otro'},
  {...sampleSnapshot(),version:2},
  {...sampleSnapshot(),cifrado:'cifrado-no-base64'},
  {...sampleSnapshot(),salt:Buffer.alloc(5).toString('base64')},
  {...sampleSnapshot(),iv:Buffer.alloc(16).toString('base64')},
  {...sampleSnapshot(),password:'password-en-claro'}
 ];
 for(const snapshot of bad){
  const db=mockDb();
  assert.throws(()=>validateRomoEncryptedState(snapshot));
  await assert.rejects(saveRomoOperativeState({db,identity:owner,expectedRevision:0,snapshot}));
  assert.equal(db.calls.length,0);
 }
});

test('revisión inválida y foto excesiva se rechazan antes de consultar Neon',async()=>{
 for(const expectedRevision of [-1,NaN,1.5,null,'0',Number.MAX_SAFE_INTEGER]){
  const db=mockDb();
  await assert.rejects(saveRomoOperativeState({db,identity:owner,expectedRevision,snapshot:sampleSnapshot()}));
  assert.equal(db.calls.length,0);
 }
 const tooBig={...sampleSnapshot(),cifrado:'A'.repeat(2400004)};
 assert.throws(()=>validateRomoEncryptedState(tooBig));
});

test('sin activación y base exclusiva confirmada el puente está cerrado',()=>{
 const base={
  VERCEL_ENV:'production',ROMO_OPERATIVO_LIVE_ENABLED:'true',
  ROMO_PRIVATE_DATABASE_URL:'postgresql://romo_writer:s3cret@ep-romo-test.us-east-2.aws.neon.tech/romos_sushi',
  ROMO_PRIVATE_DATABASE_HOST:'ep-romo-test.us-east-2.aws.neon.tech',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://diannaleandra-art.github.io'
 };
 assert.equal(romoOperativoConfig({}),null);
 assert.equal(romoOperativoConfig({...base,VERCEL_ENV:'preview'}),null);
 assert.equal(romoOperativoConfig({...base,ROMO_OPERATIVO_LIVE_ENABLED:'false'}),null);
 assert.equal(romoOperativoConfig({...base,ROMO_PRIVATE_DATABASE_HOST:'otro.neon.tech'}),null);
 assert.equal(romoOperativoConfig({...base,ROMO_PRIVATE_DATABASE_URL:base.ROMO_PRIVATE_DATABASE_URL.replace('/romos_sushi','/uki')}),null);
 assert.equal(romoOperativoConfig({...base,UKI_FIN_PRIVATE_DATABASE_URL:base.ROMO_PRIVATE_DATABASE_URL}),null);
 assert.equal(romoOperativoConfig({...base,ROMO_PANEL_ALLOWED_ORIGIN:'http://diannaleandra-art.github.io'}),null);
 assert.equal(romoOperativoConfig({...base,ROMO_PANEL_ALLOWED_ORIGIN:'https://diannaleandra-art.github.io/redirect'}),null);
 assert.equal(romoOperativoConfig(base)?.storeId,'romo:serena');
});
