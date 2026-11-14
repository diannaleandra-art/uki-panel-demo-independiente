import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRomoInventory,emptyRomoInventory,
 RomoInventarioRevisionConflicto} from '../lib/romo-inventario-qa.mjs';
import {prepararVinculoInventarioCartaRomoQA,
 guardarVinculoInventarioCartaRomoQA}
 from '../lib/romo-enlace-inventario-carta-qa.mjs';
import {conciliarInventarioCartaRomoQA}
 from '../lib/romo-inventario-carta-qa.mjs';

const STORE='romo:serena',owner={userId:'owner-qa',role:'duenos',
 brand:'romo',branches:['serena']};
const stock=(carta_sku)=>({
 sku:'inventario_pollo',name:'Pollo',kind:'ingrediente',
 stock_unit:'kg',stock_qty:2.5,min_stock_qty:0.5,
 available:true,archived:false,
 ...(carta_sku?{carta_sku}:{})
});
const inventory=(items=[stock()])=>({version:1,items,movimientos:[]});
const catalog=()=>({storeId:STORE,revision:1,ingredients:[
 {sku:'romo:proteina-pollo',name:'Pollo',available:true,visible:true},
 {sku:'romo:proteina-kanicama',name:'Kanicama',available:true,visible:true}
]});
const link=()=>({sku:'inventario_pollo',carta_sku:'romo:proteina-pollo',
 catalogoRevision:1,confirmado:true});
const unlink=()=>({sku:'inventario_pollo',confirmado:true,
 motivo:'Asociación equivocada'});
const exec=(st=inventory(),a='vincular_carta',args=link())=>
 prepararVinculoInventarioCartaRomoQA(st,{identity:owner,
  action:a,args,catalogo:a==='vincular_carta'?catalog():null,
  ahoraMs:Date.now()});

test('enlace exacto conserva existencias, precios, nombre y disponibilidad de carta',()=>{
 const before=inventory(),original=structuredClone(before),c=catalog();
 const r=exec(before);
 assert.equal(r.state.items[0].carta_sku,'romo:proteina-pollo');
 assert.equal(r.state.items[0].stock_qty,2.5);
 assert.equal(r.state.items[0].available,true);
 assert.equal(c.ingredients[0].available,true);
 assert.equal(r.change.actor,'owner-qa');
 assert.equal(r.state.movimientos[0].tipo,'vincular_carta');
 assert.equal(r.state.movimientos[0].antes.carta_sku,undefined);
 assert.equal(r.state.movimientos[0].despues.carta_sku,'romo:proteina-pollo');
 assert.deepEqual(before,original);
 assert.equal(validateRomoInventory(r.state),r.state);
 const report=conciliarInventarioCartaRomoQA(c,r.state,{revisionInventario:1});
 assert.equal(report.coinciden,1);
 assert.equal(report.sinVinculo,1);
 assert.equal(report.modificaCarta,false);
});
test('sugerir nombre igual no crea el vínculo automáticamente',()=>{
 const s=inventory(),r=conciliarInventarioCartaRomoQA(catalog(),s);
 assert.equal(r.filas[0].sugerenciaSku,'inventario_pollo');
 assert.equal(r.filas[0].vinculado,false);
 assert.equal(s.items[0].carta_sku,undefined);
});
test('vincular ingrediente inexistente, de Uki o con revisión vencida es imposible',()=>{
 for(const args of [
  {...link(),carta_sku:'romo:proteina-inventada'},
  {...link(),carta_sku:'uki:proteina-pollo'},
  {...link(),catalogoRevision:0},
  {...link(),confirmado:false},
  {...link(),confirmado:undefined}
 ])assert.throws(()=>exec(inventory(),'vincular_carta',args));
});
test('impedir que el mismo artículo se vincule dos veces o cambie sin desvincular',()=>{
 const old=inventory([stock('romo:proteina-pollo')]);
 assert.throws(()=>exec(old));
 const twin=inventory([
  stock(),
  { ...stock('romo:proteina-pollo'),sku:'inventario_otro' }
 ]);
 assert.throws(()=>exec(twin),/ya está vinculado/);
});
test('solo dueños de Romo pueden vincular; envases y archivados no son ingredientes activos',()=>{
 for(const identity of [
  {...owner,brand:'uki'},{...owner,role:'agendador'},
  {...owner,role:'inventario'}
 ])assert.throws(()=>prepararVinculoInventarioCartaRomoQA(inventory(),{
  identity,action:'vincular_carta',args:link(),catalogo:catalog()
 }));
 for(const x of [
  {...stock(),kind:'envase'},
  {...stock(),archived:true}
 ])assert.throws(()=>exec(inventory([x])));
});
test('desvincular conserva producto, historial y motivo sin afectar carta',()=>{
 const before=inventory([stock('romo:proteina-pollo')]);
 const r=exec(before,'desvincular_carta',unlink());
 assert.equal(r.state.items.length,1);
 assert.equal(r.state.items[0].carta_sku,undefined);
 assert.equal(r.state.items[0].available,true);
 assert.equal(r.state.movimientos[0].motivo,'Asociación equivocada');
 assert.equal(r.state.movimientos[0].antes.carta_sku,'romo:proteina-pollo');
 assert.equal(before.items[0].carta_sku,'romo:proteina-pollo');
 assert.equal(r.change.cartaSku,null);
});
test('no permite desvincular sin motivo o desvincular inexistente',()=>{
 assert.throws(()=>exec(inventory(),'desvincular_carta',unlink()));
 for(const motivo of ['', 'NO', '  ', 'x'.repeat(170)])
  assert.throws(()=>exec(inventory([stock('romo:proteina-pollo')]),
   'desvincular_carta',{...unlink(),motivo}));
});
test('los códigos de enlace de inventario inválidos no pasan validación',()=>{
 for(const carta_sku of ['uki:pollo','romo:',42,'romo:pollo con espacios'])
  assert.throws(()=>validateRomoInventory(inventory([stock(carta_sku)])));
});
function mem(){
 let revision=0,contenido=emptyRomoInventory(),catalogoRevision=1,writes=0;
 return {db:{async query(sql,args){
  assert.equal(args[0],STORE);
  if(sql.startsWith('SELECT revision,contenido FROM public.romo_inventario_v1'))
   return revision?[{revision,contenido}]:[];
  if(sql.startsWith('SELECT revision,contenido FROM public.romo_catalogo_v1'))
   return [{revision:catalogoRevision,contenido:catalog()}];
  if(sql.startsWith('INSERT INTO public.romo_inventario_v1')){
   writes++;
   assert.match(sql,/ON CONFLICT \(store_id\) DO UPDATE/);
   assert.match(sql,/WHERE v\.revision=\$5 RETURNING revision/);
   if(args[4]!==revision)return [];
   if(args.length===7){
    assert.match(sql,/WHERE c\.store_id=\$1 AND c\.revision=\$6/);
    assert.match(sql,/jsonb_array_elements\(c\.contenido->'ingredients'\)/);
    if(args[5]!==catalogoRevision||!catalog().ingredients.some(x=>x.sku===args[6]))
     return [];
   }
   revision=args[1];contenido=JSON.parse(args[2]);
   return [{revision}];
  }
  throw Error('SQL inesperado: '+sql);
 }},values:()=>({revision,contenido,writes}),
 setCatalogRevision:x=>{catalogoRevision=x}};
}
test('servidor valida revisiones de Carta y Neon antes de escribir; reintento no duplica',async()=>{
 const m=mem();
 const first=await guardarVinculoInventarioCartaRomoQA({
  db:m.db,identity:owner,expectedRevision:0,action:'vincular_carta',
  args:{sku:'inventario_pollo',...link()}
 }).catch(e=>e);
 // Sin artículo no se inventa inventario.
 assert(first instanceof Error);
 assert.equal(m.values().writes,0);
});
test('persistencia CAS de vínculo y desvínculo, sin duplicar movimientos',async()=>{
 const m=mem();
 // El inventario inicial se crea usando su controlador habitual.
 const {guardarOperacionInventarioRomoQA}=await import('../lib/romo-inventario-qa.mjs');
 const add=await guardarOperacionInventarioRomoQA({
  db:m.db,identity:owner,expectedRevision:0,action:'alta',
  args:stock(),ahoraMs:Date.now()
 });
 assert.equal(add.revision,1);
 const r=await guardarVinculoInventarioCartaRomoQA({
  db:m.db,identity:owner,expectedRevision:1,action:'vincular_carta',
  args:link(),ahoraMs:Date.now()
 });
 assert.equal(r.revision,2);
 assert.equal(r.modificaCarta,false);
 assert.equal(m.values().contenido.items[0].carta_sku,'romo:proteina-pollo');
 await assert.rejects(guardarVinculoInventarioCartaRomoQA({
  db:m.db,identity:owner,expectedRevision:1,action:'vincular_carta',args:link()
 }),e=>e instanceof RomoInventarioRevisionConflicto);
 assert.equal(m.values().revision,2);
 const x=await guardarVinculoInventarioCartaRomoQA({
  db:m.db,identity:owner,expectedRevision:2,action:'desvincular_carta',args:unlink()
 });
 assert.equal(x.revision,3);
 assert.equal(m.values().contenido.items[0].carta_sku,undefined);
 assert.equal(m.values().contenido.movimientos.length,3);
});
test('cambio de revisión de catálogo entre lectura y guardado se rechaza',async()=>{
 const m=mem();
 const {guardarOperacionInventarioRomoQA}=await import('../lib/romo-inventario-qa.mjs');
 await guardarOperacionInventarioRomoQA({db:m.db,identity:owner,
  expectedRevision:0,action:'alta',args:stock()});
 const other={query:async(sql,args)=>{
  if(sql.startsWith('INSERT INTO'))m.setCatalogRevision(2);
  return m.db.query(sql,args);
 }};
 await assert.rejects(guardarVinculoInventarioCartaRomoQA({
  db:other,identity:owner,expectedRevision:1,action:'vincular_carta',
  args:link()
 }),e=>e instanceof RomoInventarioRevisionConflicto);
 assert.equal(m.values().revision,1);
 assert.equal(m.values().contenido.items[0].carta_sku,undefined);
});
test('ruta de inventario restringe enlaces a QA, Google y permiso de dueños',()=>{
 const api=readFileSync(new URL('../api/romo-inventario-qa.js',import.meta.url),'utf8');
 assert.match(api,/if\(\(enlace\|\|disponibilidadCarta\)&&mode!=='qa'\)/);
 assert.match(api,/const disponibilidadCarta=body\.action==='disponibilidad_carta'/);
 assert.match(api,/guardarVinculoInventarioCartaRomoQA/);
 assert.match(api,/resolveRomoIdentity/);
 assert.match(api,/ROMO_INVENTARIO_QA_ENABLED==='true'/);
 const link=readFileSync(new URL('../lib/romo-enlace-inventario-carta-qa.mjs',import.meta.url),'utf8');
 assert.match(link,/authorizeRomoOperation\(identity,'romo','serena','catalog.write'\)/);
 assert.doesNotMatch(link,/public\.uki_|fin_movimientos|UPDATE public\.romo_catalogo_v1/i);
});
test('el panel usa selección explícita, confirmación y revisión sin cambiar Uki',()=>{
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const mirrored=readFileSync(new URL('../public/romo-qa/uki-sushi-local.html',import.meta.url),'utf8');
 assert.equal(html,mirrored);
 assert.match(html,/Vincular con carta \(solo dueños\)/);
 assert.match(html,/action==='vincular_carta'\|\|action==='desvincular_carta'/);
 assert.match(html,/catalogoRevision=reporte\.catalogoRevision/);
 assert.match(html,/args\.confirmado=true/);
 assert.match(html,/El vínculo no modifica por sí mismo precios, stock ni disponibilidad en la carta/);
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
});
