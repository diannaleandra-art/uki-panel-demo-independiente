import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 crearCierrePanelUnicoRomoQA,
 ROMO_CIERRE_PANEL_UNICO_QA_HABILITADO
} from '../firebase/uki-romo-cierre-panel-unico-qa.mjs';

test('Cierre del panel conjunto permanece desactivado: ninguna llamada de red',async()=>{
 let llamadas=0;
 const controller=crearCierrePanelUnicoRomoQA({
  sesion:{
   disponible:()=>true,estado:()=>({storeId:'romo:serena',revision:2}),
   coincideEstadoOperativo:()=>true,
   prepararSobreParaSolicitud:async()=>({}),
   confirmarGuardadoAtomico:async()=>{}
  },
  obtenerVisible:()=>({revision:2,estado:{suc:'Romo’s Sushi La Serena'}}),
  validarEstado:()=>true,aplicarConfirmado:async()=>{},
  fetchFn:async()=>{llamadas++;throw Error('Nunca debe llamar');}
 });
 assert.equal(ROMO_CIERRE_PANEL_UNICO_QA_HABILITADO,false);
 assert.equal(controller.disponible(),false);
 await assert.rejects(controller.cerrar({confirmoCierreReal:true}),
  /no está habilitado/);
 assert.equal(llamadas,0);
});
test('Aun si se configura un piloto, exige confirmación explícita',async()=>{
 let llamadas=0;
 const controller=crearCierrePanelUnicoRomoQA({
  habilitado:true,
  sesion:{
   disponible:()=>true,estado:()=>({storeId:'romo:serena',revision:2}),
   coincideEstadoOperativo:()=>true,
   prepararSobreParaSolicitud:async()=>({}),
   confirmarGuardadoAtomico:async()=>{}
  },
  obtenerVisible:()=>({revision:2,estado:{suc:'Romo’s Sushi La Serena'}}),
  validarEstado:()=>true,aplicarConfirmado:async()=>{},
  fetchFn:async()=>{llamadas++;throw Error('Nunca debe llamar');}
 });
 await assert.rejects(controller.cerrar({}),/Confirma expresamente/);
 assert.equal(llamadas,0);
});
test('El cierre no se hace con session.guardar, ni con URL de otro proyecto',()=>{
 const client=readFileSync(new URL('../firebase/uki-romo-cierre-panel-unico-qa.mjs',import.meta.url),'utf8');
 const integration=readFileSync(new URL('../firebase/uki-romo-integracion-panel-qa.mjs',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/romo-cierre-definitivo-qa.js',import.meta.url),'utf8');
 const readonly=readFileSync(new URL('../public/romo-panel-qa/panel-unico-consulta-qa.html',import.meta.url),'utf8');
 assert.match(client,/const ENDPOINT='\/api\/romo-cierre-definitivo-qa'/);
 assert.doesNotMatch(client,/session\.guardar\(/);
 assert.match(client,/confirmarGuardadoAtomico/);
 assert.match(client,/bloqueadoHastaReabrir=true/);
 assert.match(integration,/window\.ukiRomoCierreDefinitivoPanelUnicoQA/);
 assert.match(api,/identity\.role!=='duenos'/);
 assert.match(api,/req\.method!=='POST'/);
 assert.match(api,/String\(req\.headers\?\.origin\|\|''\)!==cfg\.origin/);
 assert.doesNotMatch(readonly,/crearCierrePanelUnicoRomoQA/);
});
