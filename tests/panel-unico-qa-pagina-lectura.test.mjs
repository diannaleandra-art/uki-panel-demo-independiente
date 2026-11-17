import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const pagina=read('../public/romo-panel-qa/panel-unico-consulta-qa.html');
const base=read('../firebase/uki-sushi-local.html');
const scripts=[...pagina.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];

test('pagina QA unica es navegable y no sustituye las rutas actuales',()=>{
 const config=JSON.parse(read('../vercel.json'));
 assert.equal(config.redirects.find(x=>x.source==='/')?.destination,'/romo-panel-qa/index.html');
 assert.equal(config.git.deploymentEnabled['qa/romos-panel-v816'],false);
 assert.match(pagina,/Panel único · Uki \+ Romo · QA/);
 assert.match(pagina,/VISTA DE PRUEBA · PANEL ÚNICO UKI \+ ROMO · SOLO CONSULTA/);
 assert.match(pagina,/meta name="robots" content="noindex, nofollow, noarchive"/);
 assert.match(pagina,/const SUCURSALES_PANEL_QA=Object\.freeze\(\[\.\.\.SUCURSALES,ROMO_SUCURSAL_QA\]\)/);
});
test('la pagina de pruebas no carga el motor de escritura ni Firestore',()=>{
 assert.equal(scripts.length,2,'Sólo un script del panel y Firebase Auth lectura');
 assert.equal([...pagina.matchAll(/<script[^>]*\bsrc=/g)].length,0);
 assert.doesNotMatch(pagina,/getFirestore|writeBatch|runTransaction|crearSnapshotsUki|crearAutoGuardadoOperativo/);
 assert.doesNotMatch(pagina,/uki-romo-operativo-qa\.mjs|uki-romo-integracion-panel-qa\.mjs/);
 assert.match(pagina,/window\.ukiInventarioToken=async/);
 assert.match(pagina,/signInWithPopup\(auth,new GoogleAuthProvider\(\)\)/);
 assert.doesNotMatch(pagina,/ukiSaveQA.*addEventListener|ukiAutoCheck.*addEventListener/);
});
test('Uki y operaciones Romo quedan bloqueadas dentro de este Preview',()=>{
 const code=scripts[0][2];
 const elegir=code.slice(code.indexOf('function pedirPin(s){'),code.indexOf('async function entrarSuc(){'));
 assert.match(elegir,/if\(s!==ROMO_SUCURSAL_QA\)/);
 assert.match(elegir,/Uki continúa funcionando en su panel oficial/);
 const entrada=code.slice(code.indexOf('async function entrarSuc(){'),code.indexOf('async function salirSuc(){'));
 assert.match(entrada,/Esta vista es exclusivamente de consulta/);
 assert.ok(entrada.indexOf('return;')<entrada.indexOf('const s=S.pinSuc'));
 assert.match(code,/const desdeEnlace=null;/);
 assert.match(pagina,/Abrir sucursal · pendiente de validación/);
 assert.match(pagina,/No registra pedidos, cobros, movimientos, inventario ni cierres/);
});
test('la vista mantiene lecturas Romo autorizadas, sin mezclar registros Uki',()=>{
 assert.match(pagina,/function ukiRomoRutaLecturaPanelUnicoQA\(ruta\)/);
 assert.match(pagina,/async function ukiConsultarRomoPanelUnicoQA\(\)/);
 assert.match(pagina,/async function ukiRomoConsultarAreaPanelUnicoQA\(area\)/);
 assert.match(pagina,/const pedidosGuardados=datos\.pedidos\.filter\(p=>p\?\.suc===ROMO_SUCURSAL_QA\)/);
 assert.match(pagina,/No ingresar en S\.suc, copiar registros a Uki ni ejecutar guardados/);
 assert.match(pagina,/data\.products\.length!==40/);
 assert.match(pagina,/romoConsultaSolicitudAreaQA/);
 assert.match(base,/function guardarEnLocalStorage\(\)/);
});

test('Caja y timbres de Romo solo se consultan desde la revisión cifrada',()=>{
 assert.match(pagina,/await import\('\.\/uki-romo-caja-consulta-qa\.mjs'\)/);
 assert.match(pagina,/consultarCajaRomoQA\(datos,\{fechaOperativa:diaCajaQA\}\)/);
 assert.match(pagina,/function ukiRomoCajaConsultaPanelUnicoHTMLQA\(\)/);
 assert.match(pagina,/timbresPendientesQA=datos\.pedidos\.filter/);
 assert.match(pagina,/No es un precierre ni un cierre definitivo/);
 assert.match(pagina,/No se pueden registrar desde esta vista/);
 assert.doesNotMatch(pagina,/window\.ukiRomoTransaccionesPanelUnicoQA/);
 assert.doesNotMatch(pagina,/guardarSobreCifrado/);
 const fuente=read('../firebase/uki-sushi-local.html');
 assert.match(fuente,/function ukiRomoCajaConsultaPanelUnicoHTMLQA\(\)/);
 assert.match(fuente,/await import\('\.\/uki-romo-caja-consulta-qa\.mjs'\)/);
});
