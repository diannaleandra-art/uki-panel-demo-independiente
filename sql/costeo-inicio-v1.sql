-- Punto inicial certificado del control de consumo; no altera existencias.
BEGIN;
CREATE TABLE IF NOT EXISTS public.costeo_inicio_v1 (
 store_id text PRIMARY KEY CHECK(store_id IN ('uki:arica','uki:serena')),
 cutoff timestamptz NOT NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND jsonb_typeof(snapshot->'items')='array'),
 confirmed_by text NOT NULL CHECK(length(btrim(confirmed_by)) BETWEEN 1 AND 150),
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.costeo_inicio_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.costeo_inicio_v1 FROM PUBLIC;
COMMIT;
-- No interpretar este registro como activación. Faltan fuente de pedidos verificada,
-- conciliación de conteos posteriores y aplicación atómica del consumo.
