import test from 'node:test';
import assert from 'node:assert/strict';
import {
 crearRouterAlmacenamientoQA,crearMemoriaLocalQA
} from '../lib/uki-local-router-qa.mjs';
import {
 crearAlmacenamientoCatalogoRomoQA,ROMO_CATALOGO_ALMACENAMIENTO_SOLO_QA
} from '../lib/romo-almacenamiento-catalogo-panel-qa.mjs';
import {prepararAltaCatalogoRomoQA} from '../lib/romo-editor-carta-repositorio-qa.mjs';

const owner={userId:'duenos_qa',brand:'romo',role:'duenos',branches:['serena']};
const worker={userId:'agendador_qa',brand:'romo',role:'agendador',branches:['serena']};
const snapshot=()=>({
 storeId:'romo:serena',brand:'romo',revision:0,
 products:[{sku:'dish:romo-gohan',name:'Gohan Romo',description:'Con pollo',
  kind:'dish',group:'entradas',price:6500,version:1,available:true,visible:true}],
 ingredients:[{sku:'armado:vegetal:palta',name:'Palta',category:'vegetal',
  surcharge:0,surfaces:['classic','gohan'],version:1,available:true,visible:true}],
 promotions:[{sku:'monthly:romo24',name:'24 piezas Romo',description:'2 rolls',
  promoType:'sushi',rollCount:2,piecesPerRoll:12,sauceCount:1,korokes:2,
  payments:['efectivo','transferencia'],customizable:true,
  price:7000,version:1,available:true,visible:true}]
});
class DB{
 row=null;queries=[];
 async query(sql,params){
  assert.ok(sql.includes('public.romo_catalogo_v1'));
  assert.equal(params[0],'romo:serena');
  this.queries.push({sql,params});
  if(sql.startsWith('SELECT'))return this.row?[{revision:this.row.revision,contenido:this.row.doc}]:[];
  if(sql.startsWith('INSERT')){
   if(this.row)return [];
   this.row={revision:1,doc:JSON.parse(params[1])};return [{revision:1}];
  }
  if(sql.startsWith('UPDATE')){
   if(!this.row||this.row.revision!==params[3])return [];
   this.row={revision:this.row.revision+1,doc:JSON.parse(params[1])};
   return [{revision:this.row.revision}];
  }
  throw Error('SQL no permitido en prueba');
 }
}
const req=(action,payload=null)=>({storeId:'romo:serena',area:'catalog',action,payload});
function router(db,identity=owner){
 return crearRouterAlmacenamientoQA({qaOnly:true,adapters:{
  'romo:serena':crearAlmacenamientoCatalogoRomoQA({db,identity}),
  'uki:arica':crearMemoriaLocalQA('uki:arica'),
  'uki:serena':crearMemoriaLocalQA('uki:serena')
 }});
}
function change(action,area,command,data){
 return req(action,{area,action:command,data});
}
test('el puente se queda en la base Romo y no muestra catálogo falso',async()=>{
 assert.equal(ROMO_CATALOGO_ALMACENAMIENTO_SOLO_QA,true);
 const db=new DB(),r=router(db);
 const read=await r.execute(req('read'));
 assert.equal(read.storeId,'romo:serena');
 assert.equal(read.revision,0);
 assert.equal(read.snapshot,null);
 assert.equal(db.queries.length,1);
});
test('usa la carta real de Romo y sus categorías y descuentos sin mezclar Uki',async()=>{
 const db=new DB();await prepararAltaCatalogoRomoQA({db,identity:owner,snapshot:snapshot()});
 const r=router(db);
 const cat=await r.execute(change('category','categorias','crear-categoria',{
  slug:'romos-promociones',nombre:'Promos Romo',expectedRevision:1
 }));
 assert.equal(cat.revision,2);
 const discount=await r.execute(change('discount','productos','editar-descuento',{
  sku:'dish:romo-gohan',expectedRevision:2,expectedVersion:1,discountPercent:10
 }));
 assert.equal(discount.revision,3);
 const read=await r.execute(req('read'));
 assert.equal(read.snapshot.products[0].price,6500,'precio original preservado');
 assert.equal(read.snapshot.products[0].discountPercent,10);
 assert.equal(read.snapshot.promotions[0].rollCount,2);
 assert.equal(read.snapshot.promotions[0].sauceCount,1);
 assert.equal(read.snapshot.promotions[0].korokes,2);
 assert.equal(read.snapshot.categories[0].nombre,'Promos Romo');
 assert.ok(db.queries.every(x=>x.params[0]==='romo:serena'));
 for(const id of ['uki:arica','uki:serena']){
  const x=await r.execute({storeId:id,area:'catalog',action:'read'});
  assert.equal(x.entries.length,0);
 }
});
test('otro dispositivo no pisa una revisión del catálogo actualizada',async()=>{
 const db=new DB();await prepararAltaCatalogoRomoQA({db,identity:owner,snapshot:snapshot()});
 const a=router(db),b=router(db);
 const old=await a.execute(req('read'));
 await a.execute(change('discount','promociones','editar-descuento',{
  sku:'monthly:romo24',expectedRevision:old.revision,expectedVersion:1,discountPercent:20
 }));
 await assert.rejects(b.execute(change('discount','productos','editar-descuento',{
  sku:'dish:romo-gohan',expectedRevision:old.revision,expectedVersion:1,discountPercent:10
 })),/revisión desactualizada|revisión inválida|actualiza/i);
 const final=await b.execute(req('read'));
 assert.equal(final.revision,2);
 assert.equal(final.snapshot.promotions[0].discountPercent,20);
 assert.equal(final.snapshot.products[0].discountPercent,undefined);
});
test('el personal lee la carta pero no cambia precios o categorías',async()=>{
 const db=new DB();await prepararAltaCatalogoRomoQA({db,identity:owner,snapshot:snapshot()});
 const r=router(db,worker);
 assert.equal((await r.execute(req('read'))).revision,1);
 const before=db.queries.length;
 await assert.rejects(r.execute(change('discount','productos','editar-descuento',{
  sku:'dish:romo-gohan',expectedRevision:1,expectedVersion:1,discountPercent:50
 })),/rol no tiene permiso/);
 assert.equal(db.queries.length,before,'denegado antes de la base');
});
test('no acepta suplantación de sucursal o rol desde el navegador',async()=>{
 const db=new DB();const r=router(db);
 const before=db.queries.length;
 for(const payload of [
  {area:'productos',action:'editar-descuento',data:{identity:owner,sku:'dish:romo-gohan',expectedRevision:1,expectedVersion:1,discountPercent:10}},
  {area:'productos',action:'editar-descuento',data:{brand:'uki',sku:'dish:romo-gohan',expectedRevision:1,expectedVersion:1,discountPercent:10}},
  {area:'productos',action:'editar-descuento',data:{storeId:'uki:serena',sku:'dish:romo-gohan',expectedRevision:1,expectedVersion:1,discountPercent:10}}
 ])await assert.rejects(r.execute(req('discount',payload)),/Formulario no autorizado/);
 await assert.rejects(r.execute({storeId:'romo:arica',area:'catalog',action:'read'}),/Sucursal no reconocida/);
 assert.equal(db.queries.length,before);
});
