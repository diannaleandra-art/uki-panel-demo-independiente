'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const api=require('../api/uki-ingredientes-armado-live.js')._test;
const db=require('../lib/uki-inventario-db-live.cjs');
test('API desactivada por defecto; requiere activación explícita en producción',()=>{
 assert.equal(api.enabled({VERCEL_ENV:'production'}),false);
 assert.equal(api.enabled({VERCEL_ENV:'production',UKI_INGREDIENTES_ARMADO_ENABLED:'true'}),true);
 assert.equal(api.enabled({VERCEL_ENV:'preview',UKI_INGREDIENTES_ARMADO_ENABLED:'true'}),false);
});
test('Se conserva la lista de orígenes y no autoriza modificaciones desde carta pública',()=>{
 const prod={VERCEL_ENV:'production',UKI_INGREDIENTES_ARMADO_ENABLED:'true'};
 assert.equal(api.allow('https://uki-sushi-pedidos.vercel.app',prod),true);
 assert.equal(api.allow('https://diannaleandra-art.github.io',prod),true);
 assert.equal(api.allow('https://dominio-ajeno.example',prod),false);
});
test('Recargos incluidos, recargos personalizados, límites y preparaciones permitidas',()=>{
 const a={category:'vegetal',name:'Frutilla',surcharge:0,surfaces:['classic','premium'],available:true};
 const b=api.validateItem(a);
 assert.equal(b.surcharge,0);
 assert.equal(api.validateItem({...a,surcharge:500}).surcharge,500);
 assert.equal(api.validateItem({...a,surcharge:50001}),null);
 assert.equal(api.validateItem({...a,category:'proteina',surfaces:['gohan']}),null);
 assert.equal(api.validateItem({...a,name:'Sin queso'}),null);
});
test('No se toca el inventario, caja, pedidos, ni los scripts existentes',()=>{
 const content=fs.readFileSync('api/uki-ingredientes-armado-live.js','utf8');
 new vm.Script(content);
 assert.match(content,/uki_armado_ingredientes_v1/);
 assert.doesNotMatch(content,/UPDATE public\.uki_inventario_/);
 assert.doesNotMatch(content,/S\.pedidos\.push/);
 assert.match(fs.readFileSync('firebase/uki-sushi-local.html','utf8'),/uki-armado-ingredientes-admin\.js/);
 assert.ok(db.LIVE_HOSTS.has('ep-jolly-paper-b5r8w6vu.c-7.us-east-2.aws.neon.tech'));
});
