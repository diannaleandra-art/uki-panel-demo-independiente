'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/romo-panel-qa/index.html'),'utf8');
const begin=html.indexOf('async function ukiSeguimientoValidarAntesDeCifrarRomoQA(copia){');
const finish=html.indexOf('\nasync function ukiRomoGuardarOperacionQA(',begin);
assert.ok(begin>0&&finish>begin,'El mismo guardado central debe incluir la revisión');
const code=html.slice(begin,finish);
const branch='Romo’s Sushi La Serena';
const id='621bd292-2153-4160-9e85-375978e10352';
const base={id:34,suc:branch,medio:'Transferencia',medioEnvio:'Efectivo',
 pagado:false,estado:'Pendiente',cartaSolicitudRemotaId:id,subtotal:17000,total:17000};
function runner(older,{allow=false}={}){
 let calls=[];
 const has=p=>[p?.medio,p?.medioEnvio,...(p?.pagosProductos||[]).map(x=>x.medio),
  ...(p?.pagosEnvio||[]).map(x=>x.medio)].some(v=>
  String(v||'').trim().toLowerCase()==='transferencia');
 const S={suc:branch,pedidos:older};
 const guard=async(p,extra)=>{
  calls.push({p,extra});
  return allow;
 };
 const check=new Function('S','ROMO_SUCURSAL_QA',
  'ukiSeguimientoHayTransferenciaQA','ukiSeguimientoPermitirCerrarQA',
  code+'\nreturn ukiSeguimientoValidarAntesDeCifrarRomoQA;')(
    S,branch,has,guard);
 return {check,calls};
}
const cases=[
 ['pedido sin cambios',base,{},false,true,0],
 ['efectivo manual sin cambio de otro pedido',
  {...base,medio:'Efectivo',cartaSolicitudRemotaId:''},{},false,true,0],
 ['transferencia pendiente no se cobra',base,{pagado:true},false,false,1],
 ['transferencia pendiente no se elimina en una edición anterior al cobro',
  base,{medio:'Efectivo',pagado:false},false,false,0],
 ['transferencia manual sin solicitud no se elimina antes de cobrar',
  {...base,cartaSolicitudRemotaId:''},{medio:'Efectivo',pagado:false},false,false,0],
 ['transferencia confirmada se cobra',base,{pagado:true},true,true,1],
 ['pedido no se entrega con transferencia pendiente',base,{estado:'Entregado'},false,false,1],
 ['cambiar transferencia por efectivo no evita revisión',base,{medio:'Efectivo',pagado:true},false,false,0],
 ['ni una transferencia confirmada se reclasifica a efectivo en una edición normal',base,{medio:'Efectivo',pagado:true},true,false,0],
 ['editar monto de pedido ya pagado exige nueva comprobación',
  {...base,pagado:true},{total:19000},false,false,1],
 ['sin cambios financieros no consulta otra vez',
  {...base,pagado:true},{},false,true,0],
 ['transferencia mixta pendiente queda bloqueada',
  base,{pagado:true,medio:'Débito',
   pagosProductos:[{medio:'Transferencia',monto:9000}]},false,false,1],
 ['transferencia manual sin solicitud vinculada no inventa confirmación',
  {...base,cartaSolicitudRemotaId:''},{pagado:true},false,false,1]
];
for(const [name,original,change,allow,expected,calls] of cases){
 test(name,async()=>{
  const r=runner([original],{allow});
  const proposed={pedidos:[{...original,...change}]};
  if(expected)assert.equal(await r.check(proposed),true);
  else await assert.rejects(()=>r.check(proposed),/transferencia no está verificada/i);
  assert.equal(r.calls.length,calls);
  if(name.includes('cambiar transferencia'))assert.equal(r.calls.length,0);
 });
}
test('no permite duplicar identificadores de pedido al preparar el cifrado',async()=>{
 const r=runner([base]);
 await assert.rejects(()=>r.check({pedidos:[base,{...base,estado:'Entregado'}]}),
  /duplicado/i);
});
test('las dos rutas de guardado cifrado deben llamar a la guardia antes de persistir',()=>{
 const segment=html.slice(begin);
 const saveStart=html.indexOf('async function ukiRomoGuardarOperacionQA(',begin);
 const saveEnd=html.indexOf('async function ukiRomoConfirmarCobroQA(',saveStart);
 assert.ok(saveStart>=0&&saveEnd>saveStart);
 const central=html.slice(saveStart,saveEnd);
 assert.match(central,/await ukiSeguimientoValidarAntesDeCifrarRomoQA\(copia\);/);
 assert.match(central,/const res=await session\.guardar\(copia,\{guardarConjunto\}\);/);
 assert.ok(central.indexOf('await ukiSeguimientoValidarAntesDeCifrarRomoQA(copia)')<central.indexOf('const res=await session.guardar(copia,{guardarConjunto})'));
 assert.match(central,/guardarConjunto=paquete=>window\.ukiQAGuardarRomoConjunto/);
 assert.match(segment,/await ukiSeguimientoValidarAntesDeCifrarRomoQA\(clone\);[\s\S]{0,380}const saved=await session\.guardar\(clone\);/);
 assert.match(segment,/session\.estado\(\)\?\.revision!==anterior\.revision/);
 assert.match(segment,/session\.estado\(\)\?\.revision!==expected\.revision/);
});


test('un pedido de carta no pierde su identificador al editarlo antes del pago',async()=>{
 const r=runner([base]);
 await assert.rejects(()=>r.check({pedidos:[{...base,cartaSolicitudRemotaId:''}]}),
  /no se puede quitar su referencia/i);
 assert.equal(r.calls.length,0);
 await assert.rejects(()=>r.check({pedidos:[{...base,cartaSolicitudRemotaId:
  'f04cbd3f-b14c-40d3-bb79-9461fd5ad122'}]}),/no se puede quitar su referencia/i);
 assert.equal(r.calls.length,0);
});
test('el identificador alternativo de seguimiento tampoco se puede borrar',async()=>{
 const original={...base,seguimientoSolicitudId:id};
 const r=runner([original]);
 await assert.rejects(()=>r.check({pedidos:[{...original,seguimientoSolicitudId:''}]}),
  /no se puede quitar su referencia/i);
 assert.equal(r.calls.length,0);
});
