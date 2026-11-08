'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {validateItem,enabled,allow}=require('../api/uki-ingredientes-armado-live.js')._test;
const sample=(extra={})=>({name:'Frutilla',category:'vegetal',surcharge:0,available:true,surfaces:['classic','premium'],...extra});
test('Incluido, recargo y selección de preparaciones validan sin inventar precios',()=>{
 assert.equal(validateItem(sample()).surcharge,0);
 assert.equal(validateItem(sample({surcharge:800})).surcharge,800);
 assert.equal(validateItem(sample({surcharge:-1})),null);
 assert.equal(validateItem(sample({surcharge:800.5})),null);
 assert.equal(validateItem(sample({surfaces:[]})),null);
 assert.equal(validateItem(sample({surfaces:['fake']})),null);
});
test('Categoría solo se asigna a preparaciones compatibles',()=>{
 assert.ok(validateItem(sample({category:'proteina',surfaces:['burger']})));
 assert.equal(validateItem(sample({category:'proteina',surfaces:['gohan']})),null);
 assert.equal(validateItem(sample({category:'envoltura',surfaces:['burger']})),null);
 assert.equal(validateItem(sample({category:'envoltura',surfaces:['classic','handroll']})).surfaces.length,2);
});
test('Función inhabilitada por defecto en producción',()=>{
 assert.equal(enabled({VERCEL_ENV:'production'}),false);
 assert.equal(enabled({VERCEL_ENV:'production',UKI_INGREDIENTES_ARMADO_ENABLED:'true'}),true);
 assert.equal(enabled({VERCEL_ENV:'preview',UKI_INGREDIENTES_ARMADO_ENABLED:'true'}),false);
});
test('Sin acceso a caja ni inventario para registrar ingredientes',()=>{
 const api=fs.readFileSync('api/uki-ingredientes-armado-live.js','utf8');
 assert.match(api,/uki_armado_ingredientes_v1/);
 assert.match(api,/userFromToken/);
 assert.match(api,/userFromToken/);
 assert.doesNotMatch(api,/INSERT INTO.*(?:uki_pedidos|uki_inventario_items)/i);
});

test('La carta QA aislada puede leer ingredientes; no se abre el origen en producción',()=>{
 const qa={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'preparacion/uki-publicacion-unificada-2026-11-07',UKI_INVENTARIO_QA_ENABLED:'true'};
 const prod={VERCEL_ENV:'production',UKI_INGREDIENTES_ARMADO_ENABLED:'true'};
 for(const origin of [
  'https://uki-sushi-carta-prueba.vercel.app',
  'https://uki-sushi-carta-prueba-qacarta-diannaleandra-7046.vercel.app',
 ]){
  assert.equal(allow(origin,qa),true);
  assert.equal(allow(origin,prod),false);
 }
 assert.equal(allow('https://carta-ajena.example',qa),false);
});
