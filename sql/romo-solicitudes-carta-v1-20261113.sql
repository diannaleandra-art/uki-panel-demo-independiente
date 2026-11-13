-- ROMO LA SERENA · BANDEJA DE SOLICITUDES DE CARTA
-- MIGRACIÓN PREPARADA; NO SE HA EJECUTADO EN PRODUCCIÓN.
-- Ejecutar exclusivamente en la base privada romos_sushi, previa autorización.
-- No usar la base Uki, no crear ventas, caja, timbres ni cierres.
BEGIN;
CREATE TABLE IF NOT EXISTS public.romo_solicitudes_carta_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id text NOT NULL DEFAULT 'romo:serena'
  CHECK (store_id = 'romo:serena'),
 request_key text NOT NULL UNIQUE
  CHECK (length(request_key) BETWEEN 12 AND 100),
 codigo_pedido text NOT NULL
  CHECK (length(codigo_pedido) BETWEEN 3 AND 60),
 cliente text NOT NULL
  CHECK (length(cliente) BETWEEN 2 AND 80),
 telefono text NOT NULL
  CHECK (length(telefono) BETWEEN 8 AND 24),
 mensaje text NOT NULL
  CHECK (length(mensaje) BETWEEN 30 AND 12000),
 total_indicado integer NOT NULL
  CHECK (total_indicado BETWEEN 1 AND 1000000),
 ip_hash text NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
 estado text NOT NULL DEFAULT 'pendiente'
  CHECK (estado IN ('pendiente','aceptada','rechazada')),
 whatsapp_confirmado boolean NOT NULL DEFAULT false
  CHECK (whatsapp_confirmado=false),
 motivo_rechazo text NOT NULL DEFAULT '',
 actualizado_por text NOT NULL DEFAULT '',
 reserva_token_hash text NOT NULL DEFAULT ''
  CHECK (reserva_token_hash='' OR reserva_token_hash ~ '^[0-9a-f]{64}$'),
 reserva_hasta timestamptz,
 CONSTRAINT romo_reserva_asegurada_ck
  CHECK (reserva_token_hash='' OR reserva_hasta IS NOT NULL),
 pedido_interno text NOT NULL DEFAULT '',
 creado_en timestamptz NOT NULL DEFAULT NOW(),
 actualizado_en timestamptz NOT NULL DEFAULT NOW(),
 -- Un pedido aceptado SIEMPRE necesita el folio interno confirmado en caja.
 CONSTRAINT romo_solicitudes_aceptada_pedido_ck
  CHECK (estado <> 'aceptada' OR length(pedido_interno)>0)
);
CREATE INDEX IF NOT EXISTS romo_solicitudes_carta_bandeja_idx
 ON public.romo_solicitudes_carta_v1(store_id,estado,creado_en DESC);
CREATE INDEX IF NOT EXISTS romo_solicitudes_carta_rate_idx
 ON public.romo_solicitudes_carta_v1(ip_hash,creado_en);
-- Un pedido interno confirmado no pertenece a dos solicitudes.
CREATE UNIQUE INDEX IF NOT EXISTS romo_solicitudes_pedido_confirmado_unico_idx
 ON public.romo_solicitudes_carta_v1(store_id,pedido_interno)
 WHERE estado='aceptada' AND pedido_interno<>'';
CREATE INDEX IF NOT EXISTS romo_solicitudes_carta_reservas_idx
 ON public.romo_solicitudes_carta_v1(store_id,reserva_hasta)
 WHERE estado='pendiente' AND reserva_token_hash<>'';
REVOKE ALL ON TABLE public.romo_solicitudes_carta_v1 FROM PUBLIC;
COMMENT ON TABLE public.romo_solicitudes_carta_v1 IS
 'Romo Serena: solicitud de WhatsApp no equivale a venta, pago, timbre ni entrega.';
COMMIT;
