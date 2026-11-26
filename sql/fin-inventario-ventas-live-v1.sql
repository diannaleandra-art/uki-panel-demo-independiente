-- Aditiva. Base privada Mi Administración. No toca pedidos, caja ni existencias.
CREATE TABLE IF NOT EXISTS public.fin_consumo_ventas_live_v1 (
 store_id text NOT NULL CHECK (store_id IN ('uki:arica','uki:serena','romo:serena')),
 source_revision bigint NOT NULL CHECK(source_revision>0),
 window_start timestamptz NOT NULL,
 captured_at timestamptz NOT NULL,
 facts jsonb NOT NULL CHECK(jsonb_typeof(facts)='array' AND jsonb_array_length(facts)<=2000),
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id)
);
ALTER TABLE public.fin_consumo_ventas_live_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fin_consumo_ventas_live_v1 FROM PUBLIC;
-- Rol financiero actual: conceder solo SELECT/INSERT/UPDATE de esta tabla tras verificar identidad.
