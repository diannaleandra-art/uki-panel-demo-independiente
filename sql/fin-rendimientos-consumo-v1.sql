-- Rendimientos medidos por sucursal; no modifica stock ni costos contables.
CREATE TABLE IF NOT EXISTS public.fin_rendimientos_consumo_v1 (
 store_id text NOT NULL CHECK(store_id IN ('uki:arica','uki:serena','romo:serena')),
 ingredient text NOT NULL CHECK(length(ingredient) BETWEEN 1 AND 100),
 sku text NOT NULL CHECK(length(sku) BETWEEN 1 AND 180),
 raw_g numeric(18,3) NOT NULL CHECK(raw_g>0 AND raw_g<=1000000),
 prepared_g numeric(18,3) NOT NULL CHECK(prepared_g>0 AND prepared_g<=1000000),
 note text NOT NULL CHECK(length(note) BETWEEN 5 AND 180),
 confirmed_by text NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(store_id,ingredient),
 UNIQUE(store_id,sku),
 CHECK(prepared_g/raw_g BETWEEN 0.05 AND 10)
);
ALTER TABLE public.fin_rendimientos_consumo_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fin_rendimientos_consumo_v1 FROM PUBLIC;
