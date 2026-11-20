import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const uki=read('../firebase/uki-sushi-local.html');
const romo=read('../public/romo-panel-qa/index.html');
const inventory=read('../public/romo-panel-qa/uki-inventario-admin-embebido.js');
const full=read('../public/romo-panel-qa/romo-carta-gestion-completa-qa.js');
const legacy=read('../public/romo-panel-qa/romo-carta-editor-seguro-qa.js');

test('Todas las funciones con nombre del panel oficial Uki siguen presentes en el clon, sin suprimir funciones previas',()=>{
 const functions=s=>new Set([...s.matchAll(/(?:async )?function\s+(uki[\w]+)\s*\(/g)].map(m=>m[1]));
 const origin=functions(uki),copied=functions(romo);
 const missing=[...origin].filter(name=>!copied.has(name));
 assert.deepEqual(missing,[]);
 assert.ok(origin.size>=200,'La comparación debe incluir el panel Uki completo');
});

test('Navegación Romo contiene pedidos, alta, timbres, caja e inventario sin ofrecer mesas QR',()=>{
 assert.match(romo,/const VISTAS=\[\["inicio","Inicio"/);
 assert.match(romo,/\["pedidos","Pedidos"/);
 assert.match(romo,/\["nuevo","Nuevo"/);
 assert.match(romo,/\["clientes","Timbres"/);
 assert.match(romo,/\["caja","Caja"/);
 assert.match(romo,/\['inicio','pedidos','nuevo','caja','clientes','inventario','promos'\]/);
 assert.match(romo,/function ukiRomoCajaPestanasQA\(/);
 for(const name of ["resumen","movimientos","precierre","cierre","historial","semana","acumulada"])
  assert.match(romo,new RegExp(name+':\\(\\)=>|\\["'+name+'","'),'No está la pestaña de Caja '+name);
});

test('El formulario Romo conserva confirmación de cobro total y distribución de pagos, sin atribuirlo a Uki',()=>{
 assert.match(romo,/Pago completo confirmado/);
 assert.match(romo,/function ukiRomoCamposCobroQA\(/);
 assert.match(romo,/function ukiRomoLeerDistribucionQA\(/);
 assert.match(romo,/async function ukiRomoConfirmarCobroQA\(/);
 assert.match(romo,/function ukiRomoTimbresPanelQA\(/);
 assert.match(romo,/async function ukiRomoGuardarOperacionQA\(/);
 assert.match(romo,/function ukiRomoCajaPestanasQA\(/);
 assert.match(romo,/function ukiRomoCajaHistorialHTMLQA\(/);
});

test('Mi Administración indica el cierre confirmado de Romo en Preview, sin enlazar contabilidad oficial desde el bloque Romo',()=>{
 assert.match(romo,/Los cierres definitivos confirmados de Romo ya se consultan en Mi Administración/);
 assert.doesNotMatch(romo,/La integración de cierres de Romo con Mi Administración está pendiente/);
 assert.match(romo,/Esta vista de pruebas es de solo lectura/);
 assert.match(romo,/romoAccesoDuenosQA/);
});

test('Inventario Romo nunca ofrece el enlace Uki al primer render antes de cargar funciones',()=>{
 assert.match(inventory,/id="ukiInvWorkerAccess" '\+\(panelBranch\(\)==='romo'\?'hidden ':'\)/);
 assert.match(inventory,/if\(\$\('ukiInvWorkerAccess'\)\)\$\('ukiInvWorkerAccess'\)\.hidden=active==='romo'/);
 assert.match(inventory,/href="\/romo-panel-qa\/romo-inventario-trabajador\.html"/);
 assert.match(inventory,/async function requestRomo\(/);
 assert.match(inventory,/fetch\('\/api\/romo-inventario-qa'/);
});

test('Categorias y promociones de Romo tienen controles reales en gestión completa y no textos falsos de pendientes',()=>{
 for(const key of ['category-create','category-rename','category-delete','category-assign'])
  assert.ok(full.includes("'"+key+"'"),key);
 assert.match(full,/function renderCategories\(/);
 assert.match(full,/function renderProducts\(/);
 assert.match(full,/function renderIngredients\(/);
 assert.match(legacy,/Para crear, renombrar, asignar o eliminar usa Gestión completa de carta/);
 assert.doesNotMatch(legacy,/Crear, renombrar y eliminar categorías exige completar el guardado protegido/);
 assert.doesNotMatch(legacy,/su creación, fotografías y descuentos siguen pendientes/);
});
