import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 crearTransaccionesPanelUnicoRomoQA
} from '../firebase/uki-romo-transacciones-panel-unico-qa.mjs';
import {
 crearSesionPanelUnicoRomoQA
} from '../lib/romo-panel-unico-sesion-qa.mjs';
import {prepararPedidoManualPendienteRomoQA} from '../firebase/uki-romo-pedido-manual-panel-unico-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const estado=()=>({suc:SUC,pedidos:[{suc:SUC,id:11,pagado:false}],
 gastos:[],retiros:[],propinas:[],cierres:[],deliveriesManuales:[],
 incidencias:[]});
const validar=(e,s)=>e?.suc===s&&e.pedidos?.every(p=>p.suc===s)===true;
const moved=(c,{tipo,datos})=>{
 assert.equal(tipo,'gasto');
 c.gastos.push({suc:SUC,id:datos.id,monto:datos.monto});
 return {tipo,id:datos.id};
};
const collected=(c,{pedidoId,confirmoRecepcion})=>{
 assert.equal(confirmoRecepcion,true);
 const p=c.pedidos.find(x=>x.id===pedidoId);
 if(!p||p.pagado)throw Error('Cobro duplicado');
 p.pagado=true;
 return {pedidoId};
};
function fixture({habilitado=true,wrongStore=false,saveError=false,hold=false,applyError=false}={}){
 let visible=estado(),revision=3,revisionVisible=3,guardados=0,aplicados=0,release=null;
 const sesion={
  disponible:()=>true,
  coincideEstadoOperativo:()=>true,
  estado:()=>({storeId:wrongStore?'uki:arica':'romo:serena',
   revision,conflicto:false}),
  async guardar(copia){
   guardados++;
   if(hold)await new Promise(r=>{release=r});
   if(saveError)throw Error('Neon no confirmó');
   revision++;
   return {ok:true,changed:true,revision};
  }
 };
 const flujo=crearTransaccionesPanelUnicoRomoQA({
  habilitado,sesion,
  obtenerVisible:()=>({revision:revisionVisible,estado:visible}),
  validarEstado:validar,
  prepararMovimiento:moved,
  prepararCobro:collected,
  async aplicarConfirmado({estado:copy,revision:rev}){
   if(applyError)throw Error('pantalla no actualiza');
   visible=copy;revisionVisible=rev;aplicados++;
  }
 });
 return {flujo,read:()=>visible,guardados:()=>guardados,aplicados:()=>aplicados,
  release:()=>release?.(),hayPendiente:()=>release!==null};
}
async function rechaza(accion,code){
 await assert.rejects(accion,e=>!code||e.code===code);
}
test('El guardado está apagado y no opera con datos de Uki',async()=>{
 const apagado=fixture({habilitado:false});
 await rechaza(()=>apagado.flujo.guardarMovimiento({
  tipo:'gasto',datos:{id:1,monto:500},confirmoOperacion:true}));
 assert.equal(apagado.guardados(),0);
 const localAjeno=fixture({wrongStore:true});
 await rechaza(()=>localAjeno.flujo.confirmarCobro({
  datos:{pedidoId:11},confirmoRecepcion:true}));
 assert.equal(localAjeno.guardados(),0);
});
test('Sin recepción real confirmada no registra dinero',async()=>{
 const f=fixture();
 await rechaza(()=>f.flujo.confirmarCobro({datos:{pedidoId:11}}));
 await rechaza(()=>f.flujo.guardarMovimiento({tipo:'gasto',datos:{id:3,monto:500}}));
 assert.equal(f.guardados(),0);
});
test('Un cobro solo aparece después de Neon y nunca duplica',async()=>{
 const f=fixture({hold:true});
 const task=f.flujo.confirmarCobro({datos:{pedidoId:11},confirmoRecepcion:true});
 while(!f.hayPendiente())await Promise.resolve();
 assert.equal(f.read().pedidos[0].pagado,false);
 await rechaza(()=>f.flujo.confirmarCobro({datos:{pedidoId:11},confirmoRecepcion:true}));
 f.release();
 const resultado=await task;
 assert.equal(resultado.ok,true);
 assert.equal(resultado.revision,4);
 assert.equal(f.read().pedidos[0].pagado,true);
 assert.equal(f.guardados(),1);
 assert.equal(f.aplicados(),1);
 await rechaza(()=>f.flujo.confirmarCobro({datos:{pedidoId:11},confirmoRecepcion:true}));
 assert.equal(f.guardados(),1);
});
test('Caja crea una sola revisión y no muta el origen',async()=>{
 const f=fixture();
 const r=await f.flujo.guardarMovimiento({
  tipo:'gasto',datos:{id:5,monto:1500},confirmoOperacion:true
 });
 assert.equal(r.revision,4);
 assert.equal(f.read().gastos.length,1);
 assert.equal(f.read().gastos[0].monto,1500);
 assert.equal(f.guardados(),1);
});
test('Neon incierto bloquea repetición antes de emitir otro gasto',async()=>{
 const f=fixture({saveError:true});
 await rechaza(()=>f.flujo.guardarMovimiento({
  tipo:'gasto',datos:{id:5,monto:1500},confirmoOperacion:true
 }), 'ROMO_REVISAR_NEON_ANTES_DE_REPETIR');
 assert.equal(f.aplicados(),0);
 assert.equal(f.read().gastos.length,0);
 assert.equal(f.flujo.estado().bloqueadoPorIncertidumbre,true);
 await rechaza(()=>f.flujo.guardarMovimiento({
  tipo:'gasto',datos:{id:6,monto:1500},confirmoOperacion:true
 }));
 assert.equal(f.guardados(),1);
});
test('Neon guardado y pantalla fallida: bloquear en vez de duplicar',async()=>{
 const f=fixture({applyError:true});
 await rechaza(()=>f.flujo.guardarMovimiento({
  tipo:'gasto',datos:{id:5,monto:1500},confirmoOperacion:true
 }),'ROMO_CONFIRMADO_RELEER');
 assert.equal(f.flujo.estado().bloqueadoPorIncertidumbre,true);
 assert.equal(f.guardados(),1);
});
function sesionFixture({mismatch=false}={}){
 const inicial=estado();
 const sobreNuevo={formato:'uki-v813-browser',version:1,sucursal:SUC,
  salt:'salt-prueba',iv:'iv-prueba',cifrado:'cifrado-prueba'};
 let remoto={storeId:'romo:serena',revision:2,snapshot:{...sobreNuevo,cifrado:'anterior'}};
 const vault={
  disponible:()=>true,
  cargarSobre:async()=>remoto,
  guardarSobre:async()=>{throw Error('No debería guardarse por separado')}
 };
 const sesion=crearSesionPanelUnicoRomoQA({
  vault,validarEstado:validar,
  desbloquearSobre:async()=>({estado:inicial,cifrar:async()=>sobreNuevo}),
  prepararEstadoInicial:async()=>{throw Error('No inicializar')}
 });
 return {sesion,sobreNuevo,setRemoto:(r)=>{remoto=r},
  confirmar:async(candidato)=>{
   const snapshot=await sesion.prepararSobreParaSolicitud(candidato,{expectedRevision:2});
   remoto={storeId:'romo:serena',revision:3,
    snapshot:mismatch?{...snapshot,cifrado:'distinto'}:snapshot};
   return sesion.confirmarGuardadoAtomico({
    expectedRevision:2,revision:3,snapshot,estado:candidato
   });
  }};
}
test('Pedido de carta confirma ciphertext exacto con Neon tras PATCH',async()=>{
 const f=sesionFixture();
 await f.sesion.abrir({googleVerificado:true,claveUkiVerificada:true});
 const candidate=estado();candidate.pedidos.push({suc:SUC,id:12,pagado:false});
 const r=await f.confirmar(candidate);
 assert.equal(r.revision,3);
 assert.equal(f.sesion.estado().revision,3);
});
test('Estado de carta no coincidente bloquea reintento',async()=>{
 const f=sesionFixture({mismatch:true});
 await f.sesion.abrir({googleVerificado:true,claveUkiVerificada:true});
 const candidate=estado();candidate.pedidos.push({suc:SUC,id:12,pagado:false});
 await assert.rejects(()=>f.confirmar(candidate),/Neon no confirma/);
 assert.throws(()=>f.sesion.estado(),/recarga antes de guardar/);
});
test('La carta no usa la escritura simple de caja para aceptar solicitudes',()=>{
 const controller=readFileSync(new URL('../firebase/uki-romo-integracion-panel-qa.mjs',import.meta.url),'utf8');
 const atomic=readFileSync(new URL('../firebase/uki-romo-guardado-atomico-qa.mjs',import.meta.url),'utf8');
 assert.match(controller,/crearGuardadoRomoDesdeFormularioQA/);
 assert.match(controller,/session\.confirmarGuardadoAtomico/);
 assert.match(controller,/obtenerTurnoRomoFolioQA/);
 assert.match(atomic,/bandeja\.confirmarGuardado/);
 assert.match(atomic,/expectedRevision:revision,snapshot/);
 assert.match(controller,/const bandejaRomoPanelUnicoQA=crearBandejaRomoMismoPanelQA\(\)/);
 assert.match(atomic,/ROMO_GUARDADO_ATOMICO_HABILITADO_QA=false/);
});

test('Pedido manual Romo sin pagar reutiliza folio del turno y no toca Uki',()=>{
 const day='2026-11-17',inicio=Date.parse('2026-11-17T10:00:00Z');
 const e={...estado(),nextId:12,fechaOperativa:day,
  cajasDiarias:{[SUC+'|'+day]:{turnoAbierto:true,baseConfirmada:true,inicioMs:inicio,turnoId:day+'@'+inicio}}};
 const borrador={cliente:'Ana',telefono:'56912345678',modalidad:'Retiro',
  medio:'Efectivo',pagado:false,propinaModo:'ninguna',codigoCarta:'',
  items:[{nombre:'Handroll pollo',cant:2,precio:2500,det:'sin salsa'}]};
 const res=prepararPedidoManualPendienteRomoQA(e,{
  draft:borrador,registradoEn:inicio+3000,
  fechaOperativa:day,confirmoSinPago:true
 });
 assert.equal(res.pedidoId,12);
 assert.equal(res.total,5000);
 assert.equal(e.pedidos.length,2);
 assert.equal(e.pedidos[1].pagado,false);
 assert.equal(e.pedidos[1].turnoClave,day+'@'+inicio);
 assert.equal(e.pedidos[1].numeroTurno,1);
 assert.equal(e.pedidos[1].suc,SUC);
 assert.equal(e.nextId,13);
 assert.equal(e.propinas.length,0);
});
test('Pedido manual no permite carta, cobro simulado ni turno cerrado',()=>{
 const day='2026-11-17',inicio=Date.parse('2026-11-17T10:00:00Z');
 const estadoLocal={...estado(),nextId:12,cajasDiarias:{
  [SUC+'|'+day]:{turnoAbierto:true,baseConfirmada:true,inicioMs:inicio,turnoId:day+'@'+inicio}}};
 const draft={cliente:'Ana',modalidad:'Retiro',medio:'Efectivo',
  items:[{nombre:'Handroll pollo',cant:1,precio:2500}]};
 const args={draft,registradoEn:inicio+3000,fechaOperativa:day,confirmoSinPago:true};
 assert.throws(()=>prepararPedidoManualPendienteRomoQA(structuredClone(estadoLocal),
  {...args,draft:{...draft,codigoCarta:'ROMO-77'}}),/bandeja de carta/);
 assert.throws(()=>prepararPedidoManualPendienteRomoQA(structuredClone(estadoLocal),
  {...args,draft:{...draft,pagado:true}}),/sin cobros/);
 assert.throws(()=>prepararPedidoManualPendienteRomoQA(structuredClone(estadoLocal),
  {...args,confirmoSinPago:false}),/quedará sin pagar/);
 const cerrado=structuredClone(estadoLocal);
 cerrado.cajasDiarias[SUC+'|'+day].turnoAbierto=false;
 assert.throws(()=>prepararPedidoManualPendienteRomoQA(cerrado,args),/Abre y confirma/);
 assert.equal(estadoLocal.pedidos.length,1,'Sin mutar la copia base');
});
test('Pedido manual se expone solo a través del mismo coordinador CAS desactivado',()=>{
 const file=readFileSync(new URL('../firebase/uki-romo-transacciones-panel-unico-qa.mjs',import.meta.url),'utf8');
 assert.match(file,/prepararPedidoManualPendienteRomoQA/);
 assert.match(file,/guardarPedidoManual:/);
 assert.match(file,/ROMO_TRANSACCIONES_PANEL_UNICO_QA_HABILITADAS=false/);
 assert.match(file,/sesion\.guardar\(copia\)/);
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 assert.match(html,/tipo==='pedido_manual'\|\|tipo==='pedido_carta'/);
 assert.match(html,/nuevoDraft\(\);S\.vista='pedidos'/);
 assert.match(html,/window\.ukiRomoAplicarConfirmadoPanelUnicoQA/);
});

test('El panel unido no arrastra cambios financieros previos al CAS',async()=>{
 const f=fixture();
 // La condición vive en el adaptador de sesión; se comprueba ANTES de escribir.
 const source=readFileSync(new URL('../firebase/uki-romo-transacciones-panel-unico-qa.mjs',import.meta.url),'utf8');
 const session=readFileSync(new URL('../lib/romo-panel-unico-sesion-qa.mjs',import.meta.url),'utf8');
 assert.match(source,/sesion\.coincideEstadoOperativo\(visible\.estado\)===true/);
 assert.match(session,/CAMPOS_OPERATIVOS/);
 assert.match(session,/firmaOperativa\(estado\)===firmaOperativa\(JSON\.parse\(current\.ultimoEstado\)\)/);
 assert.equal(f.guardados(),0);
});

test('Revisión de la vista no se adelanta a Neon antes de aplicar confirmado',()=>{
 const html=readFileSync(new URL('../firebase/uki-sushi-local.html',import.meta.url),'utf8');
 const adapter=readFileSync(new URL('../firebase/uki-romo-integracion-panel-qa.mjs',import.meta.url),'utf8');
 assert.match(adapter,/revision=window\.ukiRomoRevisionVistaPanelUnicoQA/);
 assert.doesNotMatch(adapter,/return \{revision:session\.estado\(\)\.revision,estado:v\.estado\}/);
 assert.match(html,/window\.ukiRomoRevisionVistaPanelUnicoQA=unlocked\.revision/);
 assert.match(html,/if\(window\.ukiRomoRevisionVistaPanelUnicoQA!==revision-1\)/);
 assert.match(html,/render\(\);\s*window\.ukiRomoRevisionVistaPanelUnicoQA=revision/);
 assert.match(html,/window\.ukiRomoRevisionVistaPanelUnicoQA=null/);
});
