'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../api/romo-promociones-publicas-qa.js');
const data={
 storeId:'romo:serena',revision:11,gestion:{promotions:[
  {sku:'monthly:romoq-036c69f1-1769-45c4-8aaa-2d814c206b2a',
   name:'Familiar 108 piezas la más vendida',description:'9 rolls. * Pollo * Kanikama',
   price:27000,available:true,photoVersion:1,
   config:{promoType:'sushi',rollCount:9,piecesPerRoll:12,sauceCount:8,
    korokes:0,payments:['efectivo','transferencia']}}
 ]}};
test('Promoción familiar publicada se lee desde Neon sin cargar la carta base',()=>{
 const promos=api._test.proyectarPromociones(data,11);
 assert.equal(promos.length,1);
 assert.equal(promos[0].sku,data.gestion.promotions[0].sku);
 assert.equal(promos[0].price,27000);
 assert.equal(promos[0].config.rollCount*promos[0].config.piecesPerRoll,108);
 assert.equal(promos[0].config.sauceCount,8);
 assert.equal(promos[0].photoVersion,1);
});
test('Promociones retiradas permanecen fuera de la carta sin borrar el historial',()=>{
 const copy=structuredClone(data);
 copy.gestion.promotions[0].available=false;
 assert.deepEqual(api._test.proyectarPromociones(copy,11),[]);
 assert.equal(copy.gestion.promotions.length,1);
});
test('No es posible leer una revisión que no coincide con Neon',()=>{
 assert.throws(()=>api._test.proyectarPromociones(data,10),/Revisión comercial no verificada/);
});
test('Ningún registro de clientes, borradores ni campos privados aparece en la respuesta',()=>{
 const copy=structuredClone(data);
 copy.uid='duena-test';
 copy.clientes=[{telefono:'privado'}];
 copy.gestion.promotions[0].editadoPor='responsable-test';
 const res=api._test.proyectarPromociones(copy,11);
 const json=JSON.stringify(res);
 for(const privateValue of ['duena-test','privado','responsable-test'])assert.equal(json.includes(privateValue),false);
});
test('Rechazar productos inválidos y duplicados antes de mostrarlos',()=>{
 const bad=structuredClone(data);
 bad.gestion.promotions[0].price=-1;
 assert.throws(()=>api._test.proyectarPromociones(bad,11),/inválida/);
 const duplicate=structuredClone(data);
 duplicate.gestion.promotions.push(duplicate.gestion.promotions[0]);
 assert.throws(()=>api._test.proyectarPromociones(duplicate,11),/inválida/);
});
