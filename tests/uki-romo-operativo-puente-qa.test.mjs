import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararBorradorRomoDesdeSolicitudQA,verificarBorradorRomoAntesGuardarQA,
 crearBandejaRomoMismoPanelQA,ROMO_PANEL_RECEPCION_HABILITADA_QA}
 from '../firebase/uki-romo-recepcion-formulario-qa.mjs';
const id='123e4567-e89b-42d3-a456-426614174001',token='123e4567-e89b-42d3-a456-426614174002';
const mensaje=['*ROMO’S SUSHI*','N.º de pedido: 271','Cliente: Ejemplo',
 'WhatsApp: +56911118899','Sucursal: Romo’s Sushi La Serena','',
 '*COCINA*','*− 1 × Clásico 24 piezas*','Roll 1: Pollo / Palta / Panko',
 'Roll 2: Kanicama / Pepino / Tempura','Salsas: Soya y teriyaki',
 '*− 2 × Handroll clásico*','Roll 1: Pollo / Cebollín / Panko',
 'Sin queso crema: todo','','*ENTREGA*','Delivery','Dirección: Balmaceda 1612',
 '','*PAGO*','Total productos: $9.000','Delivery: $2.000',
 'Total con delivery: $11.000','Pago: Transferencia'].join('\n');
const row={id,branch:'serena',estado:'pendiente',
 codigo_pedido:'271',cliente:'Ejemplo',telefono:'+56911118899',
 mensaje,total_indicado:11000};
test('cerrada: no consulta Google ni red por defecto',async()=>{
 let count=0;
 const q=crearBandejaRomoMismoPanelQA({
  getGoogleToken:async()=>{count++;throw Error('No')},
  fetchFn:async()=>{count++;throw Error('No')}
 });
 assert.equal(ROMO_PANEL_RECEPCION_HABILITADA_QA,false);
 assert.equal(q.disponible(),false);
 await assert.rejects(q.listar(),/deshabilitada/);
 await assert.rejects(q.reservar(id,token),/deshabilitada/);
 assert.equal(count,0);
});
test('conserva cada roll, salsas, cantidades y delivery sin cobrar',()=>{
 const d=prepararBorradorRomoDesdeSolicitudQA(row);
 assert.equal(d.items.length,2);
 assert.equal(d.items[1].cant,2);
 assert.match(d.items[0].det,/Roll 2: Kanicama/);
 assert.match(d.items[0].det,/Salsas: Soya/);
 assert.match(d.items[1].det,/Sin queso crema: todo/);
 assert.equal(d.items[0].precio,0);
 assert.equal(d.modalidad,'Delivery');assert.equal(d.envio,2000);
 assert.equal(d.medio,'Transferencia');assert.equal(d.pagado,false);
 assert.equal(d.cartaSolicitudRemotaId,id);
 assert.equal(d.sucursalCarta,'Romo’s Sushi La Serena');
});
test('verifica precios y armado, y no inventa valor del delivery',()=>{
 const d=prepararBorradorRomoDesdeSolicitudQA(row);
 assert.throws(()=>verificarBorradorRomoAntesGuardarQA(d,{solicitudId:id}),/Verifica/);
 assert.throws(()=>verificarBorradorRomoAntesGuardarQA(d,
  {solicitudId:id,confirmoArmado:true,confirmoImportes:true}),/precio/);
 d.items[0].precio=7000;d.items[1].precio=1000;
 const reviewed=verificarBorradorRomoAntesGuardarQA(d,
  {solicitudId:id,confirmoArmado:true,confirmoImportes:true});
 assert.equal(reviewed.subtotal,9000);assert.equal(reviewed.pagado,false);
 const pending=prepararBorradorRomoDesdeSolicitudQA({
  ...row,mensaje:mensaje.replace('Delivery: $2.000','*DELIVERY POR CONFIRMAR*')});
 pending.items.forEach(p=>p.precio=5000);
 assert.equal(pending.romoDeliveryPendienteQA,true);
 assert.throws(()=>verificarBorradorRomoAntesGuardarQA(pending,
  {solicitudId:id,confirmoArmado:true,confirmoImportes:true}),/delivery/);
});
test('rechaza identificadores o textos ajenos a Romo',()=>{
 for(const data of [{...row,estado:'aceptada'},
  {...row,mensaje:mensaje.replace('ROMO’S','UKI')},
  {...row,mensaje:mensaje.replace('Sucursal: Romo’s Sushi La Serena','Sucursal: Uki La Serena')},
  {...row,codigo_pedido:'272'}])
  assert.throws(()=>prepararBorradorRomoDesdeSolicitudQA(data));
});
test('dos trabajadores simulados: uno reserva, segundo recibe conflicto',async()=>{
 let first=true,accepted=0;
 const fetchFn=async(url,opts)=>{
  assert.equal(url,'https://uki-sushi-inventario-git-qa-integraci-dc8aa9-diannaleandra-7046.vercel.app/api/romo-solicitudes-carta-qa');
  const b=opts.body&&JSON.parse(opts.body);
  const result=opts.method==='GET'?
   {ok:true,storeId:'romo:serena',branch:'serena',orders:[row]}:
   b.estado==='reservar'?(first?(first=false,{ok:true,storeId:'romo:serena',estado:'reservada'}):{ok:false,error:'Otra reserva'}):
   b.estado==='aceptada'?(accepted++,{ok:true,storeId:'romo:serena',estado:'aceptada',
    pedido_interno:'1',revision:2}):{ok:false};
  return {ok:result.ok,json:async()=>result};
 };
 const args={habilitada:true,fetchFn,getGoogleToken:async()=>('token'.repeat(20))};
 const a=crearBandejaRomoMismoPanelQA(args),b=crearBandejaRomoMismoPanelQA(args);
 assert.equal((await a.listar()).length,1);
 assert.equal((await a.reservar(id,token)).estado,'reservada');
 await assert.rejects(b.reservar(id,'123e4567-e89b-42d3-a456-426614174003'),/Otra reserva/);
 const res=await a.confirmarGuardado({id,claimToken:token,pedidoId:'1',expectedRevision:1,
  snapshot:{sucursal:'Romo’s Sushi La Serena',formato:'uki-v813-browser'}});
 assert.equal(res.estado,'aceptada');assert.equal(accepted,1);
});
test('reutiliza el formulario y no altera el acceso de las sucursales Uki',()=>{
 const panel=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(panel,/const SUCURSALES=\["Uki Regimiento Arica","Uki La Serena"\]/);
 assert.match(panel,/function vNuevo\(\)/);
 assert.match(panel,/async function ndGuardar\(\)/);
 assert.match(panel,/uki-romo-recepcion-formulario-qa\.mjs/);
});
