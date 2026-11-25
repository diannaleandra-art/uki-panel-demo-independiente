'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {check}=require('../lib/seguimiento-firebase-lectura-revision-qa.cjs');
const token='Bearer a.b.c';
test('Diagnóstico usa solamente GET de los dos manifiestos y no devuelve sus datos',async()=>{
 const calls=[];
 const result=await check({authorization:token,fetchFn:async(url,options)=>{
  calls.push(url);assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,token);
  const branch=url.includes('/regimiento?')?'regimiento':'la-serena';
  const data={name:'projects/uki-panel-f4909/databases/(default)/documents/uki_operacion_v1/'+branch,fields:{branch:{stringValue:branch},schemaVersion:{integerValue:'2'},rev:{integerValue:'8'},generacion:{stringValue:'a'.repeat(32)},totalBloques:{integerValue:'5'}}};
  return {ok:true,text:async()=>JSON.stringify(data)};
 }});
 assert.equal(calls.length,2);
 assert.deepEqual(result,[{storeId:'uki:arica',estado:'lectura_correcta'},{storeId:'uki:serena',estado:'lectura_correcta'}]);
});
test('Distingue permiso denegado y revisión inexistente sin abrir otra sucursal',async()=>{
 const result=await check({authorization:token,fetchFn:async url=>({ok:false,status:url.includes('/regimiento?')?403:404})});
 assert.deepEqual(result,[{storeId:'uki:arica',estado:'sin_permiso'},{storeId:'uki:serena',estado:'sin_manifiesto'}]);
});
test('No acepta tokens de equipo ni respuestas manipuladas',async()=>{
 await assert.rejects(check({authorization:'Bearer UKIDEV1.a.b'}),{code:403});
 const result=await check({authorization:token,fetchFn:async()=>({ok:true,text:async()=>JSON.stringify({fields:{rev:{integerValue:'8'}}})})});
 assert.ok(result.every(x=>x.estado==='formato_no_valido'));
});
