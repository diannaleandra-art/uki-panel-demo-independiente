'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {spawnSync}=require('node:child_process');
const file=name=>readFileSync(join(__dirname,'..','firebase',name),'utf8');
test('faltantes se calculan con mínimo menos conteo y no agotan automáticamente',async()=>{
 const {faltantesInventario}=await import('../firebase/uki-inventario-reposicion.mjs');
 const rows=[
  {sku:'ingredient:pollo',name:'Pollo',stock_qty:2,min_stock_qty:5,stock_unit:'kg',available:true},
  {sku:'ingredient:palta',name:'Palta',stock_qty:10,min_stock_qty:4,stock_unit:'kg',available:false},
  {sku:'ingredient:queso',name:'Queso',stock_qty:0,min_stock_qty:0,stock_unit:'un',available:true}
 ];
 const result=faltantesInventario(rows);
 assert.equal(result.pendientes.length,1);
 assert.equal(result.pendientes[0].falta,3);
 assert.equal(result.pendientes[0].nombre,'Pollo');
 assert.equal(rows[0].available,true);
 assert.equal(rows[1].available,false);
 assert.equal(result.sinMinimo,1);
});
test('la lista corresponde solo a una sucursal y no contiene cierres ni montos',async()=>{
 const {textoListaReposicion}=await import('../firebase/uki-inventario-reposicion.mjs');
 const items=[{sku:'ingredient:palta',name:'Palta',stock_qty:1,min_stock_qty:3,
  stock_unit:'kg',available:false,price:99999}];
 const msg=textoListaReposicion({branch:'serena',items,nombre:'Sara',
  fecha:new Date('2026-11-05T21:00:00Z')});
 assert.match(msg,/La Serena/);
 assert.match(msg,/llevar 2 kg/);
 assert.doesNotMatch(msg,/Regimiento Arica|99999|venta total|efectivo esperado/i);
 assert.throws(()=>textoListaReposicion({branch:'otra',items,nombre:'Sara'}));
});
test('la pantalla de trabajadores no carga ni descifra caja o cierres',()=>{
 const html=file('uki-inventario-revision.html');
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Falta el módulo de inventario.');
 const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{
  encoding:'utf8',input:script});
 assert.equal(syntax.status,0,syntax.stderr);
 assert.match(html,/obtenerSesionQR/);
 assert.match(html,/expected_version/);
 assert.match(html,/compartir por WhatsApp/i);
 assert.doesNotMatch(script,/uki-sushi-nube|cajaDelDia|vCierre\(|uki_operacion_v1|descifrarBloque|claveNube/);
 assert.doesNotMatch(script,/api\/mesa-cuentas-live|api\/mesa-pedidos-live/);
});
