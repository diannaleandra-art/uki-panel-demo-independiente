import test from 'node:test';
import assert from 'node:assert/strict';
import {romoClavesReadConfig,readRomoSharedPassProofs,adaptarNeonParaClavesRomoQA}
  from '../lib/romo-claves-lectura-servidor-qa.mjs';

const owner={userId:'owner_qa',brand:'romo',role:'duenos',branches:['serena']};
const agendador={userId:'agenda_qa',brand:'romo',role:'agendador',branches:['serena']};
const inventory={userId:'inventory_qa',brand:'romo',role:'inventario',branches:['serena']};
const fakeProof=(source='uki:serena')=>({
 formato:'romo-uki-shared-pass-proof-v1',storeId:'romo:serena',
 ukiSource:source,iteraciones:300000,
 salt:Buffer.alloc(16).toString('base64'),
 iv:Buffer.alloc(12).toString('base64'),
 cifrado:Buffer.alloc(32).toString('base64')
});
const fakeDb=(rows=[])=>({
 calls:[],
 async query(sql,args){this.calls.push({sql,args});return rows}
});

test('la conexión de las claves de Romo está APAGADA por defecto o en preview',()=>{
 assert.equal(romoClavesReadConfig({}),null);
 const base={VERCEL_ENV:'production',ROMO_ACCESO_CLAVES_LIVE_ENABLED:'true',
  ROMO_PRIVATE_DATABASE_URL:'postgres://app:secret@romodb.example/romos_sushi',
  ROMO_PRIVATE_DATABASE_HOST:'romodb.example',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://panel.example'};
 assert.equal(romoClavesReadConfig({...base,VERCEL_ENV:'preview'}),null);
 assert.equal(romoClavesReadConfig({...base,ROMO_ACCESO_CLAVES_LIVE_ENABLED:'false'}),null);
 assert.equal(romoClavesReadConfig({...base,ROMO_PRIVATE_DATABASE_URL:'postgres://app:secret@romodb.example/uki'}),null);
 assert.equal(romoClavesReadConfig({...base,UKI_FIN_PRIVATE_DATABASE_URL:'postgres://x:y@romodb.example/uki'}),null);
 assert.equal(romoClavesReadConfig({...base,ROMO_PRIVATE_DATABASE_HOST:'other.example'}),null);
 assert.equal(romoClavesReadConfig({...base,ROMO_PANEL_ALLOWED_ORIGIN:'http://panel.example'}),null);
 const valid=romoClavesReadConfig(base);
 assert.equal(valid?.storeId,'romo:serena');
 assert.equal(valid?.origin,'https://panel.example');
});

test('sin clave registrada no pide crear otra ni devuelve datos Uki',async()=>{
 const db=fakeDb();
 const result=await readRomoSharedPassProofs({db,identity:owner});
 assert.equal(result.storeId,'romo:serena');
 assert.equal(result.configured,false);
 assert.deepEqual(result.proofs,[]);
 assert.equal(db.calls.length,1);
 assert.deepEqual(db.calls[0].args,['romo:serena']);
 assert.match(db.calls[0].sql,/public\.romo_clave_compartida_v1/);
 assert.match(db.calls[0].sql,/SELECT uki_source,proof/);
});

test('usuarios autorizados por Google/roles leen solo el paquete cifrado de Romo',async()=>{
 const proof=fakeProof();
 const db=fakeDb([{uki_source:'uki:serena',proof}]);
 for(const identity of [owner,agendador,inventory]){
  const result=await readRomoSharedPassProofs({db,identity});
  assert.equal(result.configured,true);
  assert.deepEqual(result.proofs,[proof]);
  assert.equal(JSON.stringify(result).includes('password'),false);
  assert.equal(JSON.stringify(result).includes('clientes'),false);
  assert.equal(JSON.stringify(result).includes('pedidos'),false);
 }
});

test('sin identidad validada, rol no permitido o identidad Uki no se hace consulta SQL',async()=>{
 const denied=[
  null,
  {...owner,brand:'uki'},
  {...owner,role:'admin'},
  {...agendador,branches:['arica']},
  {...agendador,branches:['serena','arica']}
 ];
 for(const identity of denied){
  const db=fakeDb([{uki_source:'uki:serena',proof:fakeProof()}]);
  await assert.rejects(()=>readRomoSharedPassProofs({db,identity}));
  assert.equal(db.calls.length,0);
 }
});

test('rechaza duplicados, nombres de fuente cruzados o prueba corrupta',async()=>{
 const proof=fakeProof();
 for(const rows of [
  [{uki_source:'uki:arica',proof}],
  [{uki_source:'uki:serena',proof},{uki_source:'uki:serena',proof}],
  [{uki_source:'uki:serena',proof:{...proof,storeId:'uki:serena'}}],
  [{uki_source:'uki:serena',proof:{...proof,iteraciones:1}}],
  Array.from({length:3},()=>({uki_source:'uki:serena',proof}))
 ]){
  await assert.rejects(()=>readRomoSharedPassProofs({db:fakeDb(rows),identity:owner}));
 }
});

test('no existe ninguna función de cambio ni borrado de contraseñas en el módulo',async()=>{
 const result=await readRomoSharedPassProofs({db:fakeDb(),identity:owner});
 assert.deepEqual(Object.keys(result).sort(),['configured','proofs','storeId']);
});


test('la misma verificación Google de Uki puede consultar el rol Romo por Neon (sin crear otro login)',async()=>{
 const calls=[];
 const sql=Object.assign(async()=>{throw Error('Nunca invocar sin .query')},{
  query:async(statement,params)=>{
   calls.push({statement,params});
   if(statement.startsWith('SELECT rol'))return [{rol:'agendador'}];
   return [{uki_source:'uki:serena',proof:fakeProof()}];
  }
 });
 const db=adaptarNeonParaClavesRomoQA(sql);
 const roles=await db.query(
  'SELECT rol FROM public.romo_personal_acceso_v1 WHERE auth_uid=$1 AND store_id=$2 AND activo=true LIMIT 1',
  ['uid-google-qa','romo:serena']
 );
 assert.deepEqual(roles,[{rol:'agendador'}]);
 const shared=await readRomoSharedPassProofs({db,identity:agendador});
 assert.equal(shared.configured,true);
 assert.equal(shared.proofs[0].ukiSource,'uki:serena');
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.params.at(-1)==='romo:serena'));
 assert.equal(JSON.stringify(calls).includes('password'),false);
});

test('el adaptador de verificación no puede tocar inventario, caja, otros locales ni crear usuarios',async()=>{
 let sent=0;
 const sql=Object.assign(async()=>{throw Error('Nunca invocar sin .query')},{
  query:async()=>{sent++;return []}
 });
 const db=adaptarNeonParaClavesRomoQA(sql);
 for(const [sql,args] of [
  ['SELECT * FROM public.uki_inventario_live',['romo:serena']],
  ['UPDATE public.romo_personal_acceso_v1 SET activo=true',['romo:serena']],
  ['SELECT rol FROM public.romo_personal_acceso_v1 WHERE auth_uid=$1 AND store_id=$2 AND activo=true LIMIT 1',['fake','uki:serena']],
  ['SELECT uki_source,proof FROM public.romo_clave_compartida_v1 WHERE store_id=$1 ORDER BY uki_source LIMIT 3',['uki:arica']],
  ['SELECT uki_source,proof FROM public.romo_clave_compartida_v1 WHERE store_id=$1 ORDER BY uki_source LIMIT 3',[]]
 ]){
  await assert.rejects(db.query(sql,args),/fuera de Romo/);
 }
 assert.equal(sent,0);
 assert.throws(()=>adaptarNeonParaClavesRomoQA({query(){}}),/Conexión SQL/);
});

test('el cliente Neon 1.2 instalado tiene método .query parametrizado; el adaptador lo exige',async()=>{
 const {neon}=await import('@neondatabase/serverless');
 const sql=neon('postgresql://test:dummy@localhost.invalid/romos_sushi');
 assert.equal(typeof sql.query,'function');
 assert.equal(typeof adaptarNeonParaClavesRomoQA(sql).query,'function');
 assert.throws(()=>adaptarNeonParaClavesRomoQA(async()=>[]),/Conexión SQL Romo requerida/);
});
