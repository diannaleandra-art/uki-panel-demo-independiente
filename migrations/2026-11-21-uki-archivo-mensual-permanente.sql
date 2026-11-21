-- Archivo mensual permanente. No borra ni cambia los pedidos, cierres ni ventas.
BEGIN;
CREATE TABLE IF NOT EXISTS public.fin_archivos_mensuales_v1(
 sucursal text NOT NULL CHECK(sucursal IN ('uki:arica','uki:serena','romo:serena')),
 mes text NOT NULL CHECK(mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 desde date NOT NULL,
 hasta date NOT NULL,
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 encoding text NOT NULL CHECK(encoding IN ('gzip','json')),
 contenido bytea NOT NULL CHECK(octet_length(contenido) BETWEEN 1 AND 1200000),
 total_registros integer NOT NULL CHECK(total_registros BETWEEN 0 AND 20000),
 resumen jsonb NOT NULL CHECK(jsonb_typeof(resumen)='object'),
 creado_por_uid text NOT NULL CHECK(length(creado_por_uid) BETWEEN 1 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(sucursal,mes)
);
CREATE INDEX IF NOT EXISTS fin_archivos_mensuales_por_fecha_v1 ON public.fin_archivos_mensuales_v1(mes DESC,sucursal);
COMMIT;