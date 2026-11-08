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

test('Preview de ingredientes: comprobar estado por sucursal sin modificar datos',async()=>{
 const preview='https://uki-sushi-inventario-c3y2or7r4-diannaleandra-7046.vercel.app/api/uki-ingredientes-armado-live';
 for(const branch of ['arica','serena']){
  try{
   const r=await fetch(preview+'?branch='+branch,{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(13000)});
   console.log('PREVIEW '+branch+': HTTP '+r.status);
   if(r.status===200){
    const json=await r.json();
    assert.equal(json?.branch,branch);
    assert.equal(json?.ok,true);
    assert.ok(Array.isArray(json?.items));
    console.log('PREVIEW '+branch+' tiene API lista para verificar administración, no para publicar aún.');
   }else if(r.status===401||r.status===403)console.log('Preview protegido. No modificar acceso.');
   else if(r.status===503)console.log('API presente pero deshabilitada en preview.');
   else if(r.status===404)console.log('Endpoint aún no disponible en preview.');
  }catch(e){
   console.log('PREVIEW '+branch+' inaccesible: '+String(e?.message||e).slice(0,120));
  }
 }
});
