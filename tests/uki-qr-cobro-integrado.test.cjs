'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../firebase/uki-sushi-local.html'),'utf8');
const start=html.indexOf('let ukiQRComprobandoCobro=false;');
const end=html.indexOf('async function ndGuardar(){',start);
assert.ok(start>0&&end>start,'No se encontró la validación previa al cobro QR');
const js=html.slice(start,end)+'\nukiQRPermitirCobroDefinitivo;';
const ID='123e4567-e89b-42d3-a456-426614174000';
const mesa={branch:'serena',mesa:2,estado:'abierta',total:2500,detalle:[{id:ID,subtotal:2500}]};
const draft=()=>({pagado:true,modalidad:'Consumo en local',mesaReferencia:'Mesa 2',
 qrSolicitudes:['MESA-'+ID.toUpperCase()],items:[{nombre:'4 korokes',cant:1,precio:2500}]});
function scenario(opts={}){
 const notices=[],urls=[];
 const responses=[
  {ok:true,cuentas:opts.cuentas??[mesa]},
  {ok:true,orders:opts.orders??[]}
 ];
 const state={
  UKI_MESAS_ENDPOINT:'https://menu.example/api/mesa-pedidos-live',
  UKI_MESAS_LIVE_URL:'https://menu.example/api/mesa-pedidos-live',
  UKI_MESAS_CUENTAS_LIVE_URL:'https://menu.example/api/mesa-cuentas-live',
  ukiMesaBranch:()=>opts.branch??'serena',
  ukiMesaNumeroReferencia:v=>Number(String(v).replace(/\D/g,''))||null,
  window:{
    ukiCancelacionNubeLista:()=>opts.synced??true,
    ukiMesasTokenEquipo:async()=>opts.token??'device-qa-test'
  },
  fetch:async(url)=>{
    urls.push(url);
    const data=responses.shift()??{ok:false,error:'Sin respuesta'};
    return {ok:!!data.ok,json:async()=>data};
  },
  AbortSignal:{timeout:()=>undefined},
  aviso:t=>notices.push(String(t))
 };
 const fn=vm.runInNewContext(js,state,{timeout:1000});
 return {fn,notices,urls};
}
test('Cuenta QR de La Serena pagable solo con todas sus rondas respaldadas y sin pendientes',async()=>{
 const q=scenario();assert.equal(await q.fn(draft()),true);assert.equal(q.urls.length,2);assert.deepEqual(q.notices,[]);
});
test('Nube no sincronizada: nunca consulta ni autoriza cobro',async()=>{
 const q=scenario({synced:false});assert.equal(await q.fn(draft()),false);assert.equal(q.urls.length,0);
});
test('Pedido QR con ronda faltante: bloquea pago y conserva caja',async()=>{
 const q=scenario({cuentas:[{...mesa,detalle:[]}]});assert.equal(await q.fn(draft()),false);
 assert.equal(q.urls.length,1);
});
test('Pedido nuevo pendiente en la misma mesa: bloquea cierre y cobro',async()=>{
 const q=scenario({orders:[{branch:'serena',mesa:2}]});assert.equal(await q.fn(draft()),false);
 assert.equal(q.urls.length,2);
});
test('Una cuenta de otra sucursal nunca permite cobro',async()=>{
 const q=scenario({cuentas:[{...mesa,branch:'arica'}]});assert.equal(await q.fn(draft()),false);
});
test('Falta de autorización del dispositivo bloquea cobro',async()=>{
 const q=scenario({token:null,synced:true});
 // Un token vacío no se debe aceptar como autorización.
 const blank=scenario({token:''});assert.equal(await blank.fn(draft()),false);
 assert.equal(blank.urls.length,0);
});
test('El cobro existente del panel se conserva y se valida antes de guardar',()=>{
 assert.match(html,/async function ndGuardar\(\)/);
 assert.match(html,/permitir=await ukiQRPermitirCobroDefinitivo\(D\)/);
 assert.match(html,/if\(!permitir\)return/);
 assert.match(html,/ukiQRComprobandoCobro=true/);
 assert.match(html,/ukiErrorDistribucionPago/);
 assert.match(html,/ukiSincronizarPropinaPedido/);
});

test('No registra en caja QR si el borrador cambia mientras validamos',()=>{
 assert.match(html,/const firma=JSON\.stringify\(\{sucursal:S\.suc,datos:D\}\)/);
 assert.match(html,/if\(firma!==JSON\.stringify\(\{sucursal:S\.suc,datos:D\}\)\)/);
 assert.match(html,/Cambió el estado de la nube mientras comprobábamos el pago/);
 assert.match(html,/La nube del panel debe estar sincronizada antes de registrar un pedido QR/);
});
