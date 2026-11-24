-- PREPARACIÓN QA aislada de Romo. Sin modificar snapshots, caja o ventas.
CREATE TABLE IF NOT EXISTS public.romo_seguimiento_finalizacion_qa_v1 (
 solicitud_id uuid PRIMARY KEY REFERENCES public.romo_solicitudes_carta_v1(id) ON DELETE CASCADE,
 store_id text NOT NULL CHECK (store_id='romo:serena'),
 branch text NOT NULL CHECK (branch='serena'),
 total_pedido integer NOT NULL CHECK (total_pedido BETWEEN 1 AND 100000000),
 monto_transferencia integer NOT NULL CHECK (monto_transferencia BETWEEN 0 AND total_pedido),
 estado text NOT NULL CHECK (estado IN ('pagado','entregado')),
 pago_confirmado_por text NOT NULL CHECK (length(trim(pago_confirmado_por))>=3),
 pago_confirmado_en timestamptz NOT NULL DEFAULT now(),
 entregado_por text,
 entregado_en timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>=1),
 CHECK ((estado='pagado' AND entregado_por IS NULL AND entregado_en IS NULL) OR
        (estado='entregado' AND entregado_por IS NOT NULL AND entregado_en IS NOT NULL))
);
REVOKE ALL ON public.romo_seguimiento_finalizacion_qa_v1 FROM PUBLIC;
