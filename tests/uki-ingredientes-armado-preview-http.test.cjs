'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const api='https://uki-sushi-inventario-hqdya2vb5-diannaleandra-7046.vercel.app/api/uki-ingredientes-armado-live';
test('Neon QA acepta consulta pública de ingredientes, no producción',async()=>{
 for(const branch of ['arica','serena']){
  const r=await fetch(api+'?branch='+branch,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(14000)});
  const j=await r.json();
  assert.equal(r.status,200,'GET '+branch+' (status '+r.status+'): '+String(j.error||''));
  assert.equal(j.ok,true);assert.equal(j.branch,branch);
  assert.ok(Array.isArray(j.items));
  assert.equal(j.items.some(x=>x.name==='Frutilla QA'),false,'No conservar valores ficticios en QA');
 }
});
test('Nadie puede guardar ingredientes sin iniciar sesión como administrador',async()=>{
 const r=await fetch(api,{method:'POST',headers:{'content-type':'application/json','Origin':'https://diannaleandra-art.github.io'},
 body:JSON.stringify({branch:'arica',action:'crear',item:{name:'Prueba no autorizada',category:'vegetal',surfaces:['classic'],surcharge:0,available:true}}),
 signal:AbortSignal.timeout(14000)});
 const j=await r.json();
 assert.equal(r.status,403,'No permitir POST anónimo: '+String(j.error||''));assert.equal(j.ok,false);
});
