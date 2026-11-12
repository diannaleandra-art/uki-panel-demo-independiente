import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRomoCatalog,normalizeRomoCatalog,publicRomoCatalog,readRomoCatalog,saveRomoCatalog,RomoCatalogConflict}
 from '../lib/romo-catalogo-integracion-qa.mjs';
import {reportRomoInventory} from '../lib/romo-inventario-modelo-qa.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const endpoint=require('../api/romo-catalogo-qa.js');
const owner={userId:'owner_qa',brand:'romo',role:'duenos',branches:['serena']};
const worker={userId:'worker_qa',brand:'romo',role:'inventario',branches:['serena']};
const example=()=>({
 ...emptyRomoCatalog(),
 productos:[{sku:'romo:gohan',kind:'gohan',name:'Gohan clásico',price:6000,visible:true,available:true}],
 promociones:[{sku:'romo:24',kind:'sushi',name:'24 piezas + korokes',description:'2 rolls y korokes',price:7000,visible:true,
  available:true,pieces:24,rollCount:2,piecesPerRoll:12,sauceCount:1,korokes:2}],
 ingredientes:[{sku:'romo:palta',kind:'vegetal',name:'Palta',price:0,available:true,visible:true}]
});
test('catálogo Romo vacío es explícito y no inventa precios',()=>{
 const empty=normalizeRomoCatalog(emptyRomoCatalog());
 assert.equal(empty.productos.length,0);
 assert.equal(empty.promociones.length,0);
 assert.equal(empty.ingredientes.length,0);
});
test('Romo tiene productos, promociones e ingredientes propios sin pizze ni Uki',()=>{
 const catalog=normalizeRomoCatalog(example());
 assert.equal(catalog.promociones[0].pieces,24);
 assert.equal(publicRomoCatalog(catalog).ingredientes.length,1);
 assert.throws(()=>normalizeRomoCatalog({...example(),sucursal:'uki:serena'}));
 const pizza=example();pizza.productos.push({sku:'romo:pizza',kind:'pizza',name:'Pizza',price:6000});
 assert.throws(()=>normalizeRomoCatalog(pizza));
 const cross=example();cross.productos[0].sku='uki:gohan';
 assert.throws(()=>normalizeRomoCatalog(cross));
});
test('precios, códigos y composición inválida se rechazan, no se ajustan automáticamente $500',()=>{
 const price=example();price.promociones[0].price=-1;
 assert.throws(()=>normalizeRomoCatalog(price));
 const mixed=example();mixed.ingredientes[0].sku='romo:24';
 assert.throws(()=>normalizeRomoCatalog(mixed));
 const rolls=example();rolls.promociones[0].pieces=60;
 assert.throws(()=>normalizeRomoCatalog(rolls));
});
test('público muestra sólo activos y visibles; administración ve borradores',()=>{
 const draft=example();draft.promociones[0].visible=false;
 assert.equal(normalizeRomoCatalog(draft).promociones.length,1);
 assert.equal(publicRomoCatalog(draft).promociones.length,0);
 draft.productos[0].available=false;
 assert.equal(publicRomoCatalog(draft).productos.length,0);
});
test('lectura scoped y control por roles',async()=>{
 const db={query:async(sql,params)=>{assert.match(sql,/public\.romo_catalogo_v1/);assert.deepEqual(params,['romo:serena']);return []}};
 const r=await readRomoCatalog({db,identity:worker});
 assert.equal(r.revision,0);
 await assert.rejects(readRomoCatalog({db,identity:{...worker,brand:'uki'}}));
 await assert.rejects(saveRomoCatalog({db,identity:worker,expectedRevision:0,catalog:example()}));
});
test('guardado futuro sólo dueños y CAS: dos equipos no sobrescriben revisión',async()=>{
 let current=0;
 const db={query:async(sql,params)=>{
  if(sql.startsWith('INSERT')){if(current!==0)return [];current=1;return [{revision:current}];}
  if(sql.startsWith('UPDATE')){if(params[1]!==current)return [];current++;return [{revision:current}];}
  return [{revision:current,contenido:example()}];
 }};
 const first=await saveRomoCatalog({db,identity:owner,expectedRevision:0,catalog:example()});
 assert.equal(first.revision,1);
 await assert.rejects(saveRomoCatalog({db,identity:owner,expectedRevision:0,catalog:example()}),RomoCatalogConflict);
 assert.equal((await saveRomoCatalog({db,identity:owner,expectedRevision:1,catalog:example()})).revision,2);
 await assert.rejects(saveRomoCatalog({db,identity:owner,expectedRevision:1,catalog:example()}),RomoCatalogConflict);
});
test('inventario se calcula sólo para romo:serena, sin inventar consumos',()=>{
 const items=reportRomoInventory('romo:serena',[{id:'arroz',name:'Arroz',unit:'kg',recibido:10,hay:7,minimo:8}]);
 assert.equal(items[0].diferencia,3);assert.equal(items[0].reponer,1);
 assert.throws(()=>reportRomoInventory('uki:serena',[]));
});
test('endpoint por defecto cerrado, sin POST ni operaciones contra Neon',async()=>{
 const old={VERCEL_ENV:process.env.VERCEL_ENV,ROMO_CATALOGO_QA_ENABLED:process.env.ROMO_CATALOGO_QA_ENABLED};
 try{
  process.env.VERCEL_ENV='production';process.env.ROMO_CATALOGO_QA_ENABLED='true';
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await endpoint({method:'POST',headers:{origin:'https://invalid.example'}},res);
  assert.equal(res.code,503);assert.equal(res.body.ok,false);
 }finally{
  for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});

test('fotografías originales: sólo IDs de Romo, sin rutas o enlaces externos',()=>{
 const candidate=example();candidate.promociones[0].photoId='promo-foto-2';
 const normalized=normalizeRomoCatalog(candidate);
 assert.equal(normalized.promociones[0].photoId,'promo-foto-2');
 candidate.promociones[0].photoId='../uki-sushi-local.html';
 assert.throws(()=>normalizeRomoCatalog(candidate),/Fotografía/);
 candidate.promociones[0].photoId='https://example.org/p.jpg';
 assert.throws(()=>normalizeRomoCatalog(candidate),/Fotografía/);
});
