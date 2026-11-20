import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararBorradorRomoDesdeSolicitudQA} from '../public/romo-panel-qa/uki-romo-recepcion-formulario-qa.mjs';
import {construirCandidatoRomoFormatoUkiQA} from '../public/romo-panel-qa/uki-romo-pedido-formato-qa.mjs';
import {prepararCobroPendienteRomoQA} from '../public/romo-panel-qa/uki-romo-cobro-pendiente-qa.mjs';
import {consultarCajaRomoQA} from '../public/romo-panel-qa/uki-romo-caja-consulta-qa.mjs';
import {normalizarResumenCierreRomoQA} from '../lib/romo-cierre-constancia-qa.mjs';
import {prepararRegistroCierreRomoDuenosQA} from '../lib/romo-cierres-duenos-repositorio-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const REF='RS-AABBCC112233';
const UUID='812fc037-2895-4ca8-9953-62bac5c1b058';
const fechaLocal=stamp=>{
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Santiago',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(stamp));
 const v=k=>parts.find(p=>p.type===k)?.value||'';
 return [v('year'),v('month'),v('day')].join('-');
};
const estado=(conPedido=false)=>{
 const stamp=Date.now(),dia=fechaLocal(stamp),turno=dia+'@'+stamp;
 const pedido={suc:SUC,id:1,numeroTurno:1,turnoClave:turno,
  codigoCarta:REF,codigoCliente:'',cliente:'Cliente autorizado',
  telefono:'',fechaISO:new Date(stamp).toISOString(),registradoEn:stamp,
  modalidad:'Retiro',estado:'Pendiente',pagado:false,esPremio:false,
  medio:'Junaeb',medioEnvio:'Efectivo',pagosProductos:[],pagosEnvio:[],
  productosPagadosOtroLocal:false,envioPagadoOtroLocal:false,
  productos:[{nombre:'Clásico 24',cantidad:1,precioUnit:7000,detalle:'Pollo'}],
  subtotal:7000,envio:0,total:7000,propina:0};
 return {stamp,dia,turno,s:{
  suc:SUC,nextId:conPedido?2:1,pedidos:conPedido?[pedido]:[],
  gastos:[],retiros:[],deliveriesManuales:[],ajustesHistoricos:[],
  propinas:[],cierres:[],clientes:{},
  cajasDiarias:{[SUC+'|'+dia]:{turnoAbierto:true,baseConfirmada:true,turnoId:turno}}
 }};
};

test('Solicitud Junaeb llega al borrador con su identidad y no crea pago',()=>{
 const msg=['*ROMO’S SUSHI*','Sucursal: Romo’s Sushi La Serena',
 'N° de pedido: '+REF,'*COCINA*','*− 1 × Clásico 24*',
 'Importe línea: $7.000','*ENTREGA*','RETIRO · Romo’s Sushi La Serena',
 '*PAGO*','Pago: Junaeb','Total productos: $7.000'].join('\n');
 const d=prepararBorradorRomoDesdeSolicitudQA({
  id:UUID,estado:'pendiente',branch:'serena',codigo_pedido:REF,
  cliente:'Cliente autorizado',telefono:'',mensaje:msg,total_indicado:7000
 });
 assert.equal(d.medio,'Junaeb');
 assert.equal(d.romoPagoIndicadoQA,'Junaeb');
 assert.equal(d.pagado,false);
 assert.equal(d.items[0].precio,7000);
});

test('Pago completo Junaeb suma $7.000 a Junaeb y $0 a Otros, sin doble venta',async()=>{
 const x=estado();
 const draft={sucursalCarta:SUC,cartaSolicitudRemotaId:UUID,
  fecha:new Date(x.stamp).toISOString(),cliente:'Cliente autorizado',
  telefono:'',codigoCarta:REF,codigoCliente:'',
  items:[{nombre:'Clásico 24',cant:1,precio:7000,det:'Pollo'}],
  modalidad:'Retiro',envio:0,medio:'Junaeb',medioEnvio:'Efectivo',
  pagado:true,romoResponsableCobro:'Administrador Romo',
  propinaModo:'ninguna',propinaPersonalizada:'',medioPropina:'Efectivo'};
 await construirCandidatoRomoFormatoUkiQA({estado:x.s,draft,
  contexto:{numeroTurno:1,turnoClave:x.turno,registradoEn:x.stamp,
   fechaISO:new Date(x.stamp).toISOString(),confirmoPago:true,
   confirmoDiferenciaTotal:false}});
 const c=consultarCajaRomoQA(x.s,{fechaOperativa:x.dia});
 assert.equal(c.cobrosEnRomo,7000);
 assert.equal(c.medios.Junaeb,7000);
 assert.equal(c.medios.Otros,0);
 assert.equal(c.medios.Efectivo,0);
 assert.equal(c.propinasRegistradas,0);
 assert.equal(c.pagados,1);
});

test('Cobro mixto Junaeb y transferencia conserva suma y rechaza duplicado',()=>{
 const x=estado(true);
 const input={pedidoId:1,responsable:'Administrador Romo',
  registradoEn:x.stamp,confirmoRecepcion:true,
  pagosProductos:[{medio:'Junaeb',monto:3500},{medio:'Transferencia',monto:3500}]};
 prepararCobroPendienteRomoQA(x.s,input);
 const c=consultarCajaRomoQA(x.s,{fechaOperativa:x.dia});
 assert.equal(c.medios.Junaeb,3500);
 assert.equal(c.medios.Transferencia,3500);
 assert.equal(c.medios.Otros,0);
 assert.equal(c.cobrosEnRomo,7000);
 assert.throws(()=>prepararCobroPendienteRomoQA(x.s,input),/ya pagado|Pedido ya/);
});

test('Cierre y contabilidad dueños aceptan Junaeb con importe íntegro',()=>{
 const dia='2026-11-19',stamp=Date.parse('2026-11-19T18:00:00-03:00');
 const turno=dia+'@'+stamp;
 const base={origen:'romo',store_id:'romo:serena',sucursal:'serena',
  estado:'pendiente_confirmacion_neon',turno_ref:turno,
  fuente_unica:'romo:serena|'+turno,fecha_operativa:dia,
  fecha_cierre_ms:stamp+600000,venta_total:7000,pedidos:1,
  medios:{Junaeb:7000,Otros:0},gastos_cierre:0,delivery_por_pagar:0,
  propinas:0,retiros:0,caja_chica_inicial:0,caja_chica_gastos:0,
  efectivo_contado:0,diferencia_efectivo:0};
 const normalized=normalizarResumenCierreRomoQA(base,turno);
 assert.equal(normalized.medios.Junaeb,7000);
 const due=prepararRegistroCierreRomoDuenosQA({...normalized,
  estado:'confirmado_en_romo_pendiente_de_sincronizar_duenos',revision_neon:8});
 assert.equal(due.medios.Junaeb,7000);
 assert.equal(due.medios.Otros,0);
 assert.equal(due.venta_total,7000);
});

test('Interfaz y exportación Romo muestran Junaeb sin alterar el archivo oficial Uki',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const panel=read('../public/romo-panel-qa/index.html');
 const exportador=read('../public/romo-panel-qa/uki-romo-exportar-cierres-qa.mjs');
 const original=read('../firebase/uki-sushi-local.html');
 assert.match(panel,/const ROMO_MEDIOS_COBRO_QA=\[[^\n]*'Junaeb'/);
 assert.match(panel,/Se registrará como Junaeb solo al confirmar el cobro real/);
 assert.doesNotMatch(panel,/Hasta habilitarlo en caja figura como Otros/);
 assert.match(exportador,/const METHODS=\[[^\n]*'Junaeb'/);
 assert.ok(!original.includes('const ROMO_MEDIOS_COBRO_QA'));
});
