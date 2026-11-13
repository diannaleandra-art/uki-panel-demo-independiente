-- SOLO QA Romo aislado; no aplicar en producción sin aprobación.
CREATE TABLE IF NOT EXISTS public.romo_cierres_constancia_v1 (
 store_id text NOT NULL CHECK (store_id='romo:serena'),
 source_key text PRIMARY KEY,
 turno_ref text NOT NULL UNIQUE,
 fecha_operativa date NOT NULL,
 revision_neon bigint NOT NULL CHECK (revision_neon>=1),
 snapshot_sha256 char(64) NOT NULL CHECK (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 resumen jsonb NOT NULL CHECK (jsonb_typeof(resumen)='object'),
 creado_por_uid text NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT now()
);