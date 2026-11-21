'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../public/romo-panel-qa/romo-carta-gestion-completa-qa.js'),'utf8');
const a=src.indexOf(' async function eliminarPromocionPropia('),b=src.indexOf(' function promotionForm(',a);
const p={sku:'promo:036c69f1-1769-45c4-8aaa-2d814c206b2a',name:'Promoción de prueba',_base:false};
async function demo({published=true,failWithdraw=false,failDelete=false,confirm=true}={}){
 let exists=true,rev=4,visible=published,actions=[],messages=[];
 const state={busy:false,admin:{revision:4}};
 const sku='monthly:romoq-'+p.sku.slice(6);
 const ctx={state,canWrite:()=>true,window:{confirm:()=>confirm},status:x=>messages.push(x),load:async()=>{},
  request:async(method,body)=>{
   if(method==='GET')return {revision:rev,publicacionHabilitada:true,data:{promotions:exists?[p]:[]},publishedPromotions:visible?[{sku}]:[]};
   actions.push(body.action);assert.equal(visible,false);assert.equal(body.expectedRevision,4);
   if(failDelete)throw Error('fallo simulado');
   exists=false;rev++;return {guardado:true,auditado:true,revision:rev};
  },
  publicarPromocion:async(id,retirar,revision)=>{assert.equal(id,p.sku);assert.equal(retirar,true);assert.equal(revision,4);actions.push('retirar');if(failWithdraw)throw Error('fallo simulado');visible=false;}
 };
 const run=vm.runInNewContext(src.slice(a,b)+'\neliminarPromocionPropia;',ctx,{timeout:1000});
 await run(p);return {exists,visible,actions,messages,busy:state.busy};
}
test('La ficha publicada muestra eliminar y retira antes de borrar',async()=>{
 assert.ok(a>0&&b>a);assert.match(src,/button\('Eliminar promoción',\(\)=>void eliminarPromocionPropia\(p\)/);
 const r=await demo();assert.deepEqual(r.actions,['retirar','promotion-delete']);assert.equal(r.exists,false);assert.equal(r.visible,false);assert.equal(r.busy,false);
});
test('Borrador se elimina directamente y cancelar no escribe',async()=>{
 assert.deepEqual((await demo({published:false})).actions,['promotion-delete']);
 assert.deepEqual((await demo({confirm:false})).actions,[]);
});
test('Fallo de retirada impide borrar; fallo posterior se informa sin falso éxito',async()=>{
 const x=await demo({failWithdraw:true});assert.deepEqual(x.actions,['retirar']);assert.equal(x.exists,true);assert.equal(x.visible,true);
 const y=await demo({failDelete:true});assert.equal(y.exists,true);assert.equal(y.visible,false);assert.match(y.messages.at(-1),/se retiró de la carta/);
});
