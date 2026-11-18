import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../public/romo-panel-qa/index.html',import.meta.url),'utf8');
const begin=html.indexOf('async function ukiRomoGuardarMovimientoQA(');
const end=html.indexOf('\n}',begin);
assert.ok(begin>=0&&end>begin);
const handler=html.slice(begin,end+2);
function sim(){
 const now=Date.now(),dia='2026-11-17',suc='Romo’s Sushi La Serena';
 const caja={turnoAbierto:true,baseConfirmada:true,turnoId:dia+'@'+(now-10000),
  inicioMs:now-10000,base:10000,cajaChica:{inicial:5000,gastos:[]},apps:{}};
 const S={suc,fechaOperativa:dia,pedidos:[],gastos:[],retiros:[],cierres:[],
  propinas:[],deliveriesManuales:[],incidencias:[],clientes:{},
  cajasDiarias:{[suc+'|'+dia]:caja},nextId:1,nextIncidenciaId:1};
 const fields={
  romoAppMedioQA:'Uber Eats',romoAppMontoQA:'9000',romoAppConceptoQA:'Venta manual',
  romoAppResponsableQA:'Encargada',romoChicaConceptoQA:'Detergente',
  romoChicaMontoQA:'1500',romoChicaResponsableQA:'Encargada',
  romoChicaMotivoQA:'Registro equivocado'
 };
 const store={saved:[],alerts:[]};
 const ctx={S,ROMO_SUCURSAL_QA:suc,APPS:['Uber Eats','PedidosYa','Rappi'],
  ukiRomoGastoChicaAnularQA:null,ukiRomoOperacionesEnCursoQA:()=>false,
  window:{ukiRomoSesionRemotaQA:{disponible:()=>true},confirm:()=>true},
  $:id=>fields[id]===undefined?null:{value:fields[id]},
  datosSoloSucursal:()=>JSON.parse(JSON.stringify(S)),
  fechaOperativaActual:()=>dia,cajaDelDia:()=>caja,
  totales:()=>({totalMedios:0,pagoDelivery:0}),
  delSucHoy:()=>[],ukiRomoCajaDisponibleQA:()=>10000,
  ukiRomoMontoCampoQA:(id,max=1e7,zero=false)=>{
   const t=String(fields[id]??'').trim(),n=Number(t);
   if(t===''||!Number.isSafeInteger(n)||n>(max)||n<(zero?0:1))throw Error('Monto inválido');
   return n;
  },ukiRomoTextoCampoQA:(id,max,min)=>{
   const t=String(fields[id]||'').trim();
   if(t.length<min||t.length>max)throw Error('Texto inválido');return t;
  },ukiRomoGuardarOperacionQA:async(copy)=>store.saved.push(copy),
  aviso:x=>store.alerts.push(x),fmt:n=>'$'+n
 };
 vm.createContext(ctx);vm.runInContext(handler,ctx);
 return {ctx,fields,store,caja,S};
}
test('Apps fija total absoluto, conserva responsable y bloquea doble registro',async()=>{
 const x=sim();await x.ctx.ukiRomoGuardarMovimientoQA('app');
 assert.equal(x.store.saved[0].cajasDiarias[x.S.suc+'|2026-11-17'].apps['Uber Eats'],9000);
 const a=x.store.saved[0].cajasDiarias[x.S.suc+'|2026-11-17'].movimientosApps[0];
 assert.equal(a.delta,9000);assert.equal(a.responsable,'Encargada');
 x.S.cajasDiarias[x.S.suc+'|2026-11-17'].apps['Uber Eats']=9000;
 await x.ctx.ukiRomoGuardarMovimientoQA('app');
 assert.equal(x.store.saved.length,1);
});
test('Caja chica respeta saldo y no aumenta ni reduce caja mayor',async()=>{
 const x=sim();
 await x.ctx.ukiRomoGuardarMovimientoQA('chica');
 const c=x.store.saved[0].cajasDiarias[x.S.suc+'|2026-11-17'];
 assert.equal(c.base,10000);assert.equal(c.cajaChica.gastos[0].monto,1500);
 assert.equal(c.cajaChica.gastos[0].responsable,'Encargada');
 x.fields.romoChicaMontoQA='6000';
 await x.ctx.ukiRomoGuardarMovimientoQA('chica');
 assert.equal(x.store.saved.length,1);
});
test('No se guardan movimientos con turno cerrado ni sucursal Uki',async()=>{
 const x=sim();x.caja.turnoAbierto=false;
 await x.ctx.ukiRomoGuardarMovimientoQA('app');
 assert.equal(x.store.saved.length,0);
 const y=sim();y.S.suc='Uki La Serena';
 await y.ctx.ukiRomoGuardarMovimientoQA('chica');
 assert.equal(y.store.saved.length,0);
});
test('Los formularios y el cierre conservan guardado aislado y QA',()=>{
 for(const q of ['romoAppMontoQA','romoAppResponsableQA',
  'romoChicaMontoQA','romoChicaMotivoQA','anularChica'])assert.ok(html.includes(q));
 assert.match(html,/await ukiRomoGuardarOperacionQA\(copia,descripcion,null,'caja'\)/);
 assert.match(html,/if\(window\.ukiRomoGuardadoHabilitadoQA\?\.\(\)!==true\)/);
 assert.match(html,/prepararCierreDefinitivoRomoQA\(copia/);
});
