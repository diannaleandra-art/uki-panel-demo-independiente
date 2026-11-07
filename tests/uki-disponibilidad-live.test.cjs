'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../api/uki-disponibilidad-live.js');
const {baseItems}=require('../lib/uki-catalogo-v1.cjs');
test('solo orígenes precisos carta pública y panel operativo',()=>{
 assert.equal(api._testing.ORIGINS.has('https://uki-sushi-pedidos.vercel.app'),true);
 assert.equal(api._testing.ORIGINS.has('https://diannaleandra-art.github.io'),true);
 assert.equal(api._testing.ORIGINS.has('https://uki-sushi-panel.vercel.app'),false);
 assert.equal(api._testing.ORIGINS.has('https://evil.example'),false);
});
test('la consulta de agotados no consulta ni cambia inventario, pedidos o caja',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../api/uki-disponibilidad-live.js'),'utf8');
 assert.match(s,/SELECT sku FROM public\.uki_carta_items_v1 WHERE branch=\$1 AND available=FALSE/);
 assert.match(s,/jwtVerify/);assert.match(s,/UKI_INVENTARIO_LIVE_ALLOWED_EMAILS/);
 assert.match(s,/if\(origin!=='https:\/\/diannaleandra-art\.github\.io'\)/);
 assert.doesNotMatch(s,/UPDATE\s+public\.uki_inventario|UPDATE\s+public\.uki_mesas/);
 const q=api._testing.updateStatement();
 assert.match(q,/available IS DISTINCT FROM EXCLUDED\.available/);
 assert.match(q,/JOIN logged ON TRUE/);
 assert.match(q,/uki_carta_movimientos_v1/);
 assert.doesNotMatch(q,/stock_qty=|min_stock_qty=|price=/);
});
test('el catálogo muestra pizzas solo en Arica y las opciones de ambas sucursales',async()=>{
 const arica=await baseItems('arica'),serena=await baseItems('serena');
 assert.ok(arica.some(x=>x.sku==='pizza:pepperoni'));
 assert.ok(!serena.some(x=>x.sku==='pizza:pepperoni'));
 for(const set of [arica,serena]){
  assert.ok(set.some(x=>x.sku==='ingredient:proteina-pollo'));
  assert.ok(set.some(x=>x.sku==='ingredient:envoltura-panko'));
  assert.ok(set.some(x=>x.sku==='classic:24'));
  assert.ok(set.some(x=>x.sku==='dish:sushi-burger'));
 }
});
