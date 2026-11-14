import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 prepararDisponibilidadRomoCartaQA,
 guardarDisponibilidadRomoCartaQA,
 RomoDisponibilidadCartaConflictoQA
} from '../lib/romo-disponibilidad-carta-qa.mjs';
import {validateRomoInventory} from '../lib/romo-inventario-qa.mjs';
import {conciliarInventarioCartaRomoQA}
 from '../lib/romo-inventario-carta-qa.mjs';
const STORE='romo:serena',owner={userId:'ownerQA',brand:'romo',
 role:'duenos',branches:['serena']};
const sku='romo:proteina-pollo',id='inventario_pollo';
const material=(extra={})=>({
 sku:id,name:'Pollo',kind:'ingrediente',stock_unit:'kg',
 stock_qty:3.5,min_stock_qty:1,available:true,archived:false,
 carta_sku:sku,...extra
});
const inv=()=>({version:1,items:[material(),
 {sku:'envase_carton',name:'Caja cartón',kind:'envase',stock_unit:'un',
  stock_qty:20,min_stock_qty:4,available:true,archived:false}],movimientos:[]});
const cat=()=>({storeId:STORE,revision:4,products:[{name:'Promo 24',price:7000,
  visible:true}],promotions:[{name:'24 y korokes',price:7000}],
 ingredients:[
  {sku,name:'Pollo',visible:false,available:true,surcharge:0},
  {sku:'romo:vegetal-palta',name:'Palta',visible:true,available:true,surcharge:800}
 ]});
const args={sku:id,available:false,expectedCatalogRevision:4,confirmado:true};
const prepare=(i=inv(),c=cat(),other={})=>
 prepararDisponibilidadRomoCartaQA(i,c,{
  identity:owner,sku:id,available:false,expectedCatalogRevision:4,
  ahoraMs:Date.now(),...other
 });
test('vínculo explícito cambia solo available en dos snapshots, preserva precios y stock',()=>{
 const i=inv(),c=cat(),oldI=structuredClone(i),oldC=structuredClone(c);
 const x=prepare(i,c);
 assert.equal(x.inventario.items[0].available,false);
 assert.equal(x.catalogo.ingredients[0].available,false);
 assert.equal(x.catalogo.revision,5);
 assert.equal(x.inventario.items[0].stock_qty,3.5);
 assert.deepEqual(x.catalogo.products,c.products);
 assert.deepEqual(x.catalogo.promotions,c.promotions);
 assert.deepEqual(x.catalogo.ingredients[1],c.ingredients[1]);
 assert.equal(x.catalogo.ingredients[0].visible,false);
 assert.equal(x.catalogo.ingredients[0].surcharge,0);
 assert.equal(x.modificaPrecios,false);
 assert.equal(x.modificaStock,false);
 assert.equal(x.modificaVisibilidad,false);
 assert.deepEqual(i,oldI);assert.deepEqual(c,oldC);
 assert.equal(x.inventario.movimientos[0].tipo,'disponibilidad_carta');
 assert.equal(x.inventario.movimientos[0].actor,owner.userId);
 assert.equal(x.inventario.movimientos[0].disponibleCartaAnterior,true);
 assert.equal(x.inventario.movimientos[0].disponibleCartaNuevo,false);
 assert.equal(validateRomoInventory(x.inventario),x.inventario);
});
test('la conciliación refleja disponibilidad confirmada sin fusionar catálogo e inventario',()=>{
 const x=prepare();
 const report=conciliarInventarioCartaRomoQA(x.catalogo,x.inventario,{revisionInventario:7});
 assert.equal(report.filas[0].estado,'coincide');
 assert.equal(report.filas[0].disponibleInventario,false);
 assert.equal(report.filas[0].disponibleCarta,false);
 assert.equal(report.filas[1].estado,'sin_vinculo');
});
test('no actualiza inventario ni catálogo de otra marca o sucursal',()=>{
 assert.throws(()=>prepare(inv(),{...cat(),storeId:'uki:serena'}),/Carta Romo/);
 for(const identity of [{...owner,brand:'uki'},
  {...owner,role:'agendador'}, {...owner,role:'inventario'}])
  assert.throws(()=>prepare(inv(),cat(),{identity}),/permiso|identidad|Romo/i);
});
test('sin vínculo, archivado, envase, SKU repetido: nunca sincronizar',()=>{
 for(const value of [
  inv(),inv(),inv(),inv()
 ]){
  if(value===null)throw Error('fixture');
 }
 const noLink=inv();delete noLink.items[0].carta_sku;
 const archived=inv();archived.items[0].archived=true;
 const envase=inv();envase.items[0].kind='envase';
 const duplicated=inv();duplicated.items.push({...material(),sku:'otro_pollo'});
 for(const s of [noLink,archived,envase,duplicated])
  assert.throws(()=>prepare(s,cat()),/vínculo|ingrediente|archivado|más de un vínculo/);
});
test('no se cambia por stock 0 ni se confunde falta de stock con disponibilidad',()=>{
 const low=inv();low.items[0].stock_qty=0;
 const next=prepare(low,cat());
 assert.equal(next.inventario.items[0].stock_qty,0);
 assert.equal(next.inventario.items[0].available,false);
 assert.equal(next.catalogo.ingredients[0].available,false);
 assert.equal(low.items[0].available,true);
});
test('se puede volver a disponible sin tocar cantidades ni precios',()=>{
 const original=prepare();
 const next=prepararDisponibilidadRomoCartaQA(original.inventario,original.catalogo,{
  identity:owner,sku:id,available:true,expectedCatalogRevision:5,ahoraMs:Date.now()
 });
 assert.equal(next.catalogo.ingredients[0].available,true);
 assert.equal(next.inventario.items[0].available,true);
 assert.equal(next.inventario.movimientos.length,2);
 assert.equal(next.catalogo.revision,6);
});
test('evita repetir el mismo estado o confundir revisiones',()=>{
 assert.throws(()=>prepare(inv(),cat(),{available:true}),/ya coincide/);
 assert.throws(()=>prepare(inv(),cat(),{expectedCatalogRevision:3}),/revisión/);
 const c=cat();c.ingredients.push({...c.ingredients[0]});
 assert.throws(()=>prepare(inv(),c),/repetidos/);
 const missing=cat();missing.ingredients=missing.ingredients.slice(1);
 assert.throws(()=>prepare(inv(),missing),/inexistente/);
});
function dbMock(){
 let inventory=inv(),catalog=cat(),revInv=2,revCat=4,writes=0;
 const calls=[];
 const db={async query(sql,params){
  calls.push({sql,params});
  assert.equal(params[0],STORE);
  if(sql.startsWith('SELECT revision,contenido FROM public.romo_inventario_v1'))
   return [{revision:revInv,contenido:inventory}];
  if(sql.startsWith('SELECT revision,contenido FROM public.romo_catalogo_v1'))
   return [{revision:revCat,contenido:catalog}];
  if(sql.startsWith('WITH old_inventory AS MATERIALIZED')){
   assert.match(sql,/FOR UPDATE/);
   assert.match(sql,/save_inventory AS/);
   assert.match(sql,/save_catalog AS/);
   assert.match(sql,/CROSS JOIN save_catalog/);
   if(params[1]!==revInv||params[2]!==revCat||
     JSON.stringify(JSON.parse(params[3]))!==JSON.stringify(inventory)||
     JSON.stringify(JSON.parse(params[4]))!==JSON.stringify(catalog))
    return [];
   inventory=JSON.parse(params[5]);catalog=JSON.parse(params[6]);
   revInv++;revCat++;writes++;
   return [{inventario_revision:revInv,catalogo_revision:revCat}];
  }
  throw Error('SQL inesperado: '+sql);
 }};
 return {db,calls,
  values:()=>({inventory,catalog,revInv,revCat,writes}),
  changeCatalogRevision(n){revCat=n}};
}
test('persistencia con revisiones CAS sincroniza dos tablas en una sentencia',async()=>{
 const m=dbMock();
 const r=await guardarDisponibilidadRomoCartaQA({
  db:m.db,identity:owner,expectedRevision:2,args,ahoraMs:Date.now()
 });
 assert.equal(r.atomic,true);assert.equal(r.revision,3);
 assert.equal(r.catalogoRevision,5);
 assert.equal(m.values().writes,1);
 assert.equal(m.values().inventory.items[0].available,false);
 assert.equal(m.values().catalog.ingredients[0].available,false);
 assert.equal(m.values().catalog.promotions[0].price,7000);
 assert.equal(m.calls.filter(x=>x.sql.startsWith('WITH old_inventory')).length,1);
 await assert.rejects(guardarDisponibilidadRomoCartaQA({
  db:m.db,identity:owner,expectedRevision:2,args
 }));
 assert.equal(m.values().writes,1);
});
test('cambio simultáneo de Carta bloquea sincronización completa y evita medio guardado',async()=>{
 const m=dbMock();
 const interception={async query(sql,params){
  if(sql.startsWith('WITH old_inventory AS MATERIALIZED'))
   m.changeCatalogRevision(5);
  return m.db.query(sql,params);
 }};
 await assert.rejects(guardarDisponibilidadRomoCartaQA({
  db:interception,identity:owner,expectedRevision:2,args
 }),e=>e instanceof RomoDisponibilidadCartaConflictoQA);
 assert.equal(m.values().writes,0);
 assert.equal(m.values().inventory.items[0].available,true);
 assert.equal(m.values().catalog.ingredients[0].available,true);
});
test('sin confirmación, SKU o permiso nunca intenta escribir',async()=>{
 const m=dbMock(),bad=[
  {...args,confirmado:false},
  {...args,sku:'otro'},
  {...args,available:1},
  {...args,expectedCatalogRevision:3}
 ];
 for(const data of bad)await assert.rejects(guardarDisponibilidadRomoCartaQA({
  db:m.db,identity:owner,expectedRevision:2,args:data
 }));
 await assert.rejects(guardarDisponibilidadRomoCartaQA({
  db:m.db,identity:{...owner,role:'agendador'},
  expectedRevision:2,args
 }));
 assert.equal(m.values().writes,0);
});
test('la API restringe sincronización a Romo QA sin habilitar ventas públicas',()=>{
 const api=readFileSync(new URL('../api/romo-inventario-qa.js',import.meta.url),'utf8');
 assert.match(api,/const disponibilidadCarta=body\.action==='disponibilidad_carta'/);
 assert.match(api,/if\(\(enlace\|\|disponibilidadCarta\)&&mode!=='qa'\)/);
 assert.match(api,/guardarDisponibilidadRomoCartaQA/);
 assert.match(api,/resolveRomoIdentity/);
 const source=readFileSync(new URL('../lib/romo-disponibilidad-carta-qa.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/public\.uki_|fin_movimientos|UPDATE public\.uki_/i);
 assert.match(source,/authorizeRomoOperation\(identity,'romo','serena','catalog.write'\)/);
 const pub=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(pub,/if\(config\.qaOnly\)return fail\(res,403/);
});
test('solo dos botones separados e identificación de revisión en pantalla de Romo',()=>{
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const preview=readFileSync(new URL('../public/romo-qa/uki-sushi-local.html',import.meta.url),'utf8');
 assert.equal(html,preview);
 assert.match(html,/const disponibilidadCartaHTML=vinculadoCarta/);
 assert.match(html,/disponibilidad_carta&quot;/);
 assert.match(html,/en Inventario y Carta \(dueños\)/);
 assert.match(html,/solo inventario<\/button>/);
 assert.match(html,/action==='disponibilidad_carta'/);
 assert.match(html,/args\.expectedCatalogRevision=reporte\.catalogoRevision/);
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
});
