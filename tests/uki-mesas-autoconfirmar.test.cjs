'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Pruebas 100 % ficticias: sin Firebase, sin Neon y sin caja de producción.
const html = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'uki-sushi-local.html'), 'utf8');
const beginning = 'async function ukiMesaConfirmarGuardadosSeguro(){';
const start = html.indexOf(beginning);
const end = html.indexOf('\nsetInterval(', start);
assert.ok(start > 0 && end > start, 'Falta la confirmación automática en el panel.');
const implementation = 'let ukiMesasConfirmando=false;\n' + html.slice(start, end) +
  '\nukiMesaConfirmarGuardadosSeguro;';

const qr = (id, branch='arica') => ({ id, branch });
function scenario(opts={}) {
  let branch=opts.branch || 'arica';
  let synced=opts.synced ?? true;
  const accepted=[];
  const state={
    S:{suc:'Uki Regimiento Arica',pedidos:opts.orders || [{suc:'Uki Regimiento Arica',qrSolicitudes:['MESA-A1']}]},
    ukiMesas:{rows:opts.rows || [qr('a1')],branch:'arica',busy:opts.busy || false},
    UKI_MESAS_ENDPOINT:opts.live?'live':'qa',
    UKI_MESAS_LIVE_URL:'live',
    ukiMesaRegistrarRondaCentral:opts.central || (async id=>{accepted.push(id);return true;}),
    window:{ukiCancelacionNubeLista:()=>synced},
    ukiMesaBranch:()=>branch,
    ukiMesaCode:id=>'MESA-'+String(id).toUpperCase(),
    ukiPedidoTieneQR:(p,code)=>Array.isArray(p.qrSolicitudes)&&p.qrSolicitudes.includes(code),
    ukiMesaEstado:opts.ack || (async id=>{accepted.push(id);return true;})
  };
  const fn=vm.runInNewContext(implementation,state,{timeout:1000});
  return {fn,accepted,setBranch:v=>{branch=v;},setSynced:v=>{synced=v;}};
}
test('Sin Nube sincronizado no confirma aunque exista pedido local',async()=>{
  const x=scenario({synced:false});await x.fn();assert.deepEqual(x.accepted,[]);
});
test('Con guardado sincronizado confirma una sola solicitud QR de la mesa',async()=>{
  const x=scenario();await x.fn();assert.deepEqual(x.accepted,['a1']);
});
test('No confirma pedidos de otra sucursal ni pedidos inexistentes',async()=>{
  const x=scenario({rows:[qr('a1','serena'),qr('a2'),qr('a1')]});
  await x.fn();assert.deepEqual(x.accepted,['a1']);
});
test('No confirma mientras se está consultando la bandeja',async()=>{
  const x=scenario({busy:true});await x.fn();assert.deepEqual(x.accepted,[]);
});
test('Bloquea dos intentos simultáneos para evitar duplicaciones',async()=>{
  let finish;
  const accepted=[];
  const x=scenario({ack:async id=>{accepted.push(id);await new Promise(resolve=>{finish=resolve;});}});
  const first=x.fn();
  await x.fn();
  assert.deepEqual(accepted,['a1']);
  finish();
  await first;
});
test('Si cambia la sucursal durante el envío no confirma la siguiente solicitud',async()=>{
  let x;
  const accepted=[];
  x=scenario({rows:[qr('a1'),qr('a2')],orders:[
    {suc:'Uki Regimiento Arica',qrSolicitudes:['MESA-A1','MESA-A2']}],
    ack:async id=>{accepted.push(id);x.setBranch('serena');}
  });
  await x.fn();assert.deepEqual(accepted,['a1']);
});
test('La interfaz no solicita otra cuenta individual para el personal',()=>{
  assert.ok(html.includes('El personal conserva su código habitual'));
  assert.ok(!html.includes('Acceso del personal (configuración opcional)'));
});

test('Las vistas Preview no pueden habilitar escritura operativa real',()=>{
  assert.ok(html.includes("const UKI_OPERACION_HABILITADA=location.hostname==='diannaleandra-art.github.io'"));
});

test('El panel operativo nunca consulta Neon QA, y Preview nunca consulta Neon LIVE',()=>{
  const begin=html.indexOf('const UKI_MESAS_LIVE_URL=');
  const end=html.indexOf('\nlet ukiMesas=',begin);
  assert.ok(begin>0&&end>begin,'Debe existir una selección aislada del endpoint QR');
  const assignment=html.slice(begin,end);
  const value=hostname=>vm.runInNewContext(assignment+'\nUKI_MESAS_ENDPOINT',{location:{hostname}});
  assert.match(value('diannaleandra-art.github.io'),/\/api\/mesa-pedidos-live$/);
  assert.equal(value('uki-sushi-panel.vercel.app'),null);
  assert.equal(value('otro-sitio.vercel.app'),null);
  assert.match(value('uki-sushi-panel-git-preparacion-uki-p-bae8e8-diannaleandra-7046.vercel.app'),/api\/mesa-pedidos$/);
  assert.match(html,/if\(!UKI_MESAS_ENDPOINT\)return ''; \/\/ No presentar QA al personal en producción\./);
  assert.match(html,/import \{autorizarEquipoQR,obtenerSesionQR,estadoEquipoQR\}/);
  assert.match(html,/UKI_MESAS_ENDPOINT===UKI_MESAS_LIVE_URL/);
});

test('Un equipo QR no confirma registrado sin sesión Google y nube respaldada',()=>{
 assert.match(html,/const token=estado==='registrado'[\s\S]*?window\.ukiMesasTokenConfirmar/);
 assert.match(html,/window\.ukiMesasTokenConfirmar=async\(\)=>auth\.currentUser/);
 assert.match(html,/if\(!window\.ukiCancelacionNubeLista\?\.\(\)\)/);
 assert.match(html,/estado\.actualRespaldado===true/);
});

test('En modo operativo la cuenta QR usa confirmación atómica sin exigir correo individual',async()=>{
 const x=scenario({live:true,synced:false});
 await x.fn();
 assert.deepEqual(x.accepted,['a1']);
});
test('El panel QR no libera una mesa sin pago guardado y todas sus rondas',()=>{
 assert.match(html,/p\.pagado===true/);
 assert.match(html,/detalle\.every\(r=>ukiPedidoTieneQR\(p,ukiMesaCode\(r\.id\)\)\)/);
 assert.match(html,/await ukiMesaEstadoLocalGuardado\(\)/);
 assert.match(html,/method:'PATCH'/);
 assert.match(html,/api\/mesa-cuentas-live/);
});
