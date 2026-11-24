import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registrarSolicitudRomo} from '../lib/romo-solicitudes-carta-qa.mjs';

const STORE='romo:serena',key='a'.repeat(32),codigoPedido='RS-AABBCC112233';
const cotizacion={
 branch:'serena',mode:'retiro',payment:'transferencia',revision:1,
 baseSha256:'a'.repeat(64),subtotalProductos:2500,deliveryFee:0,
 items:[{kind:'dish',productId:'korokes-4',qty:1}]
};
const linea='1 × 4 korokes\nImporte línea: $2.500';
const mensaje='*ROMO’S SUSHI*\nCliente: Ana\nReferencia de carta: '+codigoPedido+
 '\n*COCINA*\n'+linea+'\n\n*ENTREGA*\nRETIRO · Romo’s Sushi La Serena'+
 '\n\n*PAGO*\nPago: Transferencia\nTotal productos: $2.500';
const body={storeId:STORE,key,codigoPedido,cliente:'Ana',telefono:'+56911111111',
 mensaje,totalIndicado:2500,cotizacion};
const cotizacionHash=createHash('sha256').update(JSON.stringify(cotizacion)).digest('hex');
const row=(patch={})=>({
 id:'4af723dc-238d-4820-8b99-0a7dd8292512',codigo_pedido:codigoPedido,
 cliente:'Ana',mensaje,total_indicado:2500,estado:'pendiente',
 datos:{cotizacionHash},...patch
});
const cotizador=async()=>({
 ok:true,verified:true,storeId:STORE,countsAsSale:false,
 revision:1,baseSha256:'a'.repeat(64),total:2500,
 subtotalProductos:2500,deliveryFee:0,cocinaLineas:[linea],
 detalles:[{totalLinea:2500}]
});
const ipHash='b'.repeat(64);

function simulate({selectFirst=[],selectAfter=[row()],insertRows=[]}={}){
 let lookups=0,inserts=0,calls=0;
 const db={async query(sql){
  calls++;
  if(sql.startsWith('SELECT id,codigo_pedido'))return (++lookups===1?selectFirst:selectAfter);
  if(sql.startsWith('SELECT COUNT(*)'))return [{n:0}];
  if(sql.startsWith('WITH lock_rev')){inserts++;return insertRows;}
  throw Error('Consulta no esperada');
 }};
 return {db,stats:()=>({lookups,inserts,calls})};
}

test('dos POST simultáneos: segundo obtiene la MISMA solicitud pendiente sin otra inserción',async()=>{
 const {db,stats}=simulate();
 const r=await registrarSolicitudRomo({db,body,ipHash,cotizador});
 assert.deepEqual(r,{ok:true,storeId:STORE,estado:'pendiente',repetido:true,
  countsAsSale:false,whatsappConfirmado:false,
  trackingId:row().id});
 assert.deepEqual(stats(),{lookups:2,inserts:1,calls:4});
});

test('la repetición habitual de solicitud existente no cotiza ni escribe',async()=>{
 const {db,stats}=simulate({selectFirst:[row()]});
 const r=await registrarSolicitudRomo({db,body,ipHash,
  cotizador:async()=>{throw Error('No debía cotizar otra vez')}});
 assert.equal(r.repetido,true);
 assert.equal(r.estado,'pendiente');
 assert.deepEqual(stats(),{lookups:1,inserts:0,calls:1});
});

test('un código repetido pero con importe distinto no es reconocido como el mismo pedido',async()=>{
 const {db,stats}=simulate({selectAfter:[row({total_indicado:3500})]});
 await assert.rejects(registrarSolicitudRomo({db,body,ipHash,cotizador}),
  e=>e.status===409&&/ya existe o cambió/.test(e.message));
 assert.equal(stats().inserts,1);
});

test('si no hay fila después del conflicto, informa error y nunca inventa confirmación',async()=>{
 const {db}=simulate({selectAfter:[]});
 await assert.rejects(registrarSolicitudRomo({db,body,ipHash,cotizador}),
  e=>e.status===409);
});

test('si la solicitud ya fue aceptada, la respuesta no vuelve a tratarla como pendiente',async()=>{
 const {db}=simulate({selectFirst:[row({estado:'aceptada'})]});
 const r=await registrarSolicitudRomo({db,body,ipHash,cotizador});
 assert.equal(r.estado,'aceptada');
 assert.equal(r.repetido,true);
 assert.equal(r.countsAsSale,false);
});
