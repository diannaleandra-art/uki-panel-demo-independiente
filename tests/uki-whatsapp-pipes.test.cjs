'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const pipes=require('../lib/uki-whatsapp-pipes.cjs');
const core=require('../lib/uki-whatsapp-supervision.cjs');
const key='whsec_'+crypto.randomBytes(32).toString('base64');
const id='evt_abc1234567',timestamp=String(Math.floor(Date.now()/1000));
function sign(raw,idOverride=id,ts=timestamp){
 const h=crypto.createHmac('sha256',Buffer.from(key.slice(6),'base64'))
  .update(idOverride+'.'+ts+'.').update(raw).digest('base64');
 return {'webhook-id':idOverride,'webhook-timestamp':ts,'webhook-signature':'v1,'+h};
}
const map=JSON.stringify({'pn_romo_1':'romo:serena','pn_uki_2':'uki:arica'});
const message={id:'wamid.abc123',timestamp:'1795456800',type:'text',text:{body:'60 piezas pollo'}};
function event(field='messages',pool='pn_romo_1'){
 return {id,field,pipes:{appId:'app_test',poolNumberId:pool},
  whatsapp:{messaging_product:'whatsapp',metadata:{phone_number_id:'1234567890'},
   ...(field==='messages'?{messages:[{...message,from:'56912345678'}]}:
    {message_echoes:[{...message,from:'56911111111',to:'56912345678'}]})}};
}
test('firma HMAC válida y alteración rechazada',()=>{
 const raw=Buffer.from(JSON.stringify(event())),headers=sign(raw);
 assert.equal(pipes.verifyPipes(raw,headers,key),true);
 assert.equal(pipes.verifyPipes(Buffer.from('alterado'),headers,key),false);
 assert.equal(pipes.verifyPipes(raw,{...headers,'webhook-signature':'v1,invalida'},key),false);
});
test('no acepta webhooks caducados o sin firma',()=>{
 const raw=Buffer.from('{}'),ts=String(Math.floor(Date.now()/1000)-400);
 assert.equal(pipes.verifyPipes(raw,sign(raw,id,ts),key),false);
 assert.equal(pipes.verifyPipes(raw,{},key),false);
});
test('entrada de cliente Romo',()=>{
 const p=pipes.parsePipesEnvelope(event(),map);
 assert.equal(p.messages.length,1);
 assert.equal(p.messages[0].sucursal,'romo:serena');
 assert.equal(p.messages[0].direction,'cliente');
 assert.equal(p.messages[0].body,'60 piezas pollo');
});
test('eco de mensaje agendadora Romo',()=>{
 const p=pipes.parsePipesEnvelope(event('smb_message_echoes'),map);
 assert.equal(p.messages.length,1);
 assert.equal(p.messages[0].direction,'agendadora');
 assert.equal(p.messages[0].customer,'56912345678');
});
test('otros locales no habilitados durante piloto',()=>{
 const p=pipes.parsePipesEnvelope(event('messages','pn_uki_2'),map);
 assert.equal(p.messages.length,0);
 assert.equal(p.ignored,true);
});
test('identificador BSUID no se convierte a un teléfono inventado',()=>{
 const e=event();e.whatsapp.messages[0].from='US.13491208655302741918';
 const p=pipes.parsePipesEnvelope(e,map);
 assert.equal(p.messages[0].customer,'US.13491208655302741918');
 assert.ok(core.customerHash(p.messages[0].customer,crypto.randomBytes(32).toString('base64')));
});
test('eventos de sistema no crean conversaciones',()=>{
 assert.equal(pipes.parsePipesEnvelope({event:'test'},map).test,true);
 assert.equal(pipes.parsePipesEnvelope({event:'number.onboarded',data:{numberId:'pn_romo_1'}},map).ignored,true);
});
test('diferencias de piezas exigen vinculación verificada',()=>{
 assert.equal(core.comparePieces('60 piezas',{piezas:36}).status,'sin_vinculo');
 assert.equal(core.comparePieces('60 piezas',{piezas:36,vinculo_verificado:true}).status,'revisar');
});
