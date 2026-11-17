import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {crearSesionPanelUnicoRomoQA} from '../public/romo-panel-qa/romo-panel-unico-sesion-qa.mjs';

const SUC='Romo’s Sushi La Serena';
const clone=x=>JSON.parse(JSON.stringify(x));
const base=()=>({
 suc:SUC,vista:'inicio',base:0,
 pedidos:[{suc:SUC,id:1,estado:'Pendiente',pagado:false,total:1000}],
 gastos:[],retiros:[],propinas:[],cierres:[],apps:{},
 pagoDelivery:0,pagoDeliveryMedio:'Efectivo',deliveriesManuales:[],
 ajustesHistoricos:[],borradores:[],solicitudesWhatsApp:[],
 cajaChica:{inicial:0,gastos:[]},clientes:{},cajasDiarias:{},
 incidencias:[],nextIncidenciaId:1,nextId:2
});
const create=({failure=false}={})=>{
 let writes=0;
 const session=crearSesionPanelUnicoRomoQA({
  vault:{
   disponible:()=>true,
   cargarSobre:async()=>({revision:2,snapshot:{sucursal:SUC}}),
   guardarSobre:async({expectedRevision})=>{
    writes++;
    if(failure)throw Error('corte de red simulado');
    return {revision:expectedRevision+1};
   }
  },
  validarEstado:(x,s)=>x?.suc===s&&Array.isArray(x.pedidos),
  desbloquearSobre:async()=>({estado:base(),cifrar:async()=>({
    sucursal:SUC,formato:'uki-v813-browser',version:1,
    salt:'AA',iv:'AA',cifrado:'AA'
  })}),
  prepararEstadoInicial:async()=>({estado:base(),cifrar:async()=>({
    sucursal:SUC,formato:'uki-v813-browser',version:1
  })})
 });
 return {session,getWrites:()=>writes};
};
const enter=async session=>session.abrir({
 googleVerificado:true,claveUkiVerificada:true
});
const fakeCaja=()=>({apps:{},pagoDelivery:0,pagoDeliveryMedio:'Efectivo',
 base:0,cajaChica:{inicial:0,gastos:[]},
 baseConfirmada:false,desdeMs:0,inicioMs:Date.now()});

test('La sesión no proporciona estado confirmado antes de abrir Romo',()=>{
 const {session}=create();
 assert.equal(session.coincideEstadoOperativo(base()),false);
 assert.throws(()=>session.estadoOperativoConfirmado());
});

test('Navegación, filtros y caja vacía creados por render no cambian el operativo',async()=>{
 const {session}=create();await enter(session);
 const local=base();
 local.vista='pedidos';local.filtro='cliente';
 local.romoIngresadoQA=true;local.romoSeleccionadoQA=false;
 local.fechaOperativa='2026-11-17';
 local.cajasDiarias[SUC+'|2026-11-17']=fakeCaja();
 assert.equal(session.coincideEstadoOperativo(local),true);
 assert.deepEqual(session.estadoOperativoConfirmado().cajasDiarias,{});
 assert.equal(session.estadoOperativoConfirmado().fechaOperativa,undefined);
 session.cerrar();
});

test('Rechaza cambios en pedidos, caja, cobros, fecha registrada y nuevos campos',async()=>{
 const {session}=create();await enter(session);
 const original=base();
 const edit=cb=>{const x=clone(original);cb(x);return x};
 assert.equal(session.coincideEstadoOperativo(edit(x=>x.pedidos[0].total=1200)),false);
 assert.equal(session.coincideEstadoOperativo(edit(x=>x.pedidos[0].pagado=true)),false);
 assert.equal(session.coincideEstadoOperativo(edit(x=>x.base=20000)),false);
 assert.equal(session.coincideEstadoOperativo(edit(x=>x.cajasDiarias[SUC+'|2026-11-17']={
  ...fakeCaja(),base:500
 })),false);
 assert.equal(session.coincideEstadoOperativo(edit(x=>x.otroDato=123)),false);
 session.cerrar();
});

test('Una caja existente alterada no se confunde con caja virtual',async()=>{
 const {session}=create();await enter(session);
 const snapshot=session.estadoOperativoConfirmado();
 snapshot.cajasDiarias[SUC+'|2026-11-14']=fakeCaja();
 assert.equal(session.coincideEstadoOperativo(snapshot),false);
 session.cerrar();
});

test('La copia confirmada no modifica el original ni se alimenta desde la pantalla',async()=>{
 const {session}=create();await enter(session);
 const original=session.estadoOperativoConfirmado();
 original.pedidos[0].estado='Cancelado';
 assert.equal(session.estadoOperativoConfirmado().pedidos[0].estado,'Pendiente');
 session.cerrar();
});

test('Una escritura simulada confirmada cambia el baseline; conflicto lo bloquea',async()=>{
 const {session,getWrites}=create();await enter(session);
 const candidate=session.estadoOperativoConfirmado();
 candidate.pedidos[0].estado='Cancelado';
 const r=await session.guardar(candidate);
 assert.equal(r.revision,3);
 assert.equal(r.changed,true);
 assert.equal(getWrites(),1);
 assert.equal(session.coincideEstadoOperativo(candidate),true);
 assert.equal(session.coincideEstadoOperativo(base()),false);
 session.cerrar();
 const fail=create({failure:true});await enter(fail.session);
 const next=fail.session.estadoOperativoConfirmado();
 next.pedidos[0].estado='Cancelado';
 await assert.rejects(fail.session.guardar(next),/resultado incierto/);
 assert.equal(fail.session.coincideEstadoOperativo(base()),false);
});

test('El controlador usa estado confirmado y no arrastra una caja de render',()=>{
 const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
 const segment=html.slice(html.indexOf('async function ukiRomoCambiarEstadoQA('),
  html.indexOf('const ROMO_MEDIOS_SALIDAS_QA='));
 assert.match(segment,/sesion\.coincideEstadoOperativo\(visible\)!==true/);
 assert.match(segment,/sesion\.estadoOperativoConfirmado\(\)/);
 assert.match(segment,/const anterior=accion==='cancelar'\?/);
 assert.ok(segment.indexOf('sesion.estadoOperativoConfirmado()')<
  segment.indexOf('prepararConciliacionCancelacionRomoQA('));
});
