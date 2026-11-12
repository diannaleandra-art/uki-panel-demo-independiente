import test from 'node:test';
import assert from 'node:assert/strict';
import {crearRouterAlmacenamientoQA,crearMemoriaLocalQA}
 from '../lib/uki-local-router-qa.mjs';
import {crearAlmacenamientoUnicoRomoQA}
 from '../lib/romo-almacenamiento-unico-panel-qa.mjs';

const owner={userId:'duenos_qa',brand:'romo',role:'duenos',branches:['serena']};
const worker={userId:'trabajador_qa',brand:'romo',role:'inventario',branches:['serena']};
const req=(area,action,payload=null,storeId='romo:serena')=>
 ({storeId,area,action,fechaOperativa:null,payload});
function dbMock(){
 const calls=[],stored={};
 return {
  calls,
  async query(sql,args){
   calls.push({sql,args});
   assert.match(sql,/public\.romo_(?:catalogo|estado_operativo|inventario)_v1/);
   assert.equal(args[0],'romo:serena');
   const type=sql.includes('romo_inventario_v1')?'inventory':
    sql.includes('romo_catalogo_v1')?'catalog':'operativo';
   if(sql.startsWith('SELECT')){
    return stored[type]?[{revision:stored[type].revision,
     ...(type==='inventory'?{contenido:stored[type].document}:
      type==='catalog'?{contenido:stored[type].document}:
      {snapshot:stored[type].document})}]:[];
   }
   if(sql.startsWith('INSERT')){
    if(stored[type])return [];
    stored[type]={revision:1,document:JSON.parse(args[1])};
    return [{revision:1}];
   }
   if(sql.startsWith('UPDATE')){
    if(stored[type]?.revision!==args[1])return [];
    const revision=stored[type].revision+1;
    stored[type]={revision,document:JSON.parse(args[2])};
    return [{revision}];
   }
   throw Error('Consulta no autorizada');
  }
 };
}
const router=(db,identity=owner)=>crearRouterAlmacenamientoQA({
 qaOnly:true,adapters:{
  'uki:arica':crearMemoriaLocalQA('uki:arica'),
  'uki:serena':crearMemoriaLocalQA('uki:serena'),
  'romo:serena':crearAlmacenamientoUnicoRomoQA({db,identity})
 }
});
test('un solo acceso del panel dirige operativo, carta e inventario a la base Romo',async()=>{
 const db=dbMock(),panel=router(db);
 const estado=await panel.execute(req('operativo','read'));
 const carta=await panel.execute(req('catalog','read'));
 const inv=await panel.execute(req('inventory','read'));
 assert.equal(estado.storeId,'romo:serena');
 assert.equal(estado.revision,0);
 assert.equal(estado.snapshot,null);
 assert.equal(carta.storeId,'romo:serena');
 assert.equal(carta.revision,0);
 assert.equal(carta.snapshot,null);
 assert.equal(inv.storeId,'romo:serena');
 assert.equal(inv.revision,0);
 assert.deepEqual(inv.inventory.items,[]);
 assert.equal(db.calls.length,3);
 assert.ok(db.calls.every(x=>x.sql.startsWith('SELECT ')&&x.args[0]==='romo:serena'));
});
test('corregir inventario Romo no toca carta, pedidos ni el inventario de Uki',async()=>{
 const db=dbMock(),panel=router(db);
 const item={id:'salsa',name:'Salsa',unit:'l',recibido:2,hay:1,minimo:3,disponible:true};
 const save=await panel.execute(req('inventory','create',{expectedRevision:0,item}));
 assert.equal(save.revision,1);
 assert.equal((await panel.execute(req('inventory','read'))).inventory.items.length,1);
 assert.equal((await panel.execute(req('catalog','read'))).revision,0);
 assert.equal((await panel.execute(req('operativo','read'))).revision,0);
 for(const storeId of ['uki:serena','uki:arica']){
  const other=await panel.execute(req('inventory','read',null,storeId));
  assert.equal(other.entries.length,0);
 }
});
test('no existe desvío automático de caja/timbres/clientes ni Romo Regimiento',async()=>{
 const db=dbMock(),panel=router(db);
 for(const area of ['cash','stamps','orders','owners']){
  await assert.rejects(panel.execute(req(area,'read')),/no tiene permiso/);
 }
 await assert.rejects(panel.execute(req('inventory','read',null,'romo:arica')),/Sucursal no reconocida/);
 assert.equal(db.calls.length,0);
});
test('trabajador inventario no puede leer el estado cifrado de caja ni cambiar carta',async()=>{
 const db=dbMock(),panel=router(db,worker);
 assert.equal((await panel.execute(req('inventory','read'))).storeId,'romo:serena');
 assert.equal((await panel.execute(req('catalog','read'))).storeId,'romo:serena');
 await assert.rejects(panel.execute(req('operativo','read')),/permiso/i);
 assert.equal(db.calls.length,2,'rechazo antes de consultar el estado operativo');
});
test('identidad no puede venir de otro local o dos sucursales',()=>{
 const db=dbMock();
 for(const identity of [
  {...owner,brand:'uki'},
  {...owner,branches:['arica']},
  {...owner,branches:['serena','arica']}
 ]){
  assert.throws(()=>crearAlmacenamientoUnicoRomoQA({db,identity}),/sesión Romo/);
 }
 assert.equal(db.calls.length,0);
});
