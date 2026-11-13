import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validarPedidoGuardadoEnEstadoRomoQA} from '../firebase/uki-romo-operativo-qa.mjs';

const suc='Romo’s Sushi La Serena';
const requestId='00000000-0000-4000-8000-000000000001';
const claimToken='00000000-0000-4000-8000-000000000002';
const solicitudCarta={requestId,claimToken,pedidoId:'1234'};
const pedido={id:1234,suc,cartaSolicitudRemotaId:requestId,
 cartaReservaToken:claimToken,productos:[{nombre:'Sushi 24 piezas',cantidad:1,precioUnit:8000}]};
const estado={suc,pedidos:[pedido]};

test('enlaza el pedido REAL del estado Romo con ID y token de la misma reserva',()=>{
 const valid=validarPedidoGuardadoEnEstadoRomoQA(estado,solicitudCarta);
 assert.deepEqual(valid,solicitudCarta);
 assert.notEqual(valid,solicitudCarta);
 assert.equal(Object.isFrozen(valid),true);
});
test('una solicitud no se confirma si no hay pedido guardado en el estado',()=>{
 for(const wrong of [
  {suc,pedidos:[]},
  {suc,pedidos:[{...pedido,productos:[]}]},
  {suc:'Uki La Serena',pedidos:[pedido]},
  {suc,pedidos:[{...pedido,id:4321}]},
  {suc,pedidos:[{...pedido,cartaReservaToken:'token-falso'}]},
  {suc,pedidos:[{...pedido,cartaSolicitudRemotaId:'otro'}]},
  {suc,pedidos:[pedido,pedido]}
 ])assert.throws(()=>validarPedidoGuardadoEnEstadoRomoQA(wrong,solicitudCarta));
});
test('no acepta otra sucursal ni campos añadidos por el navegador',()=>{
 for(const invalid of [
  {...solicitudCarta,requestId:'uki:serena'},
  {...solicitudCarta,claimToken:'x'},
  {...solicitudCarta,pedidoId:'ABC'},
  {...solicitudCarta,paid:true},
  {...solicitudCarta,estado:'aceptada'},
  {...solicitudCarta,storeId:'uki:arica'}
 ])assert.throws(()=>validarPedidoGuardadoEnEstadoRomoQA(estado,invalid));
});
test('guardado remoto sigue cerrado por defecto y nunca envía el pedido en claro',()=>{
 const src=readFileSync(new URL('../firebase/uki-romo-operativo-qa.mjs',import.meta.url),'utf8');
 assert.match(src,/const ROMO_OPERATIVO_ENDPOINT_QA='';/);
 assert.match(src,/validarPedidoGuardadoEnEstadoRomoQA\(estado,solicitudCarta\)/);
 assert.match(src,/const payload=\{expectedRevision:revision,snapshot\}/);
 assert.match(src,/if\(vinculada\)payload.solicitudCarta=vinculada/);
 assert.match(src,/if\(result\.revision!==revision\+1\)/);
 assert.doesNotMatch(src,/body:JSON\.stringify\(estado\)|payload\.pedidos=/);
});
