import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ddl=readFileSync(new URL('../sql/romo-solicitudes-carta-v1-20261113.sql',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/romo-solicitudes-carta-qa.js',import.meta.url),'utf8');
const orders=readFileSync(new URL('../lib/romo-solicitudes-carta-qa.mjs',import.meta.url),'utf8');
const reservas=readFileSync(new URL('../lib/romo-reservas-carta-qa.mjs',import.meta.url),'utf8');
const receipt=readFileSync(new URL('../lib/romo-comprobante-guardado-qa.mjs',import.meta.url),'utf8');
test('DDL exclusivo de Romo nunca toca datos Uki ni caja',()=>{
 assert.match(ddl,/CREATE TABLE IF NOT EXISTS public\.romo_solicitudes_carta_v1/);
 assert.match(ddl,/CHECK \(store_id = 'romo:serena'\)/);
 assert.match(ddl,/REVOKE ALL ON TABLE public\.romo_solicitudes_carta_v1 FROM PUBLIC/);
 assert.doesNotMatch(ddl,/CREATE TABLE.*uki|UPDATE\s+.*uki|INSERT INTO.*(?:caja|ventas|timbres)/i);
});
test('La tabla comprende todos los campos usados por solicitudes, reservas y comprobantes',()=>{
 const fields=['id','store_id','request_key','codigo_pedido','cliente','telefono',
 'mensaje','total_indicado','ip_hash','estado','whatsapp_confirmado',
 'motivo_rechazo','actualizado_por','reserva_token_hash','reserva_hasta',
 'pedido_interno','creado_en','actualizado_en'];
 for(const field of fields)
  assert.match(ddl,new RegExp('(^|\\n) '+field+' ','m'),field);
 for(const source of [orders,reservas,receipt])
  assert.match(source,/public\.romo_solicitudes_carta_v1/);
});
test('Una solicitud aceptada necesita pedido interno y nunca confirma WhatsApp por sí sola',()=>{
 assert.match(ddl,/estado <> 'aceptada' OR length\(pedido_interno\)>0/);
 assert.match(ddl,/CHECK \(whatsapp_confirmado=false\)/);
 assert.match(ddl,/DEFAULT 'pendiente'/);
 assert.match(api,/ROMO_CARTA_SOLICITUDES_LIVE_ENABLED/);
 assert.match(api,/ROMO_CARTA_ACEPTACION_LIVE_ENABLED/);
});
test('Protege claves duplicadas, limites, reserva por sucursal y tasa de solicitudes',()=>{
 assert.match(ddl,/request_key text NOT NULL UNIQUE/);
 assert.match(ddl,/store_id,estado,creado_en DESC/);
 assert.match(ddl,/ip_hash,creado_en/);
 assert.match(ddl,/CHECK \(ip_hash ~ /);
 assert.match(ddl,/reserva_token_hash='' OR reserva_hasta IS NOT NULL/);
 assert.match(ddl,/CREATE UNIQUE INDEX IF NOT EXISTS romo_solicitudes_pedido_confirmado_unico_idx/);
 assert.match(ddl,/WHERE estado='aceptada' AND pedido_interno<>''/);
 assert.match(receipt,/SET estado='aceptada',pedido_interno=\$4,reserva_token_hash=''/);
 assert.match(ddl,/store_id,reserva_hasta/);
 assert.match(ddl,/estado='pendiente' AND reserva_token_hash<>''/);
});
