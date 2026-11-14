import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const src=new URL('../firebase/',import.meta.url);
const pub=new URL('../public/romo-qa/',import.meta.url);
const panel=readFileSync(new URL('uki-sushi-local.html',pub),'utf8');
test('La vista QA publicada es idéntica al panel Uki/Romo aprobado',()=>{
 assert.deepEqual(readFileSync(new URL('uki-sushi-local.html',src)),readFileSync(new URL('uki-sushi-local.html',pub)));
 assert.match(panel,/Romo’s Sushi La Serena/);
 assert.match(panel,/Uki Regimiento Arica/);
 assert.match(panel,/Uki La Serena/);
 assert.match(panel,/ROMO_PANEL_INTEGRACION_HABILITADA_QA/);
 assert.match(panel,/ROMO_INVENTARIO_ENDPOINT_QA/);
});
test('todos los recursos JS, MJS y SVG se publican idénticos',()=>{
 const names=readdirSync(src).filter(name=>/\.(?:js|mjs|svg)$/.test(name));
 assert.ok(names.length>=40,'Faltan recursos');
 for(const name of names){
  assert.deepEqual(readFileSync(new URL(name,src)),readFileSync(new URL(name,pub)),name);
 }
 for(const m of panel.matchAll(/<script[^>]*src=["']\.\/([^"'?#]+)/g)){
  assert.ok(names.includes(m[1]),'Falta script: '+m[1]);
 }
 for(const m of panel.matchAll(/import\(['"]\.\/([^"'?#]+)/g)){
  assert.ok(names.includes(m[1]),'Falta módulo: '+m[1]);
 }
});
test('inventario Uki y carta comercial Romo permanecen sin cambios',()=>{
 const root=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(root,/Uki Sushi · Inventario del turno/);
 assert.doesNotMatch(root,/Romo’s Sushi La Serena/);
 assert.match(panel,/const ROMO_SUCURSAL_QA="Romo’s Sushi La Serena"/);
 const api=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(api,/if\(config\.qaOnly\)return fail\(res,403/);
});
