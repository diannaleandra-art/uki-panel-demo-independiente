import test from 'node:test';
import assert from 'node:assert/strict';
import {crearGuardadoTurnosRomoQA,RomoTurnoRevisionInciertaQA}
 from '../firebase/uki-romo-turnos-atomicos-qa.mjs';
const SUC='Romo’s Sushi La Serena',day='2026-11-13';
const start=1794574800000,finish=start+3600000;
const estado=()=>({suc:SUC,pedidos:[],gastos:[],retiros:[],
 propinas:[],cierres:[],deliveriesManuales:[],clientes:{},cajasDiarias:{},
 solicitudesWhatsApp:[],nextId:1});
const startArgs={fechaOperativa:day,inicioMs:start,base:18000,
 responsable:'Encargado QA'};
const closeArgs={fechaOperativa:day,cierreMs:finish,responsable:'Encargado QA',
 efectivoContado:0};
function equipos({pending=false,fallar=false}={}){
 const server={rev:0,estado:estado(),writes:0,events:[]};
 const make=()=>{
  let visible={revision:0,estado:estado()};
  const driver=crearGuardadoTurnosRomoQA({
   habilitado:true,
   servidor:{
    disponible:()=>true,
    guardarSobreCifrado:async({snapshot,revision})=>{
     server.events.push('guardar apertura');
     if(revision!==server.rev)throw Error('409');
     server.estado=structuredClone(snapshot.estadoSoloTest);server.rev++;server.writes++;
     return {revision:server.rev};
    },
    guardarCierreSobreCifrado:async({snapshot,revision,turnoId})=>{
     server.events.push('guardar cierre');
     if(pending||revision!==server.rev)throw Error('409 sin confirmación');
     assert.match(turnoId,/^2026-11-13@/);
     server.estado=structuredClone(snapshot.estadoSoloTest);server.rev++;server.writes++;
     return {revision:server.rev,turnoId};
    }
   },
   estadoVisible:()=>visible,
   validarEstado:(e,n)=>e?.suc===n&&Array.isArray(e.cierres),
   cifrarEstado:async e=>{
    server.events.push('cifrar');
    return {formato:'uki-v813-browser',sucursal:SUC,estadoSoloTest:structuredClone(e)};
   },
   consultarPendientes:async()=>{
    server.events.push('bandeja fresca');
    if(fallar)throw Error('Sin conexión de bandeja');
    return pending?[{branch:'serena',estado:'pendiente'}]:[];
   },
   aplicarConfirmado:async({estado,revision})=>{
    server.events.push('mostrar');
    visible={estado,revision};
   }
  });
  return {driver,visible:()=>visible};
 };
 return {server,make};
}
test('apertura y cierre usan CAS antes de modificar pantalla',async()=>{
 const e=equipos(),t=e.make();
 const opened=await t.driver.abrir(startArgs);
 assert.equal(opened.revision,1);
 assert.equal(t.visible().estado.cajasDiarias[SUC+'|'+day].turnoAbierto,true);
 const closed=await t.driver.cerrar(closeArgs);
 assert.equal(closed.revision,2);
 assert.equal(t.visible().estado.cierres.length,1);
 assert.equal(t.visible().estado.cierres[0].venta,0);
 assert.equal(e.server.writes,2);
 assert.deepEqual(e.server.events,['cifrar','guardar apertura','mostrar',
  'bandeja fresca','cifrar','guardar cierre','mostrar']);
});
test('cierre falla cerrado ante solicitudes pendientes o fallo de consulta',async()=>{
 const a=equipos({pending:true}),t=a.make();
 await t.driver.abrir(startArgs);
 await assert.rejects(t.driver.cerrar(closeArgs),/solicitudes de carta pendientes/);
 assert.equal(t.visible().estado.cierres.length,0);
 assert.equal(a.server.writes,1);
 const b=equipos({fallar:true}),second=b.make();
 await second.driver.abrir(startArgs);
 await assert.rejects(second.driver.cerrar(closeArgs),/Sin conexión de bandeja/);
 assert.equal(b.server.writes,1);
});
test('dos teléfonos no pueden cerrar con la misma revisión inicial',async()=>{
 const e=equipos(),one=e.make(),two=e.make();
 await one.driver.abrir(startArgs);
 // Equipo 2 recarga la apertura, que ya se encuentra en Neon.
 const t2=e.make();
 // Simular pantalla abierta con revision actual desde servidor.
 const state=structuredClone(e.server.estado);
 let local={revision:1,estado:state};
 const other=crearGuardadoTurnosRomoQA({
  habilitado:true,
  servidor:{
   disponible:()=>true,
   guardarSobreCifrado:async()=>{throw Error('no')},
   guardarCierreSobreCifrado:async({revision})=>{
    if(revision!==e.server.rev)throw Error('conflicto');
    e.server.rev++;e.server.writes++;
    return {revision:e.server.rev};
   }
  },
  estadoVisible:()=>local,
  validarEstado:(x,s)=>x?.suc===s&&Array.isArray(x.cierres),
  cifrarEstado:async c=>({sucursal:SUC,formato:'uki-v813-browser',copia:c}),
  consultarPendientes:async()=>[],
  aplicarConfirmado:async({estado,revision})=>{local={estado,revision}}
 });
 await one.driver.cerrar(closeArgs);
 await assert.rejects(other.cerrar(closeArgs),
  e=>e instanceof RomoTurnoRevisionInciertaQA);
 assert.equal(e.server.writes,2);assert.equal(local.estado.cierres.length,0);
});
test('el control del mismo panel expone apertura y cierre y bloquea simultáneos',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('../firebase/uki-romo-panel-control-qa.mjs',import.meta.url),'utf8');
 assert.match(code,/async ejecutarTurno\(\{tipo,datos\}=\{\}\)/);
 assert.match(code,/crearGuardadoTurnosRomoQA/);
 assert.match(code,/consultarPendientes:async\(\)=>bandeja\.listar\(\)/);
 assert.match(code,/Ya hay una operación de Romo en curso/);
});
