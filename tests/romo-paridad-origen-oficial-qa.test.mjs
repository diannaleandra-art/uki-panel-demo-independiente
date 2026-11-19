import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const dir=resolve(here,'../public/romo-panel-qa');
const html=readFileSync(resolve(dir,'index.html'),'utf8');
const manifest=JSON.parse(readFileSync(resolve(dir,'uki-paridad-manifiesto-qa.json'),'utf8'));

test('Romo preserva las 320 funciones de la versión oficial de Uki sin volver a construirlas',()=>{
 assert.equal(manifest.source.commit,'3274dbc1b66b676663b74d74ae40f84d251b3ee9');
 assert.equal(manifest.source.path,'firebase/uki-sushi-local.html');
 assert.equal(manifest.functions.length,320);
 for(const nombre of manifest.functions){
  const re=new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+'+nombre+'\\s*\\(');
  assert.match(html,re,'Falta función oficial Uki: '+nombre);
 }
});
test('Romo carga todos los 13 módulos visuales aprobados de Uki en su propia copia',()=>{
 assert.equal(manifest.externalScripts.length,13);
 for(const ruta of manifest.externalScripts){
  assert.ok(html.includes(ruta),'Falta módulo UIKit en HTML de Romo: '+ruta);
  const archivo=resolve(dir,ruta.replace(/^\.\//,'').split('?')[0]);
  assert.ok(archivo.startsWith(dir+'/'));
  assert.ok(existsSync(archivo),'No se copió módulo físico: '+ruta);
 }
});
test('La sección de cobro original de Uki no puede volver a quedar oculta',()=>{
 assert.match(html,/<div class="card" id="ukiPagoPedidoSoloUki">/);
 assert.doesNotMatch(html,/body\.romo-operativo-preparacion\s+#ukiPagoPedidoSoloUki\s*\{\s*display\s*:\s*none\s*!important/i);
 assert.match(html,/<b>Pago completo confirmado<\/b>/);
 assert.match(html,/Dividir entre varios medios/);
 assert.match(html,/ukiPropinaUI\(sub\)/);
});
test('Romo tiene adaptadores para aislamiento sin cargar ventas de Uki',()=>{
 assert.match(html,/const ROMO_SUCURSAL_QA=/);
 assert.match(html,/ukiRomoGuardarOperacionQA/);
 assert.match(html,/window\.ukiRomoSesionRemotaQA/);
 assert.match(html,/ukiRomoCajaPestanasQA\(\)/);
 assert.match(html,/ukiRomoPedidosPendientesHTMLQA\(\)/);
});
