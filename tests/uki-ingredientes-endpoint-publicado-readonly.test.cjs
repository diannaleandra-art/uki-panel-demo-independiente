'use strict';
// Comprobación HTTP de solo lectura. No usa credenciales ni hace pedidos.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const base='https://uki-sushi-inventario.vercel.app/api/uki-ingredientes-armado-live';
test('Estado público de la API de ingredientes: ambas sucursales',async()=>{
 const statuses=[];
 for(const branch of ['arica','serena']){
  let status=0, body=null;
  try{
   const res=await fetch(base+'?branch='+branch,{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(14000)});
   status=res.status;
   body=await res.json().catch(()=>null);
  }catch(e){
   console.log('API '+branch+': SIN ACCESO ('+String(e?.message||e).slice(0,100)+')');
   statuses.push('sin-acceso');continue;
  }
  if(status===200){
   assert.equal(body?.ok,true,'GET debe tener ok=true');
   assert.equal(body?.branch,branch,'GET debe respetar sucursal');
   assert.ok(Array.isArray(body?.items),'GET debe devolver items');
   console.log('API '+branch+': 200 LISTA · cantidad de ingredientes '+body.items.length);
   statuses.push('lista');
  }else if(status===404){
   console.log('API '+branch+': 404 · backend todavía NO PUBLICADO');
   statuses.push('sin-publicar');
  }else if(status===503){
   console.log('API '+branch+': 503 · backend presente pero todavía NO HABILITADO');
   statuses.push('desactivada');
  }else{
   console.log('API '+branch+': HTTP '+status+' · sin cambios');
   statuses.push('otro');
  }
 }
 console.log('RESULTADO READ-ONLY: '+statuses.join(' | ')+'; no se modificó Neon, Firebase ni caja.');
 if(statuses.every(x=>x==='lista'))console.log('API de ambas sucursales lista para prueba autenticada de administración');
 else console.log('Activación aplazada. Conservar editor oculto.');
});
