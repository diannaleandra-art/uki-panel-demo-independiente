import test from 'node:test';
import assert from 'node:assert/strict';
import {moverCajaRomoCandidatoQA,crearGuardadoCajaRomoQA,
 RomoMovimientoInciertoQA,ROMO_MOVIMIENTOS_CAJA_QA_HABILITADOS}
 from '../firebase/uki-romo-movimientos-atomicos-qa.mjs';
import {crearPuenteRomoOperativoQA} from '../firebase/uki-romo-operativo-qa.mjs';
const SUC='Romo’s Sushi La Serena';
const ms=1763070000000,fecha='2026-11-13T15:00:00';
const origin=()=>({suc:SUC,pedidos:[],gastos:[],retiros:[],propinas:[],cierres:[],
 deliveriesManuales:[],clientes:{},cajasDiarias:{},incidencias:[],
 nextId:1,nextIncidenciaId:1});
const base={registradoEn:ms,fechaISO:fecha,monto:2500};
test('apagado por defecto: no hace consultas ni cambios',async()=>{
 assert.equal(ROMO_MOVIMIENTOS_CAJA_QA_HABILITADOS,false);
 let requests=0;
 const control=crearGuardadoCajaRomoQA({servidor:{disponible:()=>{requests++;return true}}});
 await assert.rejects(control.guardar({tipo:'gasto',datos:base}),/no habilitados/);
 assert.equal(requests,0);
});
test('formatos de Uki sobre copia para gastos retiros y delivery manual',()=>{
 for(const [tipo,datos,propiedad] of [
  ['gasto',{...base,concepto:'Aceite',medio:'Efectivo'},'gastos'],
  ['retiro',{...base,motivo:'Retiro de caja'},'retiros'],
  ['delivery_manual',{...base,cliente:'Cliente',nota:'Repartidor',medio:'Efectivo'},'deliveriesManuales']
 ]){
  const original=origin(),copia=structuredClone(original);
  const r=moverCajaRomoCandidatoQA(copia,{tipo,datos});
  assert.equal(r.id,ms);assert.equal(copia[propiedad].length,1);
  assert.equal(copia[propiedad][0].suc,SUC);
  assert.deepEqual(original,origin(),'no se debe cambiar la vista');
 }
});
test('propina manual exige pedido pagado de Romo y no cerrado',()=>{
 const s=origin();
 s.pedidos=[{id:8,suc:SUC,pagado:true,estado:'Pendiente',fechaISO:fecha,
  registradoEn:ms,codigoCarta:'271'}];
 const datos={...base,registradoEn:ms+1,pedidoId:8,concepto:'Propina local',
  medio:'Efectivo',responsable:'Encargado QA'};
 moverCajaRomoCandidatoQA(s,{tipo:'propina_manual',datos});
 assert.equal(s.propinas[0].origen,'manual');
 assert.throws(()=>moverCajaRomoCandidatoQA(s,{tipo:'propina_manual',
  datos:{...datos,registradoEn:ms+2}}),/ya tiene propina/);
 const closed=origin();closed.pedidos=structuredClone(s.pedidos);
 closed.cierres=[{suc:SUC,fechaMs:ms+4000}];
 assert.throws(()=>moverCajaRomoCandidatoQA(closed,{tipo:'propina_manual',datos}),/cierre definitivo/);
});
test('montos negativos fechas falsas y sucursales ajenas se rechazan',()=>{
 for(const [tipo,datos] of [
  ['gasto',{...base,concepto:'Aceite',medio:'Efectivo',monto:-1}],
  ['gasto',{...base,concepto:'Aceite',medio:'Rappi'}],
  ['retiro',{...base,motivo:'Caja',fechaISO:'mañana'}],
  ['propina_manual',{...base,pedidoId:3,concepto:'Propina',medio:'Efectivo',responsable:'D'}],
  ['cierre',{...base}]
 ])assert.throws(()=>moverCajaRomoCandidatoQA(origin(),{tipo,datos}));
 assert.throws(()=>moverCajaRomoCandidatoQA({...origin(),suc:'Uki La Serena'},
  {tipo:'gasto',datos:{...base,concepto:'Aceite',medio:'Efectivo'}}));
});
const make=(fail=false)=>{
 let visible={revision:0,estado:origin()},confirmaciones=0;
 const events=[];
 const control=crearGuardadoCajaRomoQA({
  habilitado:true,
  servidor:{disponible:()=>true,guardarSobreCifrado:async({snapshot,revision})=>{
   events.push('Neon');assert.equal(revision,0);assert.equal(snapshot.sucursal,SUC);
   assert.equal(visible.estado.gastos.length,0);
   if(fail)throw Error('Conexión interrumpida');
   confirmaciones++;return {revision:1};
  }},
  estadoVisible:()=>visible,
  cifrarEstado:async copia=>{
   events.push('cifrar');
   assert.equal(copia.gastos.length,1);
   return {formato:'uki-v813-browser',sucursal:SUC,cifrado:'prueba'};
  },
  validarEstado:(state,suc)=>state?.suc===suc&&Array.isArray(state.gastos),
  aplicarConfirmado:async ({estado,revision})=>{
   events.push('mostrar');visible={estado,revision};
  }
 });
 return {control,events,visible:()=>visible,confirmaciones:()=>confirmaciones};
};
test('gasto no toca la pantalla antes de Neon y acepta revisión CAS',async()=>{
 const d=make();
 const r=await d.control.guardar({tipo:'gasto',
  datos:{...base,concepto:'Aceite',medio:'Efectivo'}});
 assert.equal(r.ok,true);assert.equal(r.revision,1);
 assert.deepEqual(d.events,['cifrar','Neon','mostrar']);
 assert.equal(d.visible().estado.gastos.length,1);
 assert.equal(d.confirmaciones(),1);
});
test('error incierto deja la pantalla sin gasto, exige conciliación',async()=>{
 const d=make(true);
 await assert.rejects(d.control.guardar({tipo:'gasto',
  datos:{...base,concepto:'Aceite',medio:'Efectivo'}}),
  e=>e instanceof RomoMovimientoInciertoQA);
 assert.deepEqual(d.events,['cifrar','Neon']);
 assert.equal(d.visible().estado.gastos.length,0);
});
test('guardarSobreCifrado usa Google y una única revisión sin pasar la contraseña',async()=>{
 const snapshot={formato:'uki-v813-browser',version:1,sucursal:SUC,
  salt:'a'.repeat(24),iv:'b'.repeat(16),cifrado:'c'.repeat(40)};
 let writes=0;
 const bridge=crearPuenteRomoOperativoQA({
  habilitado:true,cifrar:async()=>{},descifrar:async()=>{},validarEstado:()=>true,
  getGoogleToken:async()=>('google_token_'.repeat(7)),
  fetchFn:async(url,options)=>{
   writes++;
   assert.equal(options.method,'POST');
   const payload=JSON.parse(options.body);
   assert.deepEqual(payload,{expectedRevision:2,snapshot});
   assert(!('password' in payload));
   return {ok:true,status:200,json:async()=>({
    ok:true,storeId:'romo:serena',revision:3
   })};
  }
 });
 const response=await bridge.guardarSobreCifrado({snapshot,revision:2});
 assert.equal(response.revision,3);assert.equal(writes,1);
});

test('dos teléfonos: solo un movimiento puede confirmar revisión 0',async()=>{
 const server={revision:0,state:origin(),commits:0};
 const equipment=()=>{
  let local={revision:0,estado:origin()};
  const driver=crearGuardadoCajaRomoQA({
   habilitado:true,
   servidor:{
    disponible:()=>true,
    guardarSobreCifrado:async({snapshot,revision})=>{
     if(revision!==server.revision)throw Error('409: otro teléfono ya guardó');
     server.state=structuredClone(snapshot.estadoSoloPrueba);
     server.revision++;server.commits++;
     return {revision:server.revision};
    }
   },
   estadoVisible:()=>local,
   validarEstado:(s,x)=>s?.suc===x&&Array.isArray(s.gastos),
   cifrarEstado:async state=>({
    formato:'uki-v813-browser',sucursal:SUC,
    estadoSoloPrueba:structuredClone(state)
   }),
   aplicarConfirmado:async ({estado,revision})=>{
    local={estado,revision};
   }
  });
  return {driver,visible:()=>local};
 };
 const one=equipment(),two=equipment();
 await one.driver.guardar({tipo:'gasto',datos:{
  ...base,concepto:'Aceite',medio:'Efectivo'
 }});
 await assert.rejects(two.driver.guardar({tipo:'gasto',datos:{
  ...base,registradoEn:ms+1,concepto:'Bolsas',medio:'Efectivo'
 }}),e=>e instanceof RomoMovimientoInciertoQA);
 assert.equal(server.commits,1);
 assert.equal(server.revision,1);
 assert.deepEqual(server.state.gastos.map(x=>x.concepto),['Aceite']);
 assert.equal(one.visible().estado.gastos.length,1);
 assert.equal(two.visible().estado.gastos.length,0);
});

test('pago repartidor se guarda en su turno y no como venta ni delivery manual',()=>{
 const s=origin();
 const fechaOperativa='2026-11-13';
 s.cajasDiarias[SUC+'|'+fechaOperativa]={
  turnoAbierto:true,inicioMs:ms-10000,pagoDeliveryDia:0,
  pagoDeliveryAnterior:0,pagoDeliveryMedioDia:'Efectivo',
  pagoDeliveryMedioAnterior:'Efectivo'
 };
 s.pedidos=[{suc:SUC,id:1,registradoEn:ms-1000,
  modalidad:'Delivery',estado:'Pendiente',envio:2000}];
 const r=moverCajaRomoCandidatoQA(s,{tipo:'pago_repartidor',
  datos:{...base,fechaOperativa,medio:'Efectivo',tipoSaldo:'dia',
   concepto:'Pago turno',monto:1500}});
 assert.equal(r.tipo,'pago_repartidor');
 const caja=s.cajasDiarias[SUC+'|'+fechaOperativa];
 assert.equal(caja.pagoDeliveryDia,1500);
 assert.equal(caja.pagosRepartidor.length,1);
 assert.equal(s.deliveriesManuales.length,0);
 assert.equal(s.pedidos.length,1);
 assert.throws(()=>moverCajaRomoCandidatoQA(s,{tipo:'pago_repartidor',
  datos:{...base,registradoEn:ms+1,fechaOperativa,medio:'Efectivo',
   tipoSaldo:'dia',monto:900}}),/supera los deliverys/);
});
test('abono de saldo anterior requiere concepto, no contamina el reparto actual',()=>{
 const s=origin(),fechaOperativa='2026-11-13';
 s.cajasDiarias[SUC+'|'+fechaOperativa]={turnoAbierto:true,inicioMs:ms-1000};
 assert.throws(()=>moverCajaRomoCandidatoQA(s,{tipo:'pago_repartidor',
  datos:{...base,fechaOperativa,medio:'Efectivo',tipoSaldo:'anterior'}}),/Concepto/);
 moverCajaRomoCandidatoQA(s,{tipo:'pago_repartidor',
  datos:{...base,fechaOperativa,medio:'Transferencia',tipoSaldo:'anterior',
   concepto:'Saldo del día anterior'}});
 assert.equal(s.cajasDiarias[SUC+'|'+fechaOperativa].pagoDeliveryAnterior,2500);
 assert.equal(s.cajasDiarias[SUC+'|'+fechaOperativa].pagoDeliveryDia,undefined);
});

test('caja chica registra gasto solo si hay base chica disponible',()=>{
 const s=origin(),dia='2026-11-13',caja={turnoAbierto:true,inicioMs:ms-1000,
 cajaChica:{inicial:20000,gastos:[]}};
 s.cajasDiarias[SUC+'|'+dia]=caja;
 const x=moverCajaRomoCandidatoQA(s,{tipo:'caja_chica',
  datos:{...base,fechaOperativa:dia,concepto:'Guantes',monto:1500}});
 assert.equal(x.tipo,'caja_chica');
 assert.equal(caja.cajaChica.gastos[0].monto,1500);
 assert.equal(s.gastos.length,0);
 const antes=structuredClone(caja.cajaChica);
 assert.throws(()=>moverCajaRomoCandidatoQA(s,{tipo:'caja_chica',
  datos:{...base,registradoEn:ms+1,fechaOperativa:dia,
   concepto:'Excesivo',monto:25000}}),/saldo de caja chica/);
 assert.deepEqual(caja.cajaChica,antes);
});
test('cobro manual de plataforma deja trazabilidad sin duplicar',()=>{
 const s=origin(),dia='2026-11-13';
 s.cajasDiarias[SUC+'|'+dia]={turnoAbierto:true,inicioMs:ms-1000,apps:{}};
 const datos={...base,fechaOperativa:dia,concepto:'Ingreso extra plataforma',
 medioApp:'Uber Eats',monto:3500};
 moverCajaRomoCandidatoQA(s,{tipo:'app_manual',datos});
 assert.equal(s.cajasDiarias[SUC+'|'+dia].apps['Uber Eats'],3500);
 assert.equal(s.cajasDiarias[SUC+'|'+dia].movimientosApps.length,1);
 assert.throws(()=>moverCajaRomoCandidatoQA(s,{tipo:'app_manual',datos}),/duplicado/);
 assert.equal(s.cajasDiarias[SUC+'|'+dia].apps['Uber Eats'],3500);
});
