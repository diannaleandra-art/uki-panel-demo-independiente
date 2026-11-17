import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {entornoPanelRomoAutorizado}=require('../lib/romo-entorno-panel.cjs');
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const preview={
 VERCEL_ENV:'preview',
 VERCEL_GIT_COMMIT_REF:'release/romos-panel-v816',
 ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
 ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel-git-release-test.vercel.app'
};

test('preview de Romo sólo funciona en el panel aislado',()=>{
 assert.equal(entornoPanelRomoAutorizado(preview),true);
 assert.equal(entornoPanelRomoAutorizado({...preview,VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816'}),true);
 assert.equal(entornoPanelRomoAutorizado({...preview,ROMO_PANEL_ISOLATED_PROJECT:'uki-sushi-inventario'}),false);
 assert.equal(entornoPanelRomoAutorizado({...preview,VERCEL_GIT_COMMIT_REF:'main'}),false);
 assert.equal(entornoPanelRomoAutorizado({...preview,ROMO_PANEL_ALLOWED_ORIGIN:'https://uki-sushi-inventario.vercel.app'}),false);
});

test('producción bloqueada hasta autorización en proyecto Romo',()=>{
 const prod={...preview,VERCEL_ENV:'production'};
 assert.equal(entornoPanelRomoAutorizado(prod),false);
 assert.equal(entornoPanelRomoAutorizado({...prod,ROMO_PANEL_PRODUCTION_ENABLED:'true'}),true);
 assert.equal(entornoPanelRomoAutorizado({...prod,ROMO_PANEL_PRODUCTION_ENABLED:'true',VERCEL_GIT_COMMIT_REF:'main'}),false);
});

test('carta y precios aparece en inventario, no duplicada en promos',()=>{
 const html=read('../public/romo-panel-qa/index.html');
 const admin=read('../public/romo-panel-qa/uki-carta-precios-admin.js');
 const editor=read('../public/romo-panel-qa/romo-carta-editor-seguro-qa.js');
 assert.doesNotMatch(html,/id="romoCartaEditorSeguroQA"/);
 assert.match(html,/uki-carta-precios-admin\.js/);
 assert.match(admin,/window\.romoMontarCartaEditorSeguroQA/);
 assert.match(admin,/container\.style\.display='none'/);
 assert.match(admin,/Carta y precios de Romo no pueden guardar cambios en Uki/);
 assert.match(editor,/autorizado=await request\('GET'\)/);
 assert.match(editor,/container\.style\.removeProperty\('display'\)/);
});

test('la rama de entrega no despliega automáticamente',()=>{
 const config=JSON.parse(read('../vercel.json'));
 assert.equal(config.git?.deploymentEnabled?.['release/romos-panel-v816'],false);
 assert.equal(config.git?.deploymentEnabled?.['qa/romos-panel-v816'],false);
});

test('diagnóstico de Neon sólo acepta cuenta de servicio y rama QA de Romo',()=>{
 const api=require('../api/romo-conexion-lectura-qa.js');
 const config=api._internalQA.config;
 const env={
  VERCEL_ENV:'preview',
  VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816',
  ROMO_PANEL_ISOLATED_PROJECT:'romos-sushi-panel',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app',
  ROMO_PRIVATE_DATABASE_HOST:'ep-wild-hat-bezucf4v.c-9.us-east-2.aws.neon.tech',
  ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:dummy@ep-wild-hat-bezucf4v.c-9.us-east-2.aws.neon.tech/romos_sushi',
  ROMO_CONEXION_LECTURA_QA_ENABLED:'true'
 };
 assert.equal(typeof config(env)?.db,'string');
 assert.equal(config({...env,ROMO_PRIVATE_DATABASE_URL:env.ROMO_PRIVATE_DATABASE_URL.replace('romos_app_service','romos_sushi_owner')}),null);
 assert.equal(config({...env,ROMO_PRIVATE_DATABASE_URL:env.ROMO_PRIVATE_DATABASE_URL.replace('/romos_sushi','/neondb')}),null);
 assert.equal(config({...env,VERCEL_GIT_COMMIT_REF:'main'}),null);
 assert.equal(config({...env,ROMO_CONEXION_LECTURA_QA_ENABLED:'false'}),null);
});


test('API privadas de Romo preservan sesión Vercel en Preview sin eliminar Google',()=>{
 const files=[
  '../public/romo-panel-qa/uki-romo-clave-remota-qa.mjs',
  '../public/romo-panel-qa/uki-romo-conexion-lectura-qa.mjs',
  '../public/romo-panel-qa/uki-romo-operativo-qa.mjs',
  '../public/romo-panel-qa/uki-romo-catalogo-qa.mjs',
  '../public/romo-panel-qa/uki-romo-recepcion-formulario-qa.mjs',
  '../public/romo-panel-qa/uki-romo-vinculo-duenos-qa.mjs',
  '../public/romo-panel-qa/index.html'
 ];
 for(const file of files){
  const source=read(file);
  assert.match(source,/credentials:\s*['"]same-origin['"]/);
  assert.doesNotMatch(source,/credentials:\s*['"]omit['"]/);
  assert.match(source,/Authorization:\s*['"]Bearer /);
 }
});


test('Romo QA mantiene autenticación en banner, catálogo e inventario sin abrir ventas',()=>{
 const files=[
  '../public/romo-panel-qa/romo-banner-admin.js',
  '../public/romo-panel-qa/romo-carta-editor-seguro-qa.js',
  '../public/romo-panel-qa/romo-inventario-trabajador.html'
 ];
 for(const path of files){
  const src=read(path);
  assert.match(src,/credentials:\s*['"]same-origin['"]/);
  assert.doesNotMatch(src,/credentials:\s*['"]omit['"]/);
 }
 const inv=read('../public/romo-panel-qa/uki-inventario-admin-embebido.js');
 assert.match(inv,/fetch\('\/api\/romo-inventario-qa',\{\s*method:isRead\?'GET':'POST',credentials:'same-origin'/);
 assert.match(inv,/fetch\('\/api\/romo-pin-inventario-qa',\{method:'POST',credentials:'same-origin'/);
 // La API heredada de Uki permanece separada; no se cambia su autenticación.
 assert.match(inv,/fetch\(API,\{method:'POST',mode:'cors',credentials:'omit'/);
 const tabs=read('../public/romo-panel-qa/uki-carta-precios-admin.js');
 assert.match(tabs,/inventario:\[[^\]]*'romoInvWorkerAccess'/);
 assert.match(tabs,/const ids=\[[\s\S]*?'romoInvWorkerAccess'/);
 assert.match(tabs,/Carta y precios de Romo aún no disponible/);
 const api=read('../api/romo-estado-cifrado-panel-qa.js');
 assert.match(api,/ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED/);
 assert.match(api,/ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED/);
});


test('Permisos Preview Romo: lectura independiente y escritura comercial cerrada',()=>{
 const env={
  ...preview,
  VERCEL_GIT_COMMIT_REF:'qa/romos-panel-v816',
  ROMO_PANEL_ALLOWED_ORIGIN:'https://romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app',
  ROMO_CARTA_ALLOWED_ORIGIN:'https://romos-sushi-carta.vercel.app',
  ROMO_CARTA_CATALOGO_QA_ORIGIN:'https://romos-sushi-carta.vercel.app',
  ROMO_PRIVATE_DATABASE_HOST:'ep-sample.c-2.us-east-2.aws.neon.tech',
  ROMO_PRIVATE_DATABASE_URL:'postgresql://romos_app_service:dummy@ep-sample.c-2.us-east-2.aws.neon.tech/romos_sushi',
  ROMO_SOLICITUDES_RATE_SALT:'x'.repeat(64)
 };
 const inventario=require('../api/romo-inventario-qa.js')._internalQA.config;
 const banner=require('../api/romo-banner-carta-qa.js')._internal.config;
 const carta=require('../api/romo-carta-ediciones-seguras-qa.js')._internalQA.config;
 const pin=require('../api/romo-pin-inventario-qa.js')._internalQA.configuration;
 for(const f of [inventario,banner,carta,pin])assert.equal(f(env),null);
 const lectura={...env,ROMO_INVENTARIO_LECTURA_QA_ENABLED:'true',
  ROMO_CATALOGO_LECTURA_QA_ENABLED:'true'};
 const a=inventario(lectura),b=banner(lectura);
 assert.equal(typeof a?.read,'string');
 assert.equal(b?.write,false);
 assert.equal(pin(lectura),null);
 assert.equal(carta(lectura),null);
 const pinRead=pin({...lectura,ROMO_PIN_INVENTARIO_QA_ENABLED:'true'});
 assert.equal(pinRead?.write,false);
 assert.equal(pin({...lectura,ROMO_PIN_INVENTARIO_QA_ENABLED:'true',
  ROMO_SOLICITUDES_RATE_SALT:'short'}),null);
 const cartaRead=carta({...lectura,ROMO_CARTA_EDICIONES_QA_ENABLED:'true'});
 assert.equal(cartaRead?.panel,env.ROMO_PANEL_ALLOWED_ORIGIN);
 assert.equal(cartaRead?.write,false);
 assert.equal(carta({...lectura,ROMO_CARTA_EDICIONES_QA_ENABLED:'true',
  ROMO_CARTA_EDICIONES_ESCRITURA_QA_ENABLED:'true'})?.write,true);
 const apiCarta=read('../api/romo-carta-ediciones-seguras-qa.js');
 assert.match(apiCarta,/if\(method==='POST'&&!conf\.write\)/);
 assert.match(apiCarta,/ROMO_CARTA_EDICIONES_ESCRITURA_QA_ENABLED/);
 assert.match(apiCarta,/edicionHabilitada:conf\.write/);
 const editor=read('../public/romo-panel-qa/romo-carta-editor-seguro-qa.js');
 assert.match(editor,/state\.current\?\.edicionHabilitada!==true\)return/);
 assert.match(editor,/result\.edicionHabilitada===true/);
 assert.match(editor,/La edición de productos sigue desactivada/);
 const cierre=read('../api/romo-estado-cifrado-panel-qa.js');
 assert.match(cierre,/ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED/);
 assert.match(cierre,/ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED/);
 assert.equal(env.ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED,undefined);
});

test('panel único QA permite ver Neon Romo desde mismo selector sin guardado',()=>{
 const html=read('../firebase/uki-sushi-local.html');
 assert.match(html,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(html,/const SUCURSALES_PANEL_QA=Object\.freeze\(\[\.\.\.SUCURSALES,ROMO_SUCURSAL_QA\]\)/);
 assert.match(html,/function ukiConsultarRomoPanelUnicoQA\(\)/);
 assert.match(html,/method:'GET',headers:\{Authorization:'Bearer '\+token\}/);
 assert.match(html,/credentials:'same-origin'/);
 assert.match(html,/abrirLocal\(JSON\.stringify\(remoto\.snapshot\),ROMO_SUCURSAL_QA,clave\)/);
 assert.match(html,/function ukiResumenRomoConsultaQA\(\)/);
 assert.match(html,/if\(!S\.suc&&!S\.pinSuc&&S\.romoSeleccionadoQA&&romoConsultaUnificadaQA\)/);
 assert.match(html,/\/\/ No ingresar en S\.suc, copiar registros a Uki ni ejecutar guardados/);
 const autoStart=html.indexOf('function guardarEnLocalStorage(){');
 const autoEnd=html.indexOf('if(!S.suc||!claveSesion',autoStart);
 assert.ok(autoStart>0&&autoEnd>autoStart);
 const romoGuard=html.slice(autoStart,autoEnd);
 assert.match(romoGuard,/if\(S\.suc===ROMO_SUCURSAL_QA\)/);
 assert.match(romoGuard,/return Promise\.resolve\(false\)/);
 assert.doesNotMatch(romoGuard,/session\.guardar\(/);
 const module=read('../firebase/uki-romo-operativo-qa.mjs');
 assert.match(module,/const ROMO_OPERATIVO_ENDPOINT_QA='';/);
});

test('panel único QA consulta áreas Romo sin alterar pedidos Uki',()=>{
 const html=read('../firebase/uki-sushi-local.html');
 const from=html.indexOf('async function ukiRomoConsultarAreaPanelUnicoQA(area){');
 const until=html.indexOf('function ukiRomoAreaConsultaHTMLQA(){',from);
 assert.ok(from>0&&until>from);
 const consulta=html.slice(from,until);
 for(const p of ['/api/romo-solicitudes-carta-qa',
  '/api/romo-inventario-qa','/api/romo-carta-ediciones-seguras-qa'])
  assert.ok(consulta.includes(p));
 assert.match(consulta,/method:'GET'/);
 assert.doesNotMatch(consulta,/method:'POST'/);
 assert.doesNotMatch(consulta,/localStorage\.setItem\(/);
 assert.doesNotMatch(consulta,/session\.guardar\(/);
 assert.match(consulta,/data\?\.storeId!=='romo:serena'/);
 assert.match(consulta,/data\.readOnly!==true/);
 assert.match(consulta,/data\.edicionHabilitada===true/);
 assert.match(consulta,/data\.products\.length!==40/);
 assert.match(consulta,/Carta aprobada de Romo/);
 assert.match(consulta,/solicitud!==romoConsultaSolicitudAreaQA/);
 assert.match(html,/function ukiRomoAreaConsultaHTMLQA\(\)/);
 assert.match(html,/esc\(x\.nombre\)/);
 assert.match(html,/esc\(x\.detalle\)/);
 assert.match(html,/\+\+romoConsultaSolicitudAreaQA/);
 const inventory=read('../api/romo-inventario-qa.js');
 assert.match(inventory,/ROMO_INVENTARIO_ESCRITURA_QA_ENABLED/);
 const requests=read('../api/romo-solicitudes-carta-qa.js');
 assert.match(requests,/ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED/);
 const catalog=read('../api/romo-catalogo-lectura-qa.js');
 assert.match(catalog,/if\(req\.method!=='GET'\)/);
});

test('panel único QA usa filtros del Uki oficial sobre pedidos confirmados de Romo sin mezclar solicitudes',()=>{
 const html=read('../firebase/uki-sushi-local.html');
 const from=html.indexOf('const pedidosGuardados=datos.pedidos.filter(');
 const to=html.indexOf('// No ingresar en S.suc, copiar registros a Uki ni ejecutar guardados.',from);
 assert.ok(from>0&&to>from);
 const extraer=html.slice(from,to);
 assert.match(extraer,/p\?\.suc===ROMO_SUCURSAL_QA/);
 assert.match(extraer,/ukiOrigenPedido\(p\)/);
 assert.match(extraer,/UKI_CATEGORIAS_PEDIDOS/);
 assert.match(extraer,/ukiCoincideCategoriaPedido\(p,tipo,conError\)/);
 assert.doesNotMatch(extraer,/S\.pedidos\.push|guardarEnLocalStorage|session\.guardar/);
 const filtros=html.slice(html.indexOf('function ukiRomoFiltrarPedidosGuardadosQA('),
  html.indexOf('function ukiRomoAreaConsultaHTMLQA(){'));
 assert.match(filtros,/ukiBusquedaPorDatos\(busqueda,/);
 assert.match(filtros,/function ukiRomoPedidosGuardadosConsultaHTMLQA\(\)/);
 assert.match(filtros,/p\.categorias\.includes\(categoria\)/);
 assert.match(filtros,/esc\(p\.cliente/);
 assert.match(filtros,/p\.total===null\?'Total por revisar'/);
 assert.match(filtros,/No son solicitudes nuevas y no se cobran otra vez/);
 const area=html.slice(html.indexOf('function ukiRomoAreaConsultaHTMLQA(){'),
  html.indexOf('function ukiResumenRomoConsultaQA(){'));
 assert.match(area,/a\.area==='pedidos'\?ukiRomoPedidosGuardadosConsultaHTMLQA\(\)/);
 assert.match(area,/Los pedidos guardados en Neon son visibles incluso si falla la consulta/);
 assert.match(area,/return registrados\+/);
});
test('salida de Romo no usa guardado de Uki y no pierde operacion Neon pendiente',()=>{
 const html=read('../firebase/uki-sushi-local.html');
 const from=html.indexOf('async function salirSuc(){');
 const until=html.indexOf('// Mensaje de equipo rotativo',from);
 assert.ok(from>0&&until>from);
 const salida=html.slice(from,until);
 assert.match(salida,/if\(S\.suc===ROMO_SUCURSAL_QA\)/);
 assert.match(salida,/ukiBorradorTieneContenido\(\)/);
 assert.match(salida,/window\.ukiRomoSesionRemotaQA\?\.cerrar\(\)/);
 assert.match(salida,/catch\(e\)\{/);
 assert.match(salida,/else if\(S\.suc\)\{/);
 assert.match(salida,/const ok=await guardarEnLocalStorage\(\);if\(!ok\)return/);
});
