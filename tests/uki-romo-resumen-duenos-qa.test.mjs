import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararResumenCierreRomoDuenosQA,vincularResumenConfirmadoRomoDuenosQA,
 ROMO_FINANZAS_DUENOS_LIVE_HABILITADO_QA} from '../firebase/uki-romo-resumen-duenos-qa.mjs';
import {prepararAperturaTurnoRomoQA,prepararCierreDefinitivoRomoQA}
 from '../firebase/uki-romo-cierre-definitivo-qa.mjs';
const SUC='Romo’s Sushi La Serena',dia='2026-11-13',inicio=1794574800000;
function estado(){
 return {suc:SUC,pedidos:[],gastos:[],retiros:[],propinas:[],cierres:[],
   deliveriesManuales:[],solicitudesWhatsApp:[],cajasDiarias:{},clientes:{}};
}
function cierreDePrueba(){
 const x=estado();
 prepararAperturaTurnoRomoQA(x,{fechaOperativa:dia,inicioMs:inicio,
  cajaChicaInicial:25000,base:18000,responsable:'Encargado QA'});
 x.pedidos.push({suc:SUC,id:1,registradoEn:inicio+1000,fechaISO:dia+'T13:01:00',
  modalidad:'Delivery',subtotal:7000,envio:2000,estado:'Pendiente',pagado:true,
  medio:'Efectivo',medioEnvio:'Efectivo',pagosProductos:[],pagosEnvio:[],
  cliente:'PERSONA PRIVADA',telefono:'+56912345678',
  productosPagadosOtroLocal:false,envioPagadoOtroLocal:false});
 x.gastos.push({suc:SUC,registradoEn:inicio+2000,monto:500,medio:'Efectivo'});
 x.propinas.push({suc:SUC,registradoEn:inicio+3000,monto:100,medio:'Efectivo'});
 const cierre=prepararCierreDefinitivoRomoQA(x,{fechaOperativa:dia,
  cierreMs:inicio+3600000,responsable:'Encargado QA',
  efectivoContado:8500}).cierre;
 return cierre;
}
test('salida de Romo nunca se considera sincronizada por el solo cierre',()=>{
 assert.equal(ROMO_FINANZAS_DUENOS_LIVE_HABILITADO_QA,false);
 const c=cierreDePrueba(),p=prepararResumenCierreRomoDuenosQA(c);
 assert.equal(p.origen,'romo');assert.equal(p.store_id,'romo:serena');
 assert.equal(p.estado,'pendiente_confirmacion_neon');
 assert.equal(p.venta_total,9000);
 assert.equal(p.medios.Efectivo,9000);
 assert.equal(p.gastos_cierre,500);
 assert.equal(p.propinas,100);
 assert.equal(p.delivery_por_pagar,0);
 assert.equal(p.fuente_unica,'romo:serena|'+c.turnoClave);
 assert.equal(p.caja_chica_inicial,25000);
 assert.equal(p.caja_chica_gastos,0);
 assert.doesNotMatch(JSON.stringify(p),/PERSONA PRIVADA|56912345678|productos|detalle/);
});
test('comprobante CAS de Neon debe corresponder al mismo turno',()=>{
 const p=prepararResumenCierreRomoDuenosQA(cierreDePrueba());
 assert.throws(()=>vincularResumenConfirmadoRomoDuenosQA(p,
   {storeId:'romo:serena',revision:9,turnoId:'otro',estado:'cierre_confirmado'}));
 assert.throws(()=>vincularResumenConfirmadoRomoDuenosQA(p,
   {storeId:'romo:serena',revision:9,turnoId:p.turno_ref,estado:'sin_confirmar'}));
 const v=vincularResumenConfirmadoRomoDuenosQA(p,{
   storeId:'romo:serena',revision:9,turnoId:p.turno_ref,estado:'cierre_confirmado'
 });
 assert.equal(v.revision_neon,9);
 assert.equal(v.estado,'confirmado_en_romo_pendiente_de_sincronizar_duenos');
});
test('no acepta cierres Uki ni duplicación de pagos/cobros',()=>{
 const c=cierreDePrueba();
 assert.throws(()=>prepararResumenCierreRomoDuenosQA({...c,suc:'Uki La Serena'}));
 assert.throws(()=>prepararResumenCierreRomoDuenosQA({...c,venta:11000}));
 assert.throws(()=>prepararResumenCierreRomoDuenosQA({...c,turnoClave:dia+'@1794520000000'}));
 assert.equal(prepararResumenCierreRomoDuenosQA(c).venta_total,9000);
});
test('dos turnos del mismo día producen claves diferentes',()=>{
 const c=cierreDePrueba(),other={...c,turnoClave:dia+'@'+(inicio+7200000),
  fechaMs:inicio+9000000};
 const a=prepararResumenCierreRomoDuenosQA(c),b=prepararResumenCierreRomoDuenosQA(other);
 assert.notEqual(a.fuente_unica,b.fuente_unica);
});
test('el guardado de turnos prepara finanzas SOLO después de CAS',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../firebase/uki-romo-turnos-atomicos-qa.mjs',import.meta.url),'utf8');
 assert.match(src,/const resumenDuenosPendiente=tipo==='cierre'/);
 assert.match(src,/vincularResumenConfirmadoRomoDuenosQA/);
 assert.match(src,/const resumenDuenosQA=tipo==='cierre'/);
 assert.match(src,/estado:'cierre_confirmado'/);
});
