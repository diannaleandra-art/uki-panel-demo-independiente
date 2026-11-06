'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const load=s=>readFileSync(join(__dirname,'..','firebase',s),'utf8');
const worker=load('uki-inventario-turno-qa.html');
const admin=load('uki-inventario-administracion-qa.html');
const panel=load('uki-sushi-local.html');

test('trabajador solo ve conteo, mercadería y reporte; nunca caja ni precios',()=>{
 assert.match(worker,/Código exclusivo de inventario \(6 números\)/);
 assert.match(worker,/Guardar conteo/);
 assert.match(worker,/Registrar entrada/);
 assert.match(worker,/Guardar en el panel y compartir por WhatsApp/);
 assert.match(worker,/requestId=crypto\.randomUUID\(\)/);
 assert.match(worker,/const result=await api\('finalizar'/);
 assert.match(worker,/if\(result\.guardado!==true\)/);
 assert.doesNotMatch(worker,/ukimesasToken|cajasDiarias|uki-sushi-nube|reportes financieros|Marcar agotado/);
 assert.doesNotMatch(worker,/localStorage|sessionStorage|indexedDB/);
});
test('administración configura el código y consulta el historial por sucursal',()=>{
 assert.match(admin,/crear-codigo/);
 assert.match(admin,/getIdToken\(auth\.currentUser,true\)/);
 assert.match(admin,/request\('reportes'\)/);
 assert.match(admin,/created_at/);
 assert.match(admin,/worker_name/);
 assert.doesNotMatch(admin,/localStorage|sessionStorage/);
 assert.match(panel,/uki-inventario-administracion-qa\.html/);
 assert.match(panel,/UKI_CATALOGO_PREVIEW&&admin/);
});
test('tanto administrador como trabajador están limitados a QA',()=>{
 assert.match(worker,/const isQA=\/\^uki-sushi-panel/);
 assert.match(admin,/const validHost=\/\^uki-sushi-panel/);
 assert.match(worker,/api\/inventario-turno-qa/);
 assert.match(admin,/api\/inventario-turno-qa/);
 assert.doesNotMatch(panel,/window\.ukiInvQALIVE/);
});

test('los módulos JS de ambas pantallas pueden compilarse sin errores',()=>{
 for(const html of [worker,admin]){
  const js=html.split('<script type="module">')[1]?.split('</script>')[0];
  assert.ok(js&&js.length>500);
  const withoutImports=js.split('\n').filter(line=>!line.trim().startsWith('import ')).join('\n');
  assert.doesNotThrow(()=>new Function(withoutImports));
 }
});

test('ambas pantallas QA usan el mismo enlace estable del servidor, sin tocar producción',()=>{
 const expected='https://uki-sushi-inventario-qa2026-diannaleandra-7046.vercel.app/api/inventario-turno-qa';
 assert.ok(worker.includes(expected));
 assert.ok(admin.includes(expected));
 assert.ok(!worker.includes('uki-sushi-pedidos.vercel.app/api'));
 assert.ok(!admin.includes('uki-sushi-pedidos.vercel.app/api'));
});

test('guardar conteo y registrar entrada vuelven a habilitarse al abrir el inventario',()=>{
 const block=worker.split('const setBusy=value=>{')[1]?.split('};')[0];
 assert.ok(block,'Falta controlador de botones');
 assert.match(block,/querySelectorAll\('button'\)/);
 assert.match(block,/b\.disabled=value/);
 assert.match(worker,/render\(\);status\('Inventario del turno listo\.'\)/);
 assert.match(worker,/finally\{setBusy\(false\);\}/);
 assert.match(worker,/count\.disabled=busy/);
 assert.match(worker,/receive\.disabled=busy/);
});
