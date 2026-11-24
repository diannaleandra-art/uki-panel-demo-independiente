-- NO EJECUTAR EN PRODUCCION. Esquema propuesto para QA aislada de Romo.
-- No toca caja, ventas, cierres ni solicitudes existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.romo_seguimiento_enlaces_qa_v1 (
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
CREATE INDEX IF NOT EXISTS romo_seguimiento_enlaces_qa_estado_idx
 ON public.romo_seguimiento_enlaces_qa_v1(store_id,estado,vence_en);
REVOKE ALL ON TABLE public.romo_seguimiento_enlaces_qa_v1 FROM PUBLIC;
-- Falta validar el rol de escritura y cada consulta de solicitud_id + sucursal.
COMMIT;
