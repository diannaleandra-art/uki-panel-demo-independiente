import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
test('Romo usa selector, Google, mismo botón Guardar y bandeja en Pedidos',()=>{
 assert.match(s,/ROMO_PANEL_INTEGRACION_HABILITADA_QA=location\.hostname===/);
 assert.match(s,/async function ukiRomoAbrirEnPanelQA\(password\)/);
 assert.match(s,/await ukiRomoAbrirEnPanelQA\(pass\)/);
 assert.match(s,/return ukiRomoGuardarPedidoQA\(\)/);
 assert.match(s,/function ukiRomoBandejaPanelHTML\(\)/);
 assert.match(s,/ukiRomoAbrirSolicitudQA/);
});
test('el cifrado y las credenciales siguen siendo del navegador Uki',()=>{
 assert.match(s,/window\.ukiInventarioToken\?\.\(\)/);
 assert.match(s,/ukiClaveBackup\(password,salt\)/);
 assert.match(s,/abrirLocal\(JSON\.stringify\(snapshot\),suc,pass\)/);
 assert.match(s,/cifrarLocal\(datos,ROMO_SUCURSAL_QA,key,salt\)/);
 assert.match(s,/validarEstadoSucursal\(estado,ROMO_SUCURSAL_QA\)/);
});
test('Romo no guarda localStorage de Uki ni abre caja sin confirmación',()=>{
 assert.match(s,/claveSesion=null;saltSesion=null;sucursalSesion=null/);
 assert.match(s,/if\(S\.suc===ROMO_SUCURSAL_QA/);
 assert.match(s,/if\(!ROMO_PANEL_INTEGRACION_HABILITADA_QA\)/);
 assert.match(s,/Función Romo pendiente de confirmación central/);
});
test('las dos sucursales originales mantienen su ruta de guardado',()=>{
 assert.match(s,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(s,/async function entrarDatosSucursal\(s,password\)/);
 assert.match(s,/const nuevoPedido=\{id:idNuevo/);
});
