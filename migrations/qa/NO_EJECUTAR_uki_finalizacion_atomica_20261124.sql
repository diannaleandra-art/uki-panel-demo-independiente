-- PREPARACIÓN QA aislada. No aplicar a bases operativas.
-- Registro de autoridad para el pago y la entrega. El panel cifrado sigue
-- requiriendo una migración para no mantener una ruta de guardado paralela.
CREATE TABLE IF NOT EXISTS public.uki_seguimiento_finalizacion_qa_v1 (
 solicitud_id uuid PRIMARY KEY REFERENCES public.uki_carta_solicitudes_live(id) ON DELETE CASCADE,
 store_id text NOT NULL CHECK (store_id IN ('uki:arica','uki:serena')),
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 total_pedido integer NOT NULL CHECK (total_pedido BETWEEN 1 AND 100000000),
 monto_transferencia integer NOT NULL CHECK (monto_transferencia BETWEEN 0 AND total_pedido),
 estado text NOT NULL CHECK (estado IN ('pagado','entregado')),
 pago_confirmado_por text NOT NULL CHECK (length(trim(pago_confirmado_por))>=3),
 pago_confirmado_en timestamptz NOT NULL DEFAULT now(),
 entregado_por text,
 entregado_en timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>=1),
 CHECK ((store_id='uki:arica' AND branch='arica') OR
        (store_id='uki:serena' AND branch='serena')),
 CHECK ((estado='pagado' AND entregado_por IS NULL AND entregado_en IS NULL) OR
        (estado='entregado' AND entregado_por IS NOT NULL AND entregado_en IS NOT NULL))
);
REVOKE ALL ON public.uki_seguimiento_finalizacion_qa_v1 FROM PUBLIC;
