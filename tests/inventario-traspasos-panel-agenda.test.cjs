'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const bitacora=require('../lib/inventario-justificaciones-v1.cjs');
const item={sku:'ingredient:proteina-pollo',stock_unit:'kg'};
const request_id='00000000-0000-0000-0000-000000000012';
const base={request_id,sku:item.sku,tipo:'traspaso_salida',cantidad:500,unidad:'g',responsable:'  Nombre   Apellido  ',motivo:'Reposición',contraparte:'uki:serena',folio:'  tr-f102  '};
test('agenda escribe en la misma bodega y convierte la unidad sin alterar existencias',()=>{
 const row=bitacora.validatePanelTransfer('arica',base,item,true);
 assert.deepEqual([row.store,row.kind,row.quantity,row.unit,row.ref,row.worker],['uki:arica','traspaso_salida',0.5,'kg','TR-F102','Agenda · Nombre Apellido']);
 const r=bitacora.validatePanelTransfer('serena',{...base,tipo:'traspaso_entrada',contraparte:'uki:arica'},item,true);
 assert.equal(r.store,'uki:serena');
 assert.equal(r.kind,'traspaso_entrada');
 assert.throws(()=>bitacora.validatePanelTransfer('serena',base,item,true),e=>e.status===400);
 assert.throws(()=>bitacora.validatePanelTransfer('arica',{...base,contraparte:'romo:serena'},item,true),e=>e.status===400);
 assert.throws(()=>bitacora.validatePanelTransfer('arica',{...base,responsable:{name:'No válido'}},item,true),e=>e.status===400);
 assert.throws(()=>bitacora.validatePanelTransfer('arica',{...base,tipo:'personal'},item,true),e=>e.status===400);
});
test('cocina y agenda no pueden repetir el mismo folio, dirección e insumo',async()=>{
 let stored=null;
 const db={query:async(q,p)=>{
  assert.match(q,/inventario_justificaciones_v1/);
  assert.doesNotMatch(q,/\bUPDATE\b|pedidos|caja|stock/);
  if(q.startsWith('INSERT')){
   const [store_id,request_id,sku,kind,quantity,unit,reason,counterparty,transfer_ref,worker]=p;
   if(stored&&(stored.request_id===request_id||stored.store_id===store_id&&stored.sku===sku&&stored.kind===kind&&stored.transfer_ref===transfer_ref))return [];
   stored={store_id,request_id,sku,kind,quantity,unit,reason,counterparty,transfer_ref,worker};return [stored];
  }
  return stored?[stored]:[];
 }};
 const panel=bitacora.validatePanelTransfer('arica',base,item,true);
 assert.equal((await bitacora.save(db,panel)).registered,true);
 assert.equal((await bitacora.save(db,panel)).duplicated,true);
 const worker=bitacora.validate('uki:arica',{...base,request_id:'00000000-0000-0000-0000-000000000022'},item,'Nombre Cocina');
 await assert.rejects(bitacora.save(db,worker),e=>e.status===409);
 const recent=await bitacora.recentTransfers({query:async(q,p)=>{
  assert.match(q,/store_id=\$1 AND kind IN \('traspaso_salida','traspaso_entrada'\)/);
  assert.deepEqual(p,['uki:serena']);return [];
 }},'serena');
 assert.deepEqual(recent,[]);
});
test('WhatsApp del detalle lleva sucursal, fecha, estado y resumen sin datos privados',()=>{
 const js=fs.readFileSync('firebase/uki-consumo-panel-v1.js','utf8');
 const box={document:{readyState:'loading',addEventListener(){}}};
 vm.runInNewContext(js.replace('function mountReport(calendar){','globalThis.previewCompact=compactReport;\nfunction mountReport(calendar){'),box);
 const s=box.previewCompact({prepared:[{store:'uki:arica',motivo:'venta',ingredient:'Pollo',grams:750}],
  rows:[{name:'Pollo',unit:'kg',received:2,justified:{transferOut:.5},final:1}],
  sinCobro:[{detalle:{persona:'Nombre interno',nota:'Dato privado'}}],hasClose:true},'2026-11-27','Regimiento Arica');
 assert.match(s,/Regimiento Arica/);assert.match(s,/27\/11\/2026/);
 assert.match(s,/Pollo: 750 g/);assert.match(s,/mercadería 2 kg/);assert.match(s,/salió 0[.,]5 kg/);
 assert.match(s,/Insumos con conteo de cierre en el reporte: 1/);
 assert.doesNotMatch(s,/Nombre interno|Dato privado/);
 assert.match(js,/https:\/\/wa\.me\/\?text=/);
 assert.match(js,/if\(calendar&&view\(\)==='inventario'\)\{mountTransfers\(calendar\);mountReport\(calendar\);\}/);
 const list=fs.readFileSync('firebase/uki-inventario-historial-admin.js','utf8');
 assert.match(list,/Enviar lo que falta pedir por WhatsApp/);
 assert.match(list,/f\.toBuy>0&&f\.minimum>0/);
});
