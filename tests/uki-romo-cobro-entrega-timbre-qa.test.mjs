import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararCobroPendienteRomoQA} from '../firebase/uki-romo-cobro-pendiente-qa.mjs';
import {prepararEntregaRomoQA} from '../firebase/uki-romo-entrega-atomica-qa.mjs';
import {prepararTimbreRomoQA} from '../firebase/uki-romo-timbres-atomicos-qa.mjs';
import {prepararCierreDefinitivoRomoQA} from '../firebase/uki-romo-cierre-definitivo-qa.mjs';
const SUC='Romo’s Sushi La Serena',day='2026-11-14',ms=1794631879356,turno=day+'@'+ms;
const cliente=()=>({suc:SUC,id:7,cliente:'CLIENTE SIMULADO',telefono:'+56911112222',
 codigoCarta:'ROMO-CLIENTE-7',codigoCliente:'2222',numeroTurno:1,
 turnoClave:turno,fechaISO:day+'T01:53',fechaOperativa:day,registradoEn:ms+1000,
 modalidad:'Delivery',estado:'Pendiente',pagado:false,
 subtotal:7000,envio:2000,total:9000,propina:0,
 medio:'Efectivo',medioEnvio:'Efectivo',pagosProductos:[],pagosEnvio:[],
 productos:[{nombre:'24 piezas',cantidad:1,precioUnit:7000,detalle:'Soya'}]});
const state=()=>({suc:SUC,fechaOperativa:day,pedidos:[cliente()],cierres:[],clientes:{},
 gastos:[],retiros:[],propinas:[],deliveriesManuales:[],solicitudesWhatsApp:[],
 cajasDiarias:{[SUC+'|'+day]:{turnoId:turno,turnoAbierto:true,
  inicioMs:ms,base:0,pagoDeliveryDia:0,pagoDeliveryAnterior:0,apps:{}}}});
const cobrar=(id=7)=>({pedidoId:id,responsable:'RESPONSABLE SIMULADO',
 registradoEn:ms+4000,confirmoRecepcion:true,medioProductos:'Efectivo',medioEnvio:'Efectivo'});
const entregar={pedidoId:7,responsable:'REPARTIDOR SIMULADO',registradoEn:ms+10000};
const stamp={pedidoId:7,responsable:'PERSONAL SIMULADO',
 whatsappAbiertoEn:'2026-11-14T02:00:00.000Z',
 whatsappConfirmadoEn:'2026-11-14T02:01:00.000Z',envioConfirmado:true};
const cerrar={fechaOperativa:day,cierreMs:ms+100000,responsable:'ADMINISTRADOR SIMULADO',
 efectivoContado:9000,observacion:'Cierre simulado',aceptarPendientesSinPago:false};
test('pedido pagado no puede entregarse ni cerrarse sin timbre WhatsApp',()=>{
 const s=state();prepararCobroPendienteRomoQA(s,cobrar());
 assert.throws(()=>prepararEntregaRomoQA(s,entregar),/timbre WhatsApp/);
 assert.throws(()=>prepararCierreDefinitivoRomoQA(s,cerrar),/timbres WhatsApp/);
 prepararTimbreRomoQA(s,stamp);
 prepararEntregaRomoQA(s,entregar);
 assert.equal(s.pedidos[0].estado,'Entregado');
 assert.equal(s.pedidos[0].pagado,true);
 assert.equal(s.pedidos[0].timbreEnviadoEn,stamp.whatsappConfirmadoEn);
});
test('entregado antes de cobrar permite cobrar y enviar timbre después',()=>{
 const s=state();prepararEntregaRomoQA(s,entregar);
 assert.equal(s.pedidos[0].pagado,false);
 prepararCobroPendienteRomoQA(s,cobrar());
 assert.equal(s.pedidos[0].estado,'Entregado');
 prepararTimbreRomoQA(s,stamp);
 assert.equal(s.pedidos[0].timbreEnviadoEn,stamp.whatsappConfirmadoEn);
 assert.equal(s.pedidos[0].historialCambios.length,2);
});
