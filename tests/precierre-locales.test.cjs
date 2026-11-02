'use strict';
/* Pruebas aisladas, sin Firebase ni registros reales; ejecuta: node --test tests/precierre-locales.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');

const root=join(__dirname,'..','firebase');
const html=readFileSync(join(root,'uki-sushi-local.html'),'utf8');
const begin=html.indexOf('// Precierre por trabajador dentro de la misma caja cifrada');
const end=html.indexOf('\nfunction setModalidad(',begin);
assert.ok(begin>=0&&end>begin,'Archivo fuente v8.15 con precierre');
const helpers=html.slice(begin,end);
const branches=['Uki Regimiento Arica','Uki La Serena'];
const methods=['Efectivo','Transferencia','Débito','Edenred','Otros','Uber Eats','PedidosYa','Rappi'];
const clone=x=>JSON.parse(JSON.stringify(x));
function testContext(){
 let t=Date.parse('2026-11-02T16:00:00Z'),allowed=true,calls=0,reports=[],alert='';
 const S={suc:branches[0],cajasDiarias:{},busy:false,filtro:'',filtroFecha:''};
 const fields={ukiTrabajador:{value:'María'},ukiEfectivoPrecierre:{value:'18000'},
  ukiObsPrecierre:{value:'Turno mañana'}};
 const total={totalMedios:0,pagadosN:0,envios:0,gastosTotal:0,
  pagoDelivery:0,retirosTotal:0,efectivoCaja:0,
  medios:Object.fromEntries(methods.map(m=>[m,0]))};
 class Clock extends Date{
  constructor(...args){super(...(args.length?args:[t]))}
  static now(){return t}
 }
 const box=()=>S.cajasDiarias[S.suc+'|2026-11-02']||=
  {base:18000,apps:{},pagoDelivery:0,cajaChica:{inicial:20000,gastos:[]}};
 const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const fmt=x=>'$'+Number(x||0).toLocaleString('es-CL');
 const csvSeguro=x=>{
  let v=String(x??'').replace(/[\r\n\x00-\x1F]+/g,' ');
  if(/^\s*[=+\-@]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
 };
 const make=new Function('S','SUCURSALES','MEDIOS','cajaDelDia','totales','esc',
  'row','fmt','window','aviso','$','guardarEnLocalStorage','descargarTextoArchivo',
  'confirm','Date','hoyLocal','csvSeguro','fechaOperativaActual',
  helpers+'\nreturn {ukiIniciarPrecierre,ukiGuardarPrecierre,ukiPrecierresGuardados,'+
  'ukiDiferenciaPrecierre,ukiPrecierresFiltrados,vPrecierreTrabajadores,'+
  'vHistorialPrecierres,ukiExportarPrecierres};');
 const f=make(S,branches,methods,box,()=>clone(total),esc,
  (key,val)=>'<p>'+esc(key)+': '+esc(val)+'</p>',fmt,
  {ukiCancelacionNubeLista:()=>allowed},x=>{alert=x},
  id=>fields[id],()=>{calls++;return Promise.resolve(true)},
  (name,text)=>reports.push({name,text}),()=>true,Clock,()=> '2026-11-02',
  csvSeguro,()=> '2026-11-02');
 return {S,fields,total,box,f,reports,
  tick:n=>t+=n,cloud:v=>allowed=v,notice:()=>alert,saves:()=>calls};
}
test('Dos trabajadores, dos precierres, mismo total sin cerrar el día',()=>{
 const x=testContext();
 x.f.ukiIniciarPrecierre();
 assert.equal(x.box().turnoPrecierreAbierto.nombre,'María');
 Object.assign(x.total,{totalMedios:18000,pagadosN:3,envios:1000,efectivoCaja:18000});
 x.total.medios.Efectivo=18000;x.tick(3600000);
 x.f.ukiGuardarPrecierre();
 x.fields.ukiTrabajador.value='Ana';
 x.f.ukiIniciarPrecierre();
 Object.assign(x.total,{totalMedios:34000,pagadosN:8,envios:2000,efectivoCaja:22000});
 x.total.medios.Efectivo=22000;x.total.medios.Transferencia=12000;
 x.tick(3600000);x.fields.ukiEfectivoPrecierre.value='4000';
 x.f.ukiGuardarPrecierre();
 const turns=x.box().precierres;
 assert.deepEqual(turns.map(z=>z.nombre),['María','Ana']);
 assert.deepEqual(turns.map(z=>z.totales.venta),[18000,16000]);
 assert.deepEqual(turns.map(z=>z.totales.pagados),[3,5]);
 assert.equal(x.total.totalMedios,34000);
 assert.equal(x.box().turnoPrecierreAbierto,null);
 assert.ok(x.saves()>=4);
});
test('Nube en conflicto no registra inicio ni precierre',()=>{
 const x=testContext();
 x.cloud(false);x.f.ukiIniciarPrecierre();
 assert.equal(x.box().turnoPrecierreAbierto,undefined);
 x.cloud(true);x.f.ukiIniciarPrecierre();
 x.total.totalMedios=10000;x.total.medios.Efectivo=10000;
 x.cloud(false);x.f.ukiGuardarPrecierre();
 assert.equal(x.box().precierres,undefined);
 assert.ok(x.box().turnoPrecierreAbierto);
});
test('No registra diferencias negativas por ajustes de pagos anteriores',()=>{
 const x=testContext();
 x.total.medios.Efectivo=10000;x.total.totalMedios=10000;
 x.f.ukiIniciarPrecierre();
 x.total.medios.Efectivo=5000;x.total.totalMedios=5000;
 x.f.ukiGuardarPrecierre();
 assert.ok(!x.box().precierres);
 assert.ok(x.box().turnoPrecierreAbierto);
});
test('Sucursal distinta no ve los precierres ni mezcla los reportes',()=>{
 const x=testContext();x.f.ukiIniciarPrecierre();
 x.total.totalMedios=18000;x.total.medios.Transferencia=18000;
 x.f.ukiGuardarPrecierre();
 assert.equal(x.f.ukiPrecierresGuardados().length,1);
 x.S.suc=branches[1];
 assert.equal(x.f.ukiPrecierresGuardados().length,0);
 x.f.ukiExportarPrecierres();
 assert.equal(x.reports.length,0);
});
test('Excel respeta filtros del historial y escapa entradas peligrosas',()=>{
 const x=testContext();x.fields.ukiTrabajador.value='=IMPORT';
 x.f.ukiIniciarPrecierre();
 x.total.totalMedios=1500;x.total.medios.Transferencia=1500;
 x.f.ukiGuardarPrecierre();
 x.S.filtro='no existe';x.f.ukiExportarPrecierres();
 assert.equal(x.reports.length,0);
 x.S.filtro='IMPORT';x.f.ukiExportarPrecierres();
 assert.equal(x.reports.length,1);
 assert.match(x.reports[0].text,/'=IMPORT/);
 assert.match(x.reports[0].name,/regimiento/);
});
test('Cierre definitivo bloqueado si existe precierre abierto',()=>{
 assert.match(html,/function cerrar\(\)\{\s*if\(S\.busy\)return;\s*if\(cajaDelDia\(\)\.turnoPrecierreAbierto\)/);
});
test('Integración: la partición cifrada conserva caja, precierres y pedidos',async()=>{
 const partition=readFileSync(join(root,'uki-particion-local.js'),'utf8');
 const mod=new Function(partition.replace(/\bexport\s+function\b/g,'function')+
  '\nreturn {dividirEstado,reunirEstado}')();
 const suc=branches[0],x=testContext();
 x.f.ukiIniciarPrecierre();
 x.total.totalMedios=10000;x.total.medios.Efectivo=10000;
 x.f.ukiGuardarPrecierre();
 const S={...x.S,suc,
  pedidos:[{id:42,suc,fechaISO:'2026-11-02T12:00:00',pagado:true,total:10000}],
  gastos:[],retiros:[],propinas:[],cierres:[],deliveriesManuales:[],incidencias:[],
  clientes:{},nextId:43,nextIncidenciaId:1};
 const parts=mod.dividirEstado(S,suc),restored=mod.reunirEstado(parts,suc);
 assert.deepEqual(restored.cajasDiarias,S.cajasDiarias);
 assert.deepEqual(restored.pedidos,S.pedidos);
});
