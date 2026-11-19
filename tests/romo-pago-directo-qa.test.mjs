import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {construirCandidatoRomoFormatoUkiQA} from '../public/romo-panel-qa/uki-romo-pedido-formato-qa.mjs';
import {consultarCajaRomoQA} from '../public/romo-panel-qa/uki-romo-caja-consulta-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const UUID='812fc037-2895-4ca8-9953-62bac5c1b058';
const parts=(stamp)=>{
 const dateParts=new Intl.DateTimeFormat('en-GB',{
  timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date(stamp));
 const x=k=>dateParts.find(p=>p.type===k)?.value||'';
 return [x('year'),x('month'),x('day')].join('-');
};
const setup=()=>{
 const stamp=Date.now(),dia=parts(stamp),turnoClave=dia+'@'+stamp;
 const estado={
  suc:SUC,nextId:1,pedidos:[],propinas:[],cierres:[],clientes:{},
  gastos:[],retiros:[],deliveriesManuales:[],ajustesHistoricos:[],
  cajasDiarias:{[SUC+'|'+dia]:{
   turnoAbierto:true,baseConfirmada:true,turnoId:turnoClave
  }}
 };
 const draft={
  sucursalCarta:SUC,cartaSolicitudRemotaId:UUID,fecha:new Date(stamp).toISOString(),
  cliente:'Cliente autorizado',telefono:'',codigoCarta:'RS-0123456789AB',
  codigoCliente:'',items:[{nombre:'Clásico 24 piezas',cant:1,precio:10000,det:'Pollo, palta'}],
  modalidad:'Retiro',envio:0,medio:'Transferencia',medioEnvio:'Transferencia',
  pagado:false,propinaModo:'ninguna',propinaPersonalizada:'',medioPropina:'Efectivo'
 };
 const ctx=confirmoPago=>({
  numeroTurno:1,turnoClave,registradoEn:stamp,
  fechaISO:new Date(stamp).toISOString(),confirmoPago,confirmoDiferenciaTotal:false
 });
 return {estado,draft,ctx,dia};
};

test('Guardar pendiente no crea cobro, venta, propina ni timbre',async()=>{
 const x=setup();
 await construirCandidatoRomoFormatoUkiQA({estado:x.estado,draft:x.draft,contexto:x.ctx(false)});
 assert.equal(x.estado.pedidos.length,1);
 assert.equal(x.estado.pedidos[0].pagado,false);
 assert.equal(x.estado.propinas.length,0);
 assert.equal(Object.keys(x.estado.clientes).length,0);
});
test('Pago confirmado nace en un único pedido; propina separada y timbre enviado',async()=>{
 const x=setup(),d=x.draft;
 d.pagado=true;d.propinaModo='diez';d.romoResponsableCobro='Responsable Romo';
 d.telefono='+56912345678';d.codigoCliente='5678';
 const firma=JSON.stringify([SUC,null,'56912345678']);
 d.timbreAvisoAbiertoFirma=firma;d.timbreAvisoConfirmadoFirma=firma;
 d.timbreAvisoAbiertoEn=new Date(Date.now()-20000).toISOString();
 d.timbreAvisoConfirmadoEn=new Date(Date.now()-10000).toISOString();
 d.timbreAvisoConfirmadoPor='Responsable Romo';
 const r=await construirCandidatoRomoFormatoUkiQA({
  estado:x.estado,draft:d,contexto:x.ctx(true)
 });
 assert.equal(r.total,10000); // La propina no infla las ventas.
 assert.equal(x.estado.pedidos.length,1);
 assert.equal(x.estado.pedidos[0].pagado,true);
 assert.equal(x.estado.pedidos[0].timbreEventos.length,2);
 assert.equal(x.estado.propinas.length,1);
 const caja=consultarCajaRomoQA(x.estado,{fechaOperativa:x.dia});
 assert.equal(caja.cobrosEnRomo,10000);
 assert.equal(caja.propinasRegistradas,1000);
 assert.equal(caja.pagados,1);
});
test('No confirmar pago si falta afirmación real o no hay caja abierta',async()=>{
 const x=setup();x.draft.pagado=true;x.draft.romoResponsableCobro='Responsable';
 await assert.rejects(()=>construirCandidatoRomoFormatoUkiQA({
  estado:x.estado,draft:x.draft,contexto:x.ctx(false)
 }),/Pago no confirmado/);
 x.estado.cajasDiarias[SUC+'|'+x.dia].turnoAbierto=false;
 await assert.rejects(()=>construirCandidatoRomoFormatoUkiQA({
  estado:x.estado,draft:x.draft,contexto:x.ctx(true)
 }),/turno.*abierto|turno Romo debe estar abierto/i);
});
test('Una referencia ya aceptada nunca produce un segundo pedido',async()=>{
 const x=setup();
 await construirCandidatoRomoFormatoUkiQA({estado:x.estado,draft:x.draft,contexto:x.ctx(false)});
 x.estado.nextId+=1;
 await assert.rejects(()=>construirCandidatoRomoFormatoUkiQA({
  estado:x.estado,draft:x.draft,contexto:{...x.ctx(false),numeroTurno:2}
 }),/duplicado/);
});
test('Interfaz Romo contiene casilla, medios mixtos y guardado atómico',()=>{
 const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
 assert.match(html,/<b>Pago completo confirmado<\/b>/);
 assert.match(html,/Dividir entre varios medios/);
 assert.match(html,/ukiPropinaUI\(sub\)/);
 assert.match(html,/confirmoPago:pagoConfirmadoAhora/);
 assert.match(html,/const borradorConfirmado=JSON.parse\(JSON.stringify\(D\)\)/);
 assert.match(html,/prepararCobroPendienteRomoQA\(clone,/);
});
