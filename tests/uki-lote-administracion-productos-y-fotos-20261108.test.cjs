'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const panel=fs.readFileSync('firebase/uki-sushi-local.html','utf8');
const prices=fs.readFileSync('firebase/uki-carta-precios-admin.js','utf8');
const ingredients=fs.readFileSync('firebase/uki-armado-ingredientes-admin.js','utf8');
const apiP=require('../api/uki-carta-precios-live.js');
const apiI=require('../api/uki-ingredientes-armado-live.js');
const apiPhoto=require('../api/uki-carta-fotos-live.js');
test('Los nuevos APIs no alteran datos de pedidos ni caja, autenticación obligatoria',()=>{
 const files=['uki-carta-precios-live.js','uki-ingredientes-armado-live.js','uki-carta-fotos-live.js'];
 for(const file of files){
  const s=fs.readFileSync('api/'+file,'utf8');
  assert.match(s,/jwtVerify/);
  assert.doesNotMatch(s,/UPDATE\s+public\.uki_(?:pedidos|caja|cierres)|DELETE\s+FROM\s+public\.uki_(?:pedidos|caja|cierres)/i);
  assert.match(s,/branch/);
 }
 assert.match(prices,/Quitar producto de la carta/);
 assert.match(prices,/restaurar-producto/);
 assert.match(ingredients,/Quitar ingrediente de la carta/);
 assert.match(ingredients,/restaurar/);
});
test('Retirar productos se puede revertir y no elimina ventas antiguas',()=>{
 const src=fs.readFileSync('api/uki-carta-precios-live.js','utf8');
 assert.match(src,/action==='retirar-producto'\|\|action==='restaurar-producto'/);
 assert.match(src,/if\(!entry\.custom\)return fail/);
 assert.match(src,/UPDATE public\.uki_carta_productos_custom_v1 SET available=/);
 assert.match(src,/custom\|\|i\.available/);
 assert.doesNotMatch(src,/DELETE FROM\s+public\.uki_carta_productos_custom_v1/);
});
test('Retirar ingredientes no confunde stock y disponibilidad; conserva SKU',()=>{
 const src=fs.readFileSync('api/uki-ingredientes-armado-live.js','utf8');
 assert.match(src,/if\(action==='retirar'\|\|action==='restaurar'\)/);
 assert.match(src,/UPDATE public\.uki_armado_ingredientes_v1 SET available=/);
 assert.doesNotMatch(src,/DELETE FROM public\.uki_armado_ingredientes_v1/);
});
test('Foto comprimida JPEG, WebP o PNG; rechazo de datos ajenos',()=>{
 const {validPicture,validSku}=apiPhoto._test;
 const jpg=Buffer.alloc(160,1);jpg[0]=255;jpg[1]=216;jpg[2]=255;
 assert.equal(validPicture('image/jpeg',jpg.toString('base64')),true);
 assert.equal(validPicture('image/png',jpg.toString('base64')),false);
 assert.equal(validPicture('image/svg+xml',jpg.toString('base64')),false);
 assert.equal(validPicture('image/jpeg',Buffer.alloc(300000,1).toString('base64')),false);
 for(const sku of ['monthly:promo-24','classic:24','dish:burger-promo','pizza:cheese'])
  assert.equal(validSku(sku),true);
 for(const sku of ['ingredient:frutilla','', '../x','dish:<img>'])
  assert.equal(validSku(sku),false);
});
test('Fotos en servidor administradas por usuario, sucursal y versión; no actualizan precios',()=>{
 const src=fs.readFileSync('api/uki-carta-fotos-live.js','utf8');
 assert.match(src,/VERCEL_ENV!=='production'/);
 assert.match(src,/uid=await authorize\(req,env\)/);
 assert.match(src,/expected_version/);
 assert.match(src,/ON CONFLICT\(branch,sku\) DO UPDATE/);
 assert.match(src,/WHERE public\.uki_carta_fotos_v1\.version=\$5/);
 assert.match(src,/DELETE FROM public\.uki_carta_fotos_v1 WHERE branch=\$1 AND sku=\$2 AND version=\$3/);
 assert.match(src,/SELECT sku,version,mime/);
 assert.doesNotMatch(src,/UPDATE\s+public\.uki_carta_items_v1|UPDATE\s+public\.uki_carta_productos_custom_v1/);
});
test('La edición de fotografías se hace desde Carta y precios, disponible en iPhone',()=>{
 assert.match(prices,/photoControls\(price\)/);
 assert.match(prices,/reduceImage\(file\)/);
 assert.match(prices,/file\.type/);
 assert.match(prices,/state\.photos/);
 assert.match(prices,/subir/);
 assert.match(prices,/Quitar foto/);
});
test('Migración se mantiene aislada de inventario y caja',()=>{
 const sql=fs.readFileSync('sql/uki-carta-fotos-v1.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.uki_carta_fotos_v1/);
 assert.match(sql,/PRIMARY KEY \(branch,sku\)/);
 assert.doesNotMatch(sql,/\bDROP\s+TABLE\b|\bUPDATE\s+public\.|\bDELETE\s+FROM\b/i);
});
