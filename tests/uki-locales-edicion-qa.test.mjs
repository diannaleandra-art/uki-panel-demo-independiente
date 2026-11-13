import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararFichaParaGuardarQA} from '../public/uki-locales-edicion-qa.mjs';
const id='123e4567-e89b-42d3-a456-426614174001';
const form={negocio_id:id,sucursal_id:id,nombre:'Romo Sushi La Serena',
 direccion:'Balmaceda 1612, La Serena',horarios:'10:00 a 23:00',
 instagram:'',whatsapp:'',plantilla:'uki-motor',color:'#ac1824',logoUrl:'',portadaUrl:''};
const prev={negocio_id:id,sucursal_id:id,estado:'borrador',
 configuracion:{logoUrl:'https://imagenes.ejemplo.cl/logo.webp',portadaUrl:'https://imagenes.ejemplo.cl/portada.webp'}};
test('editar textos conserva las dos fotografías ya guardadas',()=>{
 const data=prepararFichaParaGuardarQA(form,prev);
 assert.equal(data.logoUrl,prev.configuracion.logoUrl);
 assert.equal(data.portadaUrl,prev.configuracion.portadaUrl);
 assert.equal(data.horarios,'10:00 a 23:00');
 assert.equal(form.logoUrl,'');
});
test('nueva sucursal conserva imágenes vacías sin heredar las de Romo',()=>{
 const data=prepararFichaParaGuardarQA(form);
 assert.equal(data.logoUrl,'');
 assert.equal(data.portadaUrl,'');
});
test('no reutilizar recursos de otra sucursal ni URL insegura',()=>{
 assert.throws(()=>prepararFichaParaGuardarQA(form,{...prev,sucursal_id:'otra'}));
 assert.throws(()=>prepararFichaParaGuardarQA(form,{...prev,configuracion:{...prev.configuracion,logoUrl:'http://example.com/a.png'}}));
 assert.throws(()=>prepararFichaParaGuardarQA(form,{...prev,configuracion:{...prev.configuracion,logoUrl:'https://user:pwd@example.com/logo'}}));
});
test('el administrador conserva imágenes y no repite Romo en lista',()=>{
 const owner=readFileSync(new URL('../public/uki-owner-locales-qa.mjs',import.meta.url),'utf8');
 assert.match(owner,/prepararFichaParaGuardarQA/);
 assert.match(owner,/drafts\.some\(r=>r\.store_id===storeId\)/);
 assert.match(owner,/id="ownerLocLogo"/);
});
