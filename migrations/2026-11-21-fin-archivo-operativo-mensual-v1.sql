BEGIN;
CREATE TABLE IF NOT EXISTS public.fin_archivos_operativos_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sucursal text NOT NULL CHECK(sucursal IN ('uki:arica','uki:serena','romo:serena')),
 mes text NOT NULL CHECK(mes ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 iv bytea NOT NULL CHECK(octet_length(iv)=12),
 tag bytea NOT NULL CHECK(octet_length(tag)=16),
 payload_cifrado bytea NOT NULL CHECK(octet_length(payload_cifrado)>0),
 bytes_comprimidos integer NOT NULL CHECK(bytes_comprimidos BETWEEN 30 AND 1550000),
 conteos jsonb NOT NULL CHECK(jsonb_typeof(conteos)='object'),
 creado_por text NOT NULL CHECK(length(creado_por)>0),
 creado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE(sucursal,mes,sha256)
);
CREATE INDEX IF NOT EXISTS fin_archivos_operativos_v1_consulta
 ON public.fin_archivos_operativos_v1(mes DESC,sucursal,creado_en DESC);
REVOKE ALL ON TABLE public.fin_archivos_operativos_v1 FROM PUBLIC;
COMMIT;