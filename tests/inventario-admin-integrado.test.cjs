'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('Uki conserva panel de pedidos, caja y cierre; inventario es nueva vista en el mismo panel',()=>{
 const s=read('firebase/uki-sushi-local.html');
 assert.match(s,/const VISTAS=\[\["inicio","Inicio","⌂"\]/);
 assert.match(s,/const CAJA_TABS=\[\["resumen","Resumen"\]/);
 assert.match(s,/const UKI_LOCAL_PREFIX="uki_operativo_v1_cifrado_"/);
 assert.match(s,/onclick="ir\('inventario'\)"/);
 assert.match(s,/inventario:\(\)=>window\.ukiInventarioPanelHTML/);
 assert.match(s,/window\.ukiInventarioMontar\?\.\(\)/);
 assert.match(s,/uki-inventario-admin-embebido\.js/);
 assert.doesNotMatch(s,/id="ukiInventarioAcceso"/);
});
test('inventario reutiliza misma sesión Google; no usa PIN trabajador ni iframe',()=>{
 const page=read('firebase/uki-sushi-local.html'),script=read('firebase/uki-inventario-admin-embebido.js');
 assert.match(page,/window\.ukiInventarioToken=async\(\)=>auth\.currentUser/);
 assert.match(script,/window\.ukiInventarioToken\?\.\(\)/);
 assert.match(script,/https:\/\/uki-sushi-inventario\.vercel\.app\/api\/inventario-turno-live/);
 for(const action of ['reportes','articulos','crear-articulo','configurar-unidad','editar-articulo'])assert.ok(script.includes("'"+action+"'"));
 assert.match(script,/replace\(',','\.'\)/);
 assert.doesNotMatch(script,/<iframe|pin\.|setItem\(|localStorage\./i);
});
test('backend permite solo GitHub Pages operativo con autorización admin y conserva al trabajador',()=>{
 const api=read('api/inventario-turno-live.js');
 assert.match(api,/https:\/\/diannaleandra-art\.github\.io/);
 assert.match(api,/UKI_INVENTARIO_LIVE_ALLOWED_UIDS/);
 assert.match(api,/UKI_INVENTARIO_LIVE_ALLOWED_EMAILS/);
 assert.match(api,/if\(!uid\)return fail\(res,403,'Solo administración autorizada'\)/);
 assert.doesNotMatch(api,/Access-Control-Allow-Origin[^;\n]*\*/);
 const worker=read('public/index.html');
 assert.match(worker,/inventario/);
 assert.doesNotMatch(worker,/window\.ukiInventarioToken/);
});
