import test from 'node:test';
import assert from 'node:assert/strict';
import {
 crearAlmacenamientoInventarioRomoQA
} from '../lib/romo-almacenamiento-inventario-panel-qa.mjs';
import {
 crearRouterAlmacenamientoQA,crearMemoriaLocalQA
} from '../lib/uki-local-router-qa.mjs';
import {emptyRomoInventory} from '../lib/romo-inventario-integracion-qa.mjs';

const owner={brand:'romo',branches:['serena'],role:'duenos',userId:'duena_qa'};
const employee={brand:'romo',branches:['serena'],role:'inventario',userId:'inventario_qa'};
const item={id:'pollo',name:'Pollo',unit:'kg',recibido:15,hay:10,minimo:11,disponible:true};
const req=(action,payload=null,storeId='romo:serena')=>
 ({storeId,area:'inventory',action,fechaOperativa:null,payload});

function backend(){
 let revision=0,document=emptyRomoInventory();
 const operations=[];
 return {
  operations,
  async query(sql,args){
   operations.push({sql,args});
   assert.match(sql,/public\.romo_inventario_v1/);
   assert.equal(args[0],'romo:serena');
   if(sql.startsWith('SELECT ')){
    return revision?[{revision,contenido:document}]:[];
   }
   if(sql.startsWith('INSERT ')){
    if(revision)return [];
    revision=1;document=JSON.parse(args[1]);return [{revision}];
   }
   if(sql.startsWith('UPDATE ')){
    if(revision!==args[1])return [];
    revision++;document=JSON.parse(args[2]);return [{revision}];
   }
   throw Error('SQL inesperado');
  },
  state(){return {revision,document:structuredClone(document)}}
 };
}
const instance=(db,identity=owner)=>
 crearRouterAlmacenamientoQA({qaOnly:true,adapters:{
  'romo:serena':crearAlmacenamientoInventarioRomoQA({db,identity}),
  'uki:arica':crearMemoriaLocalQA('uki:arica'),
  'uki:serena':crearMemoriaLocalQA('uki:serena')
 }});
test('misma vista y selector: inventario independiente de Romo y sin segunda aplicación',async()=>{
 const db=backend(),router=instance(db);
 const before=await router.execute(req('read'));
 assert.equal(before.storeId,'romo:serena');
 assert.equal(before.revision,0);
 assert.equal(before.inventory.sucursal,'romo:serena');
 const added=await router.execute(req('create',{expectedRevision:0,item}));
 assert.equal(added.revision,1);
 const after=await router.execute(req('read'));
 assert.equal(after.inventory.items.length,1);
 assert.equal(after.report[0].diferencia,5);
 assert.equal(after.report[0].reponer,1);
 for(const storeId of ['uki:arica','uki:serena']){
  const other=await router.execute(req('read',null,storeId));
  assert.equal(other.entries.length,0);
 }
 assert.ok(db.operations.every(x=>x.args[0]==='romo:serena'));
});
test('mismo flujo inventario: contar, editar, marcar agotado, borrar y mostrar reposición',async()=>{
 const db=backend(),router=instance(db);
 await router.execute(req('create',{expectedRevision:0,item}));
 await router.execute(req('count',{
  expectedRevision:1,id:'pollo',patch:{hay:7,recibido:18}
 }));
 let read=await router.execute(req('read'));
 assert.equal(read.revision,2);
 assert.equal(read.report[0].diferencia,11);
 assert.equal(read.report[0].reponer,4);
 await router.execute(req('edit',{
  expectedRevision:2,id:'pollo',patch:{disponible:false,minimo:12}
 }));
 read=await router.execute(req('read'));
 assert.equal(read.inventory.items[0].disponible,false);
 await router.execute(req('retire',{expectedRevision:3,id:'pollo'}));
 read=await router.execute(req('read'));
 assert.equal(read.inventory.items.length,0);
 assert.equal(read.revision,4);
});
test('dos teléfonos: rechazo de revisión antigua sin sobrescribir inventario',async()=>{
 const db=backend(),phoneA=instance(db),phoneB=instance(db);
 await phoneA.execute(req('create',{expectedRevision:0,item}));
 const fromB=await phoneB.execute(req('read'));
 assert.equal(fromB.revision,1);
 await phoneA.execute(req('count',{expectedRevision:1,id:'pollo',patch:{hay:8}}));
 await assert.rejects(phoneB.execute(req('count',{expectedRevision:1,id:'pollo',patch:{hay:0}})),
  e=>e.code==='ROMO_INVENTORY_CONFLICT');
 const final=await phoneB.execute(req('read'));
 assert.equal(final.inventory.items[0].hay,8);
 assert.equal(final.revision,2);
});
test('PIN de inventario se limita a inventario: no pedidos, caja ni cierres',async()=>{
 const db=backend(),router=instance(db,employee);
 const r=await router.execute(req('create',{expectedRevision:0,item}));
 assert.equal(r.storeId,'romo:serena');
 // El adaptador únicamente sabe inventory.read/write, NO acepta otras áreas.
 await assert.rejects(router.execute({storeId:'romo:serena',area:'cash',
  action:'record',fechaOperativa:null,payload:{expectedRevision:0,item}}),/Inventario Romo/);
 assert.equal(db.operations.filter(x=>x.sql.startsWith('INSERT')).length,1);
});
test('rechaza datos de Uki, roles falsos y modificaciones inseguras antes de Neon',async()=>{
 const db=backend(),router=instance(db);
 await assert.rejects(router.execute(req('create',{expectedRevision:0,item,role:'duenos'})),/no autorizados/);
 await assert.rejects(router.execute(req('create',{expectedRevision:0,item:{...item,unit:'pizzas'}})),/inválido/);
 await assert.rejects(router.execute(req('create',{expectedRevision:0,item:{...item,id:'uki:pollo'}})),/inválido/);
 await assert.rejects(router.execute(req('create',{expectedRevision:0,item:{...item,disponible:'false'}})),/inválido/);
 await assert.rejects(router.execute(req('read',{},'romo:serena')),/Consulta/);
 await assert.rejects(router.execute(req('create',{expectedRevision:0,item},'romo:arica')),/Sucursal no reconocida/);
 assert.equal(db.state().revision,0);
 assert.throws(()=>crearAlmacenamientoInventarioRomoQA({db,identity:{...owner,brand:'uki'}}),/Identidad/);
});
test('unidades de la pantalla original Uki también aceptadas sin otro inventario',async()=>{
 const db=backend(),router=instance(db);
 const list=[
  {...item,id:'cajas',name:'Cajas',unit:'un'},
  {...item,id:'porcion',name:'Porciones',unit:'porciones'},
  {...item,id:'gramos',name:'Gramos',unit:'g'},
  {...item,id:'litros',name:'Litros',unit:'l'},
  {...item,id:'mililitros',name:'Mililitros',unit:'ml'}
 ];
 for(let i=0;i<list.length;i++)await router.execute(req('create',{expectedRevision:i,item:list[i]}));
 const result=await router.execute(req('read'));
 assert.deepEqual(result.inventory.items.map(x=>x.unit),['un','porciones','g','l','ml']);
 assert.equal(result.revision,5);
});
