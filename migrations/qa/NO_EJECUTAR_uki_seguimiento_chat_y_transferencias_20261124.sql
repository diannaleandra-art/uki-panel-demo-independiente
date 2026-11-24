-- SOLO PARA UNA BASE QA REALMENTE AISLADA DE UKI, NO EJECUTAR EN PRODUCCION.
-- No migra datos comerciales ni toca cajas.
BEGIN;
CREATE TABLE IF NOT EXISTS public.uki_seguimiento_transferencias_qa_v1 (
 solicitud_id uuid PRIMARY KEY REFERENCES public.uki_carta_solicitudes_live(id) ON DELETE CASCADE,
 store_id text NOT NULL CHECK (store_id IN ('uki:arica','uki:serena')),
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 monto_transferencia integer NOT NULL CHECK (monto_transferencia BETWEEN 1 AND 100000000),
 estado_pago text NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente','avisada','confirmada')),
 cliente_aviso_en timestamptz,
 confirmada_en timestamptz,
 confirmada_por text,
 abono_verificado_en timestamptz,
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 CHECK ((store_id='uki:arica' AND branch='arica') OR
        (store_id='uki:serena' AND branch='serena')),
 CHECK (estado_pago <> 'confirmada' OR
       (confirmada_por IS NOT NULL AND length(trim(confirmada_por))>=5
        AND confirmada_en IS NOT NULL AND abono_verificado_en IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.uki_seguimiento_chat_cifrado_qa_v1 (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 solicitud_id uuid NOT NULL REFERENCES public.uki_carta_solicitudes_live(id) ON DELETE CASCADE,
 store_id text NOT NULL CHECK (store_id IN ('uki:arica','uki:serena')),
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 remitente text NOT NULL CHECK (remitente IN ('cliente','agendador')),
 mensaje_cifrado text NOT NULL CHECK (length(mensaje_cifrado) BETWEEN 32 AND 12000),
 nonce text NOT NULL CHECK (length(nonce) BETWEEN 16 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now(),
 CHECK ((store_id='uki:arica' AND branch='arica') OR
        (store_id='uki:serena' AND branch='serena'))
);
CREATE INDEX IF NOT EXISTS uki_seguimiento_chat_qa_fecha_idx
 ON public.uki_seguimiento_chat_cifrado_qa_v1(store_id,solicitud_id,creado_en,id);
REVOKE ALL ON public.uki_seguimiento_chat_cifrado_qa_v1 FROM PUBLIC;
REVOKE ALL ON public.uki_seguimiento_transferencias_qa_v1 FROM PUBLIC;
-- Pendiente: permisos minimos al rol de servicio QA verificado, exclusivamente.
COMMIT;
