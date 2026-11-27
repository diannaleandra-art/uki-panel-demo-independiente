-- Registro paralelo de preparaciones sin venta. No actualiza existencias ni pedidos.
CREATE TABLE IF NOT EXISTS public.uki_salidas_sin_cobro_v1 (
  store_id text NOT NULL CHECK (store_id IN ('uki:arica','uki:serena','romo:serena')),
  request_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  detalle jsonb NOT NULL CHECK (jsonb_typeof(detalle)='object'),
  PRIMARY KEY (store_id,request_id)
);
CREATE INDEX IF NOT EXISTS uki_salidas_sin_cobro_v1_periodo
  ON public.uki_salidas_sin_cobro_v1 (store_id,creado_en);
REVOKE ALL ON public.uki_salidas_sin_cobro_v1 FROM PUBLIC;
