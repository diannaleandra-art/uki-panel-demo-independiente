import test from 'node:test';
import assert from 'node:assert/strict';
import {
 crearRouterAlmacenamientoQA,crearMemoriaLocalQA
} from '../lib/uki-local-router-qa.mjs';
import {
 crearAlmacenamientoOperativoRomoQA,ROMO_ALMACENAMIENTO_OPERATIVO_SOLO_QA
} from '../lib/romo-almacenamiento-operativo-panel-qa.mjs';

const owner=Object.freeze({userId:'duenos_qa',brand:'romo',role:'duenos',branches:['serena']});
const staff=Object.freeze({userId:'agendador_qa',brand:'romo',role:'agendador',branches:['serena']});
const warehouse=Object.freeze({userId:'bodega_qa',brand:'romo',role:'inventario',branches:['serena']});
const snapshot=tag=>({
 formato:'uki-v813-browser',version:1,sucursal:'Romo’s Sushi La Serena',
 salt:Buffer.alloc(16,1).toString('base64'),
 iv:Buffer.alloc(12,2).toString('base64'),
 cifrado:Buffer.from('solo-ensayo-cifrado-romo-'+tag).toString('base64')
});
const req=(action,payload=null)=>({
 storeId:'romo:serena',area:'operativo',action,payload
});
class DB {
 row=null;calls=[];
 async query(sql,params){
  assert.ok(sql.includes('public.romo_estado_operativo_v1'));
  assert.equal(params[0],'romo:serena');
  this.calls.push({sql,params});
  if(sql.startsWith('SELECT'))return this.row?[{revision:this.row.revision,snapshot:this.row.snapshot}]:[];
  if(sql.startsWith('INSERT')){
   if(this.row)return [];
   this.row={revision:1,snapshot:JSON.parse(params[1])};return [{revision:1}];
  }
  if(sql.startsWith('UPDATE')){
   if(!this.row||this.row.revision!==params[1])return [];
   this.row={revision:this.row.revision+1,snapshot:JSON.parse(params[2])};
   return [{revision:this.row.revision}];
  }
  throw Error('SQL de test no reconocido');
 }
}
const connected=(db,identity=owner)=>{
 const adapter=crearAlmacenamientoOperativoRomoQA({db,identity});
 const uki=crearMemoriaLocalQA('uki:serena');
 return {router:crearRouterAlmacenamientoQA({
  qaOnly:true,adapters:{'romo:serena':adapter,'uki:serena':uki}
 }),uki};
};

test('el panel usa el MISMO estado cifrado de Uki pero solo en base Romo',async()=>{
 assert.equal(ROMO_ALMACENAMIENTO_OPERATIVO_SOLO_QA,true);
 const db=new DB(),{router}=connected(db);
 const first=await router.execute(req('read'));
 assert.equal(first.storeId,'romo:serena');
 assert.equal(first.revision,0);
 assert.equal(first.snapshot,null);
 const saved=await router.execute(req('save',{expectedRevision:0,snapshot:snapshot('uno')}));
 assert.deepEqual(saved,{storeId:'romo:serena',area:'operativo',revision:1});
 const next=await router.execute(req('read'));
 assert.equal(next.revision,1);
 assert.equal(next.snapshot.sucursal,'Romo’s Sushi La Serena');
 assert.equal(db.calls.length,3);
 assert.ok(db.calls.every(x=>x.sql.includes('public.romo_estado_operativo_v1')));
 assert.ok(db.calls.every(x=>x.params[0]==='romo:serena'));
});

test('dos teléfonos: el segundo no pisa la versión cifrada guardada por el primero',async()=>{
 const db=new DB(),a=connected(db,owner).router,b=connected(db,staff).router;
 const initial=await a.execute(req('read'));
 const first=await a.execute(req('save',{expectedRevision:initial.revision,snapshot:snapshot('telefonoA')}));
 assert.equal(first.revision,1);
 const check=await b.execute(req('read'));
 assert.equal(check.revision,1);
 const changed=await b.execute(req('save',{expectedRevision:1,snapshot:snapshot('telefonoB')}));
 assert.equal(changed.revision,2);
 await assert.rejects(a.execute(req('save',{expectedRevision:1,snapshot:snapshot('obsoleta')})),
  {code:'REVISION_CONFLICTO'});
 const final=await a.execute(req('read'));
 assert.equal(final.revision,2);
 assert.deepEqual(final.snapshot,snapshot('telefonoB'));
});

test('no se reutilizan registros o respaldos de Uki, ni se pasa contraseña al servidor',async()=>{
 const db=new DB(),{router}=connected(db);
 const pkg=snapshot('pedido-demo');
 await router.execute(req('save',{expectedRevision:0,snapshot:pkg}));
 assert.equal((await router.execute({storeId:'uki:serena',area:'operativo',action:'read'})).snapshot,undefined);
 assert.deepEqual((await router.execute({storeId:'uki:serena',area:'operativo',action:'read'})).entries,[]);
 assert.equal(JSON.stringify(db.calls).includes('Uki La Serena'),false);
 assert.equal(JSON.stringify(db.calls).includes('password'),false);
 await assert.rejects(router.execute(req('save',{expectedRevision:1,snapshot:{...pkg,sucursal:'Uki La Serena'}})),
  /no pertenece a Romo/);
 assert.equal(db.row.revision,1);
});
test('rol de inventario no puede abrir pedidos y caja; UID falso no puede guardar',async()=>{
 const db=new DB();
 const {router}=connected(db,warehouse);
 await assert.rejects(router.execute(req('read')),/rol no tiene permiso/);
 await assert.rejects(router.execute(req('save',{expectedRevision:0,snapshot:snapshot('intento')})),/rol no tiene permiso/);
 assert.equal(db.calls.length,0);
 assert.throws(()=>crearAlmacenamientoOperativoRomoQA({db,identity:{...owner,brand:'uki'}}),/sin validación/);
});
test('no hay desvío a Arica o uso de métodos comerciales de otros módulos',async()=>{
 const db=new DB(),{router}=connected(db);
 await assert.rejects(router.execute({storeId:'romo:serena',area:'catalog',action:'read'}),/estado Romo pertenece únicamente|lectura del estado Romo/);
 await assert.rejects(router.execute({storeId:'romo:serena',area:'inventory',action:'create',payload:{fixtureQA:true,key:'xx'}}),/otro local|estado operativo/);
 await assert.rejects(router.execute({storeId:'romo:arica',area:'operativo',action:'read'}),/Sucursal no reconocida/);
 await assert.rejects(router.execute(req('save',{expectedRevision:0,snapshot:snapshot('qa'),password:'secreto'})),/únicamente el sobre cifrado/);
 assert.equal(db.calls.length,0);
});
