-- Registro informativo aislado. Aplicar solamente en la base de inventario correspondiente.
CREATE TABLE IF NOT EXISTS public.inventario_justificaciones_v1 (
 store_id text NOT NULL CHECK (store_id IN ('uki:arica','uki:serena','romo:serena')),
 request_id uuid NOT NULL,
 sku text NOT NULL CHECK(length(sku) BETWEEN 1 AND 180),
 kind text NOT NULL CHECK(kind IN ('merma','personal','traspaso_salida','traspaso_entrada')),
 quantity numeric(18,3) NOT NULL CHECK(quantity>0 AND quantity<=100000),
 unit text NOT NULL CHECK(unit IN ('kg','g','l','ml','un','porciones')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 180),
 counterparty text CHECK(counterparty IN ('uki:arica','uki:serena','romo:serena') AND counterparty<>store_id),
 transfer_ref text CHECK(length(transfer_ref) BETWEEN 4 AND 40),
 worker text NOT NULL CHECK(length(worker) BETWEEN 2 AND 80),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,request_id),
 CHECK((kind IN ('traspaso_salida','traspaso_entrada') AND counterparty IS NOT NULL AND transfer_ref IS NOT NULL) OR (kind IN ('merma','personal') AND counterparty IS NULL AND transfer_ref IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS inventario_justificaciones_traspaso_uq ON public.inventario_justificaciones_v1(store_id,kind,sku,transfer_ref) WHERE transfer_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventario_justificaciones_periodo_idx ON public.inventario_justificaciones_v1(store_id,created_at);
ALTER TABLE public.inventario_justificaciones_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventario_justificaciones_v1 FROM PUBLIC;
-- Permisos mínimos de la conexión Romo ya existente. Sin UPDATE ni DELETE.
GRANT SELECT, INSERT ON public.inventario_justificaciones_v1 TO romos_app_service;
CREATE POLICY inventario_justificaciones_romo_read_v1 ON public.inventario_justificaciones_v1 FOR SELECT TO romos_app_service USING (store_id='romo:serena');
CREATE POLICY inventario_justificaciones_romo_insert_v1 ON public.inventario_justificaciones_v1 FOR INSERT TO romos_app_service WITH CHECK (store_id='romo:serena');
