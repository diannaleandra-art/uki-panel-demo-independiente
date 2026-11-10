'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const api=require('../api/uki-carta-precios-live.js')._testing;
const base={name:'Promoción de 60 piezas',description:'5 rolls personalizados',price:16000,
 rollCount:5,piecesPerRoll:12,sauceCount:5,korokes:3,payments:['efectivo','transferencia']};
test('Las promociones clásicas siguen armándose con rolls como antes',()=>{
 const p=api.validPromo(base);
 assert.equal(p.rollCount,5);assert.equal(p.promoType,'sushi');assert.equal(p.customizable,true);
 assert.equal(p.piecesPerRoll,12);assert.equal(p.sauceCount,5);
});
test('Gohan, pizza y combo de preparación definida no requieren rolls ni piezas',()=>{
 for(const promoType of ['gohan','pizza','combo']){
  const p=api.validPromo({name:'Oferta por sucursal',description:'Incluye 1 gohan y 2 korokes',
   price:6000,promoType,customizable:false,payments:['efectivo'],rollCount:undefined,
   piecesPerRoll:undefined,sauceCount:undefined,korokes:undefined});
  assert.ok(p,promoType);
  assert.equal(p.rollCount,0);assert.equal(p.piecesPerRoll,12);
  assert.equal(p.sauceCount,0);assert.equal(p.korokes,0);
  assert.equal(p.customizable,false);assert.equal(p.promoType,promoType);
 }
 assert.equal(api.validPromo({...base,promoType:'cualquier cosa'}),null);
 assert.equal(api.validPromo({...base,promoType:'gohan',customizable:true}),null);
 assert.equal(api.validPromo({...base,promoType:'gohan',customizable:false,description:''}),null);
});
test('Panel distingue tipo de promoción y no pide rolls para gohan o pizza',()=>{
 const editor=fs.readFileSync(path.join(__dirname,'../firebase/uki-carta-precios-admin.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(editor));
 for(const id of ['ukiPromoType','ukiPromoSushiConfig','mostrarTipoPromo'])
  assert.ok(editor.includes(id),id);
 assert.match(editor,/if\(section\)section\.hidden=!sushi/);
 assert.match(editor,/promoType:tipo\.value,customizable:tipo\.value==='sushi'/);
 assert.match(editor,/promoType==='pizza'&&chosen==='serena'/);
});
test('API conserva sucursales y estados, y la migración no borra ventas',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../migrations/2026-11-10-uki-promos-por-tipo-qa.sql'),'utf8');
 assert.match(sql,/ADD COLUMN IF NOT EXISTS promo_type/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS customizable/);
 assert.match(sql,/promo_type IN \('gohan','pizza','combo'\)/);
 assert.doesNotMatch(sql,/\b(DROP TABLE|DELETE FROM|TRUNCATE|UPDATE public\.uki_)\b/i);
 const src=fs.readFileSync(path.join(__dirname,'../api/uki-carta-precios-live.js'),'utf8');
 assert.match(src,/p\.promoType==='pizza'&&branch==='serena'/);
 assert.match(src,/UPDATE public\.uki_carta_promos_custom_v1 SET visible=\$3/);
});
test('Listado conserva tipo, posibilidad de armado y visibilidad de la promoción',async()=>{
 const sql={query:async q=>{
  if(q.includes('uki_carta_promos_custom_v1'))return [{
   branch:'arica',sku:'monthly:gohan-promo-12345678',name:'Gohan más korokes',
   description:'1 gohan clásico y 2 korokes',price:6000,available:true,visible:true,
   published_at:new Date(),version:1,roll_count:0,pieces_per_roll:12,size:0,
   sauce_count:0,korokes:0,payments:['efectivo'],promo_type:'combo',customizable:false
  }];
  return [];
 }};
 const r=await api.listing(sql,'arica',true);
 const item=r.find(x=>x.sku==='monthly:gohan-promo-12345678');
 assert.ok(item);assert.equal(item.config.promoType,'combo');
 assert.equal(item.config.size,0);assert.equal(item.config.customizable,false);
 assert.equal(item.estadoPublicacion,'Publicada');
});


test('Una salsa opcional en combo: cliente elige soya o teriyaki, sin rolls',()=>{
 for(const p of ['gohan','pizza','combo']){
  const input={name:'Promo con una salsa',description:'Incluye gohan y dos korokes',
   price:6000,promoType:p,customizable:false,sauceCount:1,payments:['efectivo']};
  const result=api.validPromo(input);
  assert.ok(result,p);
  assert.equal(result.rollCount,0);assert.equal(result.sauceCount,1);
  assert.equal(result.customizable,false);
  assert.equal(api.validPromo({...input,sauceCount:2}),null);
  assert.equal(api.validPromo({...input,sauceCount:-1}),null);
 }
});
test('El panel permite seleccionar una salsa y conserva las de sushi',()=>{
 const editor=fs.readFileSync(path.join(__dirname,'../firebase/uki-carta-precios-admin.js'),'utf8');
 assert.match(editor,/ukiPromoComboSauce/);
 assert.match(editor,/Soya o teriyaki/i);
 assert.match(editor,/promoType==='sushi'\?numeroPromo\('ukiPromoSauces'\):numeroPromo\('ukiPromoComboSauce'\)/);
 assert.match(editor,/sauces\.max=show\?'20':'1'/);
});
