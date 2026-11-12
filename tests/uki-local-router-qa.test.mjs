import test from 'node:test';
import assert from 'node:assert/strict';
import {
 PANEL_LOCAL_ROUTER_QA_ONLY,STORES_QA,localPanelDescriptorQA,localOperationPlanQA,
 crearRouterAlmacenamientoQA,crearMemoriaLocalQA
} from '../lib/uki-local-router-qa.mjs';

const date='2026-11-12';
const request=(storeId,area,action,payload=null,fechaOperativa=date)=>
 ({storeId,area,action,payload,fechaOperativa});
const demo=(key)=>({fixtureQA:true,key});

test('misma aplicación; tres identificadores distintos y ningún Romo Arica',()=>{
 assert.equal(PANEL_LOCAL_ROUTER_QA_ONLY,true);
 assert.deepEqual(Object.keys(STORES_QA),['uki:arica','uki:serena','romo:serena']);
 assert.equal(localPanelDescriptorQA('uki:arica').name,'Uki Regimiento Arica');
 assert.equal(localPanelDescriptorQA('uki:serena').name,'Uki La Serena');
 assert.equal(localPanelDescriptorQA('romo:serena').name,'Romo’s Sushi La Serena');
 for(const value of ['arica','serena','romo:arica','uki:romo','Romo’s Sushi La Serena','']) 
  assert.throws(()=>localPanelDescriptorQA(value),/Sucursal no reconocida/);
});
test('cada función conserva sucursal/área y nunca cambia Romo por Arica',()=>{
 for(const area of ['catalog','inventory','orders','cash','stamps','owners']){
  const action='read';
  const p=localOperationPlanQA({storeId:'romo:serena',area,action,fechaOperativa:date});
  assert.equal(p.backend,'romo-neon-independiente');
  assert.equal(p.live,false);
  assert.equal(p.storeId,'romo:serena');
  assert.equal(p.branch,'serena');
  assert.equal(p.mode,'read');
  assert.equal(localOperationPlanQA({storeId:'uki:arica',area,action}).backend,'uki-existente');
  assert.equal(localOperationPlanQA({storeId:'uki:serena',area,action}).backend,'uki-existente');
 }
 assert.equal(localOperationPlanQA({storeId:'romo:serena',area:'orders',action:'accept'}).mode,'write');
 assert.equal(localOperationPlanQA({storeId:'romo:serena',area:'cash',action:'close'}).mode,'write');
 assert.equal(localOperationPlanQA({storeId:'romo:serena',area:'stamps',action:'send'}).mode,'write');
 assert.throws(()=>localOperationPlanQA({storeId:'romo:serena',area:'inventario',action:'read'}));
 assert.throws(()=>localOperationPlanQA({storeId:'romo:serena',area:'orders',action:'delete-all'}));
 assert.throws(()=>localOperationPlanQA({storeId:'romo:serena',area:'orders',action:'read',fechaOperativa:'2026-02-30'}));
});
test('sin backend propio Romo no puede leer ni escribir datos de Uki',async()=>{
 const ukiArica=crearMemoriaLocalQA('uki:arica');
 const ukiSerena=crearMemoriaLocalQA('uki:serena');
 const router=crearRouterAlmacenamientoQA({
  qaOnly:true,adapters:{'uki:arica':ukiArica,'uki:serena':ukiSerena}
 });
 const r=await router.execute(request('uki:arica','orders','receive',demo('uka_pedido1')));
 assert.equal(r.storeId,'uki:arica');
 await assert.rejects(router.execute(request('romo:serena','orders','read')),/no conectados/);
 await assert.rejects(router.execute(request('romo:serena','cash','record',demo('romo_caja1'))),/no conectados/);
 const b=await router.execute(request('uki:serena','orders','read'));
 assert.equal(b.entries.length,0);
});
test('sucursal Romo completa con datos ficticios, aislada de dos Uki',async()=>{
 const services=Object.fromEntries(Object.keys(STORES_QA).map(id=>[id,crearMemoriaLocalQA(id)]));
 const router=crearRouterAlmacenamientoQA({qaOnly:true,adapters:services});
 const flows=[
  ['catalog','create','romo_promo24'],
  ['inventory','count','romo_palta'],
  ['orders','receive','romo_pedido1'],
  ['orders','accept','romo_pedido2'],
  ['cash','record','romo_caja1'],
  ['stamps','send','romo_timbre1'],
  ['owners','record','romo_cierre1']
 ];
 for(const [area,action,key] of flows){
  const result=await router.execute(request('romo:serena',area,action,demo(key)));
  assert.equal(result.storeId,'romo:serena');
  const read=await router.execute(request('romo:serena',area,'read'));
  assert.ok(read.entries.some(x=>x.key===key));
 }
 for(const id of ['uki:arica','uki:serena']){
  for(const area of ['catalog','inventory','orders','cash','stamps','owners']){
   const r=await router.execute(request(id,area,'read'));
   assert.equal(r.entries.length,0,id+' '+area);
  }
 }
});
test('dos dispositivos visualizan el mismo Romo, sin duplicar en los Uki',async()=>{
 const shared=crearMemoriaLocalQA('romo:serena');
 const arica=crearMemoriaLocalQA('uki:arica');
 const movilA=crearRouterAlmacenamientoQA({qaOnly:true,adapters:{
  'romo:serena':shared,'uki:arica':arica
 }});
 const movilB=crearRouterAlmacenamientoQA({qaOnly:true,adapters:{'romo:serena':shared}});
 await movilA.execute(request('romo:serena','orders','receive',demo('solicitud_123')));
 const result=await movilB.execute(request('romo:serena','orders','read'));
 assert.equal(result.entries.length,1);
 assert.equal(result.entries[0].key,'solicitud_123');
 assert.equal((await movilA.execute(request('uki:arica','orders','read'))).entries.length,0);
 assert.equal(result.storeId,'romo:serena');
});
test('nunca se acepta un adaptador de otro local como Romo',async()=>{
 const ukiArica=crearMemoriaLocalQA('uki:arica');
 assert.throws(()=>crearRouterAlmacenamientoQA({qaOnly:true,adapters:{'romo:serena':ukiArica}}),/no coincide/);
 assert.throws(()=>crearRouterAlmacenamientoQA({qaOnly:false,adapters:{}}),/solo autorizado/);
 const rogue={...crearMemoriaLocalQA('romo:serena'),read:async()=>({storeId:'uki:arica',entries:['secreto']})};
 const router=crearRouterAlmacenamientoQA({qaOnly:true,adapters:{'romo:serena':rogue}});
 await assert.rejects(router.execute(request('romo:serena','orders','read')),/otra sucursal/);
});
test('peticiones de prueba no contienen datos reales y la respuesta se copia',async()=>{
 const backend=crearMemoriaLocalQA('romo:serena');
 const router=crearRouterAlmacenamientoQA({qaOnly:true,adapters:{'romo:serena':backend}});
 await assert.rejects(router.execute(request('romo:serena','orders','receive',{key:'cliente_real',whatsapp:'+56912345678'})),/Sólo datos de prueba/);
 await router.execute(request('romo:serena','orders','receive',demo('pedido_demo')));
 const one=await router.execute(request('romo:serena','orders','read'));
 one.entries[0].key='otro_local';
 const two=await router.execute(request('romo:serena','orders','read'));
 assert.equal(two.entries[0].key,'pedido_demo');
});
