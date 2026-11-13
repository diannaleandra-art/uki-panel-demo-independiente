CREATE TABLE IF NOT EXISTS public.romo_solicitudes_carta_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id text NOT NULL DEFAULT 'romo:serena' CHECK (store_id='romo:serena'),
 request_key text NOT NULL UNIQUE CHECK (length(request_key) BETWEEN 12 AND 100),
 codigo_pedido text NOT NULL CHECK (length(codigo_pedido) BETWEEN 3 AND 60),
 cliente text NOT NULL CHECK (length(cliente) BETWEEN 2 AND 80),
 telefono text NOT NULL CHECK (length(telefono) BETWEEN 8 AND 24),
 mensaje text NOT NULL CHECK (length(mensaje) BETWEEN 30 AND 12000),
 total_indicado integer NOT NULL CHECK (total_indicado BETWEEN 1 AND 1000000),
 estado text NOT NULL DEFAULT 'pendiente'
  CHECK (estado IN ('pendiente','aceptada','rechazada')),
 whatsapp_confirmado boolean NOT NULL DEFAULT false,
 pedido_interno text,
 motivo_rechazo text,
 reserva_token_hash text NOT NULL DEFAULT ''
  CHECK (reserva_token_hash='' OR reserva_token_hash ~ '^[0-9a-f]{64}$'),
 reserva_hasta timestamptz,
 actualizado_por text
  CHECK (actualizado_por IS NULL OR length(actualizado_por) BETWEEN 3 AND 128),
 ip_hash text NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
 creado_en timestamptz NOT NULL DEFAULT now(),
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 CHECK (estado<>'aceptada' OR length(coalesce(pedido_interno,''))>0)
);
CREATE INDEX IF NOT EXISTS romo_solicitudes_carta_estado_idx
 ON public.romo_solicitudes_carta_v1(store_id,estado,creado_en DESC);
CREATE INDEX IF NOT EXISTS romo_solicitudes_carta_ip_idx
 ON public.romo_solicitudes_carta_v1(ip_hash,creado_en DESC);
CREATE UNIQUE INDEX IF NOT EXISTS romo_solicitudes_pedido_confirmado_unico_idx
 ON public.romo_solicitudes_carta_v1(store_id,pedido_interno)
 WHERE estado='aceptada' AND pedido_interno IS NOT NULL;
REVOKE ALL PRIVILEGES ON TABLE public.romo_solicitudes_carta_v1
 FROM romos_app_service, PUBLIC;
