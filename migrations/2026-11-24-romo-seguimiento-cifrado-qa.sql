-- Preparación Romo · 24-11-2026. NO EJECUTAR EN PRODUCCIÓN SIN PRUEBAS MANUALES.
-- No toca caja, ventas ni tablas de las sucursales Uki.
-- Sólo se activa cuando el enlace de seguimiento y la cuenta bancaria estén verificados.
BEGIN;
CREATE TABLE IF NOT EXISTS public.romo_seguimiento_transferencia_v1 (
 solicitud_id uuid PRIMARY KEY REFERENCES public.romo_solicitudes_carta_v1(id) ON DELETE CASCADE,
 store_id text NOT NULL DEFAULT 'romo:serena' CHECK (store_id='romo:serena'),
 monto_transferencia integer NOT NULL CHECK (monto_transferencia>0 AND monto_transferencia<=100000000),
 estado_pago text NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente','avisada','confirmada')),
 cliente_aviso_en timestamptz,
 confirmada_en timestamptz,
 confirmada_por text,
 abono_verificado_en timestamptz,
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT confirmacion_registrada CHECK (
  estado_pago<>'confirmada' OR
  (confirmada_por IS NOT NULL AND length(trim(confirmada_por))>=2 AND
   confirmada_en IS NOT NULL AND abono_verificado_en IS NOT NULL)
 )
);
-- El futuro chat debe cifrarse ANTES de insertarse. No almacenar mensajes en texto libre.
CREATE TABLE IF NOT EXISTS public.romo_seguimiento_chat_cifrado_v1 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 solicitud_id uuid NOT NULL REFERENCES public.romo_solicitudes_carta_v1(id) ON DELETE CASCADE,
 store_id text NOT NULL DEFAULT 'romo:serena' CHECK (store_id='romo:serena'),
 remitente text NOT NULL CHECK (remitente IN ('cliente','agendador')),
 mensaje_cifrado text NOT NULL CHECK (length(mensaje_cifrado) BETWEEN 32 AND 12000),
 nonce text NOT NULL CHECK (length(nonce) BETWEEN 12 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS romo_chat_por_solicitud_fecha_idx
 ON public.romo_seguimiento_chat_cifrado_v1(solicitud_id,creado_en,id);
GRANT SELECT,INSERT,UPDATE ON public.romo_seguimiento_transferencia_v1 TO romos_app_service;
GRANT SELECT,INSERT ON public.romo_seguimiento_chat_cifrado_v1 TO romos_app_service;
GRANT USAGE,SELECT ON SEQUENCE public.romo_seguimiento_chat_cifrado_v1_id_seq TO romos_app_service;
COMMIT;
