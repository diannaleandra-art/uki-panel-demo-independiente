-- Preparación del libro de consumo. Migración aditiva; no descuenta existencias.
-- No activar hasta disponer de fuente autorizada del pedido, fecha de corte y transacción atómica.
BEGIN;
CREATE TABLE IF NOT EXISTS public.costeo_consumos_pedido_v1 (
 store_id text NOT NULL CHECK (store_id IN ('romo:serena')),
 order_key text NOT NULL CHECK (length(order_key) BETWEEN 12 AND 250),
 order_snapshot jsonb NOT NULL CHECK (jsonb_typeof(order_snapshot)='object'),
 recipe_snapshot jsonb NOT NULL CHECK (jsonb_typeof(recipe_snapshot)='array'),
 price_snapshot jsonb NOT NULL CHECK (jsonb_typeof(price_snapshot)='array'),
 consumption jsonb NOT NULL CHECK (jsonb_typeof(consumption)='array'),
 revenue bigint NOT NULL CHECK (revenue>=0),
 cost bigint NOT NULL CHECK (cost>=0),
 service_date date NOT NULL,
 recorded_by text NOT NULL CHECK (length(btrim(recorded_by)) BETWEEN 1 AND 150),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,order_key)
);
ALTER TABLE public.costeo_consumos_pedido_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.costeo_consumos_pedido_v1 FROM PUBLIC;
COMMIT;
-- Este libro solo se escribirá junto con el movimiento de existencias en una misma transacción.
-- No debe alimentarse con proyecciones del navegador ni con pedidos anteriores al conteo de inicio.
-- Las correcciones requieren conciliación registrada y no reemplazan la fila original.
