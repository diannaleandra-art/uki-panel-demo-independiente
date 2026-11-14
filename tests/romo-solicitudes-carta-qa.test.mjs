import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 romoSolicitudesConfig,validarSolicitudRomo,registrarSolicitudRomo,listarSolicitudesRomo,
 reservarSolicitudRomo,liberarSolicitudRomo,rechazarSolicitudRomo,aceptarYGuardarSolicitudRomo
} from '../lib/romo-solicitudes-carta-qa.mjs';
const STORE='romo:serena';
const user={brand:'romo',role:'agendador',branches:['serena'],userId:'persona_de_prueba'};
const UUID='123e4567-e89b-42d3-a456-426614174001';
const second='123e4567-e89b-42d3-a456-426614174002';
const body={storeId:STORE,key:'RomoPedido_0123456789',codigoPedido:'RMO-27',
 cliente:'Cliente prueba',telefono:'+56911111111',
 mensaje:'RMO-27 pedido de Cliente prueba con 24 piezas y retiro en Balmaceda.',totalIndicado:7000};
const snap={formato:'uki-v813-browser',version:1,sucursal:'Romo’s Sushi La Serena',
 salt:Buffer.alloc(16,1).toString('base64'),
 iv:Buffer.alloc(12,2).toString('base64'),
 cifrado:Buffer.from('this is only an encrypted mock placeholder').toString('base64')};
const origin='https://diannaleandra-art.github.io';
const env={VERCEL_ENV:'production',ROMO_OPERATIVO_LIVE_ENABLED:'true',
 ROMO_SOLICITUDES_LIVE_ENABLED:'true',ROMO_PANEL_ALLOWED_ORIGIN:origin,
 ROMO_CARTA_ALLOWED_ORIGIN:'https://uki-sushi-pedidos.vercel.app',
 ROMO_SOLICITUDES_RATE_SALT:'sal-de-pruebas-de-mas-de-24-caracteres',
 ROMO_PRIVATE_DATABASE_URL:'postgresql://usuario:clave@ep-romo-only.us-east-2.aws.neon.tech/romos_sushi',
 ROMO_PRIVATE_DATABASE_HOST:'ep-romo-only.us-east-2.aws.neon.tech'};
test('cerrada por defecto, sin producción ni claves o base autorizada',()=>{
 for(const bad of [{}, {...env,VERCEL_ENV:'preview'}, {...env,ROMO_SOLICITUDES_LIVE_ENABLED:'false'},
  {...env,ROMO_CARTA_ALLOWED_ORIGIN:origin+'/otro'},
  {...env,ROMO_PRIVATE_DATABASE_HOST:'ep-silent-cloud-b57g2l4g.c-7.us-east-2.aws.neon.tech'}]){
  assert.equal(romoSolicitudesConfig(bad),null);
 }
 assert.equal(romoSolicitudesConfig(env).storeId,STORE);
});
test('solo solicitud pendiente Romo, sin pagos ni sucursal de Uki',()=>{
 assert.equal(validarSolicitudRomo(body).total,7000);
 for(const bad of [
  {...body,storeId:'uki:serena'}, {...body,paid:true},
  {...body,estado:'aceptada'}, {...body,totalIndicado:7000.5},
  {...body,mensaje:'distinto cliente'}, {...body,key:'abc'}]){
  assert.throws(()=>validarSolicitudRomo(bad));
 }
});
test('una solicitud iniciada no representa una venta',async()=>{
 const calls=[];
 const db={query:async(sql,args)=>{
  calls.push({sql,args});
  if(sql.startsWith('SELECT id,'))return [];
  if(sql.includes('COUNT(*)'))return [{n:0}];
  if(sql.startsWith('INSERT'))return [{id:UUID}];
  throw Error('No admitir otra sentencia');
 }};
 const created=await registrarSolicitudRomo({db,body,ipHash:'a'.repeat(64)});
 assert.deepEqual(created,{ok:true,storeId:STORE,estado:'pendiente',repetido:false,countsAsSale:false,whatsappConfirmado:false});
 assert.equal(calls.length,3);
 assert(calls.every(c=>c.sql.includes('romo_solicitudes_carta_v1')));
 assert(!JSON.stringify(calls).includes('uki_carta_solicitudes_live'));
});
test('reserva, libera y rechaza solo pedidos Romo mediante token y motivo',async()=>{
 const sql=[];
 const db={query:async(q,args)=>{sql.push({q,args});return [{id:UUID,reserva_hasta:'2026-11-13T12:00:00Z'}]}};
 await reservarSolicitudRomo({db,identity:user,id:UUID,claimToken:second});
 await liberarSolicitudRomo({db,identity:user,id:UUID,claimToken:second});
 await rechazarSolicitudRomo({db,identity:user,id:UUID,motivo:'No disponible'});
 assert.equal(sql.length,3);
 assert(sql.every(x=>x.q.includes('store_id=$2')&&x.q.includes('estado=')));
 assert(sql.every(x=>!JSON.stringify(x.args).includes(second)));
 await assert.rejects(rechazarSolicitudRomo({db,identity:user,id:UUID,motivo:' '}),/motivo/);
});
test('aceptar y guardar cifrado usan UNA sentencia SQL y misma solicitud',async()=>{
 let queries=[];
 const db={query:async(q,args)=>{
  queries.push({q,args});return [{id:UUID,pedido_interno:'28',revision:args[5]+1}];
 }};
 const r=await aceptarYGuardarSolicitudRomo({db,identity:user,id:UUID,claimToken:second,
  pedidoId:'28',expectedRevision:1,snapshot:snap});
 assert.equal(r.estado,'aceptada');assert.equal(r.revision,2);
 assert.equal(queries.length,1);
 assert.match(queries[0].q,/WITH selected AS/);
 assert.match(queries[0].q,/saved AS/);
 assert.match(queries[0].q,/accepted AS/);
 assert.match(queries[0].q,/revision=revision\+1/);
 assert.equal(queries[0].args[1],STORE);
 assert(!queries[0].args[6].includes('password'));
 queries=[];
 await aceptarYGuardarSolicitudRomo({db,identity:user,id:UUID,claimToken:second,
  pedidoId:'29',expectedRevision:0,snapshot:snap});
 assert.match(queries[0].q,/INSERT INTO public\.romo_estado_operativo_v1/);
});
test('no confirmar cuando se pierde guardado o la revisión ya fue usada',async()=>{
 const db={query:async()=>[]};
 await assert.rejects(aceptarYGuardarSolicitudRomo({db,identity:user,id:UUID,
  claimToken:second,pedidoId:'10',expectedRevision:0,snapshot:snap}),e=>e.status===409);
});
test('inventario no puede ver ni aceptar; el panel oficial Uki no fue alterado',async()=>{
 const noAccess={...user,role:'inventario'};
 await assert.rejects(reservarSolicitudRomo({db:{query:async()=>[]},identity:noAccess,id:UUID,claimToken:second}));
 const server=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
 assert.match(server,/method==='POST'\?origin===config\.cartaOrigin/);
 assert.doesNotMatch(server,/uki_carta_solicitudes_live/);
});

test('las reservas de Romo expiran sin convertir solicitudes en ventas',async()=>{
 const queries=[];
 const db={query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT id,branch'))return [];
  if(sql.startsWith('UPDATE '))return [{id:UUID,reserva_hasta:'2026-11-14T04:00:00Z'}];
  throw Error('Solo lectura y reserva deben tocar solicitudes Romo');
 }};
 await listarSolicitudesRomo({db,identity:user});
 await reservarSolicitudRomo({db,identity:user,id:UUID,claimToken:second});
 await rechazarSolicitudRomo({db,identity:user,id:UUID,motivo:'Cliente ya no lo necesita'});
 assert.match(queries[0].sql,/reserva_hasta>now\(\)\) AS en_reserva/);
 assert.match(queries[1].sql,/reserva_hasta<=now\(\)/);
 assert.match(queries[1].sql,/estado='pendiente'/);
 assert.match(queries[2].sql,/reserva_hasta<=now\(\)/);
 assert.match(queries[2].sql,/reserva_token_hash='',reserva_hasta=NULL/);
 assert(queries.every(q=>/public\.romo_solicitudes_carta_v1/.test(q.sql)));
 assert(queries.every(q=>!/public\.(?:uki_|fin_)/.test(q.sql)));
 assert(queries.every(q=>!/romos?_[a-z]*pagos/i.test(q.sql)));
});
test('solo se acepta dentro de la reserva vigente y con el token correcto',async()=>{
 const queries=[];
 const db={query:async(q,args)=>{
  queries.push(q);return [{id:UUID,pedido_interno:'25',revision:Number(args[5])+1}];
 }};
 await aceptarYGuardarSolicitudRomo({db,identity:user,id:UUID,claimToken:second,
  pedidoId:'25',expectedRevision:0,snapshot:snap});
 await aceptarYGuardarSolicitudRomo({db,identity:user,id:UUID,claimToken:second,
  pedidoId:'25',expectedRevision:1,snapshot:snap});
 assert.equal(queries.length,2);
 for(const sql of queries){
  assert.match(sql,/reserva_token_hash=\$3 AND reserva_hasta>now\(\) FOR UPDATE/);
  assert.match(sql,/estado='pendiente'/);
  assert.match(sql,/WITH selected AS/);
  assert.match(sql,/accepted AS/);
 }
});
