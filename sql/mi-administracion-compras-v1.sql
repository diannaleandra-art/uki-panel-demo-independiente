-- Registro detallado de compras por factura. Tablas operativas de Uki intactas.
CREATE TABLE IF NOT EXISTS public.fin_compra_items (
 id bigserial PRIMARY KEY,
 compra_id uuid NOT NULL REFERENCES public.fin_movimientos(id),
 posicion smallint NOT NULL CHECK(posicion BETWEEN 1 AND 80),
 descripcion text NOT NULL CHECK(char_length(btrim(descripcion)) BETWEEN 2 AND 180),
 cantidad numeric(14,3) NOT NULL CHECK(cantidad>0 AND cantidad<=100000),
 unidad text NOT NULL DEFAULT 'un' CHECK(char_length(unidad) BETWEEN 1 AND 15),
 precio_unitario bigint NOT NULL CHECK(precio_unitario>=0 AND precio_unitario<=1000000000),
 total_linea bigint NOT NULL CHECK(total_linea>=0 AND total_linea<=1000000000),
 UNIQUE(compra_id,posicion)
);
CREATE INDEX IF NOT EXISTS fin_compra_items_descripcion_idx ON public.fin_compra_items(lower(btrim(descripcion)));
CREATE INDEX IF NOT EXISTS fin_compra_items_compra_idx ON public.fin_compra_items(compra_id);
