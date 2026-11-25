import test from 'node:test';
import assert from 'node:assert/strict';
import {verificarGuardadoUki} from '../firebase/uki-seguimiento-guardado-nube-v1.mjs';
for (const sucursal of ['Uki Regimiento Arica','Uki La Serena']) {
 const id='00000000-0000-4000-8000-000000000001';
 const p={id:1,suc:sucursal,cartaSolicitudRemotaId:id,pagado:true,estado:'Pendiente',medio:'Transferencia',total:12000,propinaModo:'otro',propinaPersonalizada:1000,medioPropina:'Transferencia'};
 const go=async (nueva,confirmada)=> {
  let llamadas=0;
  const promise=verificarGuardadoUki({anterior:{suc:sucursal,pedidos:[p]},nuevo:{suc:sucursal,pedidos:[{...p,propinaPersonalizada:nueva}]},sucursal,importes:x=>({total:x.total,montoTransferencia:x.total+x.propinaPersonalizada}),hayTransferencia:()=>true,manualValido:()=>false,consultar:async a=>{llamadas++;return {ok:true,storeId:a.storeId,orderId:a.id,pedidoInterno:'1',permitido:true,total:12000,montoTransferencia:confirmada};}});
  return {promise,llamadas:()=>llamadas};
 };
 test(sucursal+': cambio de propina exige validar nuevo abono',async()=>{const r=await go(2000,13000);await assert.rejects(r.promise,{code:'TRANSFERENCIA_PENDIENTE'});assert.equal(r.llamadas(),1);});
 test(sucursal+': cambio validado permite guardar',async()=>{const r=await go(2000,14000);assert.deepEqual(await r.promise,{ok:true,checked:1});assert.equal(r.llamadas(),1);});
 test(sucursal+': copia sin cambios no consulta de nuevo',async()=>{const r=await go(1000,13000);assert.deepEqual(await r.promise,{ok:true,checked:0});assert.equal(r.llamadas(),0);});
}
