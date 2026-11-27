CREATE TABLE IF NOT EXISTS public.pedidos_push_suscripciones_v1 (
 endpoint_hash text PRIMARY KEY CHECK(endpoint_hash ~ '^[0-9a-f]{64}$'),
 store_id text NOT NULL CHECK(store_id IN ('uki:arica','uki:serena','romo:serena')),
 principal_hash text NOT NULL CHECK(principal_hash ~ '^[0-9a-f]{64}$'),
 subscription jsonb NOT NULL CHECK(jsonb_typeof(subscription)='object'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 last_test_at timestamptz
);
CREATE INDEX IF NOT EXISTS pedidos_push_suscripciones_v1_store
 ON public.pedidos_push_suscripciones_v1(store_id,updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_push_suscripciones_v1 TO romos_app_service;
