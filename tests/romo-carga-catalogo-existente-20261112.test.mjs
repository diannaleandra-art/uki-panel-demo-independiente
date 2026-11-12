import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizarCatalogoCompletoRomoQA,vistaCartaRomoQA} from '../lib/romo-editor-carta-compatibilidad-qa.mjs';
const file=JSON.parse(readFileSync(new URL('../data/romo-carta-origen-aprobado-20261112.json',import.meta.url),'utf8'));
const doc=normalizarCatalogoCompletoRomoQA(file.catalog);
test('El catálogo borrador de Romo se extrae de la carta existente sin sumar otros 500 pesos',()=>{
 assert.deepEqual(doc.products.map(x=>x.price),[8000,12000,16000,19000,21000,24000,26000]);
 assert.deepEqual(doc.promotions.map(x=>x.price),[7000,16000,18000]);
 assert.deepEqual(doc.promotions.map(x=>x.rollCount),[2,5,6]);
 assert.deepEqual(doc.promotions.map(x=>x.korokes),[2,3,0]);
 assert.deepEqual(doc.promotions.map(x=>x.sauceCount),[1,5,5]);
 assert.equal(doc.brand,'romo');assert.equal(doc.storeId,'romo:serena');
 assert.ok(doc.ingredients.length>=35);
 assert.ok([...doc.products,...doc.promotions,...doc.ingredients].every(x=>x.visible===false));
 assert.equal(vistaCartaRomoQA(doc).products.length,0);
 assert.equal(vistaCartaRomoQA(doc).promotions.length,0);
 assert.equal(JSON.stringify(doc).toLowerCase().includes('pizza'),false);
});
