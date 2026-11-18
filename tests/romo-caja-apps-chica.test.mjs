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

test('Anulación auditada en QA restaura saldo sin borrar trazabilidad',async()=>{
 const x=sim();
 await x.ctx.ukiRomoGuardarMovimientoQA('chica');
 const key=x.S.suc+'|2026-11-17';
 const gasto=x.store.saved[0].cajasDiarias[key].cajaChica.gastos[0];
 x.S.cajasDiarias[key]=x.store.saved[0].cajasDiarias[key];
 x.ctx.ukiRomoGastoChicaAnularQA=gasto.id;
 await x.ctx.ukiRomoGuardarMovimientoQA('anularChica');
 assert.equal(x.store.saved.length,2);
 const chica=x.store.saved[1].cajasDiarias[key].cajaChica;
 assert.equal(chica.gastos.length,0);
 assert.equal(chica.anulaciones.length,1);
 assert.equal(chica.anulaciones[0].motivo,'Registro equivocado');
 assert.equal(chica.anulaciones[0].monto,1500);
});
test('No se permite cambiar base después de registrar Apps o Caja chica',async()=>{
 const x=sim();
 await x.ctx.ukiRomoGuardarMovimientoQA('app');
 const key=x.S.suc+'|2026-11-17';
 Object.assign(x.caja,x.store.saved[0].cajasDiarias[key]);
 x.S.cajasDiarias[key]=x.caja;
 x.fields.romoBaseQA='10000';x.fields.romoCajaChicaQA='5000';
 await x.ctx.ukiRomoGuardarMovimientoQA('base');
 assert.equal(x.store.saved.length,1);
 assert.match(x.store.alerts.join(' '),/base solo puede establecerse antes/);
});
test('Integración cierre completo Romo: Apps y Caja chica no se duplican',async()=>{
 const {prepararAperturaTurnoRomoQA,prepararCierreDefinitivoRomoQA}=
  await import('../firebase/uki-romo-cierre-definitivo-qa.mjs');
 const ms=Date.now(),f=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Santiago',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
 const n=k=>f.find(v=>v.type===k)?.value;
 const dia=[n('year'),n('month'),n('day')].join('-');
 const suc='Romo’s Sushi La Serena';
 const s={suc,pedidos:[],gastos:[],retiros:[],propinas:[],cierres:[],
  deliveriesManuales:[],incidencias:[],clientes:{},cajasDiarias:{},
  nextId:1,nextIncidenciaId:1};
 prepararAperturaTurnoRomoQA(s,{fechaOperativa:dia,inicioMs:ms-60000,
  responsable:'Encargada',base:0,cajaChicaInicial:5000});
 const c=s.cajasDiarias[suc+'|'+dia];
 c.apps['Uber Eats']=7000;
 c.movimientosApps.push({id:ms-1,monto:9000,medio:'Uber Eats',concepto:'Total previo'});
 c.movimientosApps.push({id:ms,monto:7000,medio:'Uber Eats',concepto:'Corrección total'});
 c.cajaChica.gastos.push({id:ms,monto:1200,concepto:'Detergente'});
 const result=prepararCierreDefinitivoRomoQA(s,{fechaOperativa:dia,
  cierreMs:ms+1000,responsable:'Encargada',efectivoContado:0});
 assert.equal(result.cierre.venta,7000);
 assert.equal(result.cierre.medios['Uber Eats'],7000);
 assert.equal(result.cierre.cajaChicaGastos,1200);
 assert.equal(result.cierre.final,7000);
 assert.equal(c.turnoAbierto,false);
 assert.equal(s.cierres.length,1);
 assert.throws(()=>prepararCierreDefinitivoRomoQA(s,{fechaOperativa:dia,
  cierreMs:ms+2000,responsable:'Encargada',efectivoContado:0}),
  /Abre primero un turno Romo|cierre definitivo/);
});
