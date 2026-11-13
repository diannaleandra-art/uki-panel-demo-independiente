import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clasificarErrorFichaQA,prepararEstadoConflictoQA} from '../public/uki-locales-conflictos-qa.mjs';
const form={nombre:'Romo para prueba',direccion:'Balmaceda 1612'};
test('concurrencia: conserva campos del formulario y ofrece recarga explícita',()=>{
 const state=prepararEstadoConflictoQA({
  mensaje:'La ficha cambió desde otro teléfono; revisa antes de guardar.',
  formulario:form,revision:1
 });
 assert.equal(state.conflicto,true);
 assert.equal(state.revisionAnterior,1);
 assert.match(state.mensaje,/No se guardaron tus modificaciones/);
 assert.match(state.mensaje,/Cargar versión actual/);
 assert.equal(form.nombre,'Romo para prueba');
});
test('otros fallos no se disfrazan de conflictos de edición',()=>{
 assert.equal(clasificarErrorFichaQA('WhatsApp chileno inválido').conflicto,false);
 assert.equal(clasificarErrorFichaQA('No se pudo completar.').conflicto,false);
 assert.equal(clasificarErrorFichaQA('Error 409: La ficha cambió').conflicto,true);
});
test('botón no recarga automáticamente ni permite reintentar con revisión vencida',()=>{
 const ui=readFileSync(new URL('../public/uki-owner-locales-qa.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/mi-administracion-duenos.html',import.meta.url),'utf8');
 assert.match(html,/id="ownerLocReloadConflict"/);
 assert.match(ui,/conflictoPendiente/);
 assert.match(ui,/if\(conflictoPendiente\)return/);
 assert.match(ui,/clasificarErrorFichaQA/);
 assert.match(ui,/by\('ownerLocReloadConflict'\)\.onclick/);
 assert.match(ui,/await consultar\(\)/);
});
