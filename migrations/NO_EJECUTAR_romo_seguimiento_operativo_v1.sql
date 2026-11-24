-- Preparación de seguimiento comercial Romo: migración aditiva.
-- No ejecutar hasta revisión del entorno, respaldo y autorización operativa.
BEGIN;
CREATE TABLE IF NOT EXISTS public.romo_seguimiento_enlaces_v1 (
 solicitud_id uuid PRIMARY KEY REFERENCES public.romo_solicitudes_carta_v1(id) ON DELETE CASCADE,
 store_id text NOT NULL DEFAULT 'romo:serena' CHECK (store_id='romo:serena'),
 branch text NOT NULL DEFAULT 'serena' CHECK (branch='serena'),
 token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 emitido_en timestamptz NOT NULL DEFAULT now(),
 vence_en timestamptz NOT NULL,
 estado text NOT NULL DEFAULT 'active' CHECK (estado IN ('active','revoked')),
 revocado_en timestamptz,
 CHECK (vence_en > emitido_en AND vence_en <= emitido_en + interval '7 days'),
 CHECK ((estado='active' AND revocado_en IS NULL) OR
        (estado='revoked' AND revocado_en IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS romo_seguimiento_enlaces_estado_idx
 ON public.romo_seguimiento_enlaces_v1(store_id,estado,vence_en);
REVOKE ALL ON TABLE public.romo_seguimiento_enlaces_v1 FROM PUBLIC;



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
CREATE TABLE IF NOT EXISTS public.romo_seguimiento_chat_cifrado_v1 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 solicitud_id uuid NOT NULL REFERENCES public.romo_solicitudes_carta_v1(id) ON DELETE CASCADE,
 store_id text NOT NULL DEFAULT 'romo:serena' CHECK (store_id='romo:serena'),
 remitente text NOT NULL CHECK (remitente IN ('cliente','agendador')),
 mensaje_cifrado text NOT NULL CHECK (length(mensaje_cifrado) BETWEEN 23 AND 12000),
 nonce text NOT NULL CHECK (length(nonce) BETWEEN 12 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS romo_chat_por_solicitud_fecha_idx
 ON public.romo_seguimiento_chat_cifrado_v1(solicitud_id,creado_en,id);
GRANT SELECT,INSERT,UPDATE ON public.romo_seguimiento_transferencia_v1 TO romos_app_service;
GRANT SELECT,INSERT ON public.romo_seguimiento_chat_cifrado_v1 TO romos_app_service;
GRANT USAGE,SELECT ON SEQUENCE public.romo_seguimiento_chat_cifrado_v1_id_seq TO romos_app_service;


REVOKE ALL ON public.romo_seguimiento_transferencia_v1, public.romo_seguimiento_chat_cifrado_v1 FROM PUBLIC;
GRANT SELECT,INSERT ON public.romo_seguimiento_enlaces_v1 TO romos_app_service;
-- Los privilegios por defecto del propietario incluyen DELETE y UPDATE.
-- Limitar exclusivamente las tablas nuevas; no cambiar permisos de tablas existentes.
REVOKE DELETE ON public.romo_seguimiento_enlaces_v1, public.romo_seguimiento_transferencia_v1, public.romo_seguimiento_chat_cifrado_v1 FROM romos_app_service;
REVOKE UPDATE ON public.romo_seguimiento_enlaces_v1, public.romo_seguimiento_chat_cifrado_v1 FROM romos_app_service;
COMMIT;
