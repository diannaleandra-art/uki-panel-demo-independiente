-- ROMO SUSHI LA SERENA - SOLO PREPARACION, NO EJECUTAR EN PRODUCCION
-- Destino futuro exclusivo: Neon romos_sushi / public.
-- NO modifica romo_catalogo_v1, inventario, pedidos, caja ni tablas Uki.
-- Requiere aprobación, respaldo, comparación del catálogo y validación manual.
-- Nunca instalar automáticamente desde el despliegue Vercel.

BEGIN;

CREATE TABLE IF NOT EXISTS public.romo_carta_ediciones_v1 (
  store_id text PRIMARY KEY DEFAULT 'romo:serena',
  revision bigint NOT NULL,
  base_sha256 text NOT NULL,
  contenido jsonb NOT NULL,
  actualizado_por text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT romo_carta_ediciones_store CHECK (store_id='romo:serena'),
  CONSTRAINT romo_carta_ediciones_revision CHECK (revision>=1),
  CONSTRAINT romo_carta_ediciones_sha CHECK (base_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT romo_carta_ediciones_contenido CHECK (
    jsonb_typeof(contenido)='object'
    AND contenido->>'storeId'='romo:serena'
    AND (contenido->>'revision')::bigint=revision
    AND jsonb_typeof(contenido->'overrides')='object'
    AND octet_length(contenido::text) <= 180000
  )
);

CREATE TABLE IF NOT EXISTS public.romo_carta_ediciones_auditoria_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id text NOT NULL DEFAULT 'romo:serena',
  revision bigint NOT NULL,
  revision_anterior bigint NOT NULL,
  base_sha256 text NOT NULL,
  sku text NOT NULL,
  anterior jsonb,
  nuevo jsonb NOT NULL,
  responsable_uid text NOT NULL,
  motivo text NOT NULL,
  guardado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT romo_carta_auditoria_scope CHECK (store_id='romo:serena'),
  CONSTRAINT romo_carta_auditoria_revision CHECK (
    revision>0 AND revision_anterior>=0 AND revision=revision_anterior+1
  ),
  CONSTRAINT romo_carta_auditoria_sha CHECK (base_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT romo_carta_auditoria_motivo CHECK (length(btrim(motivo)) BETWEEN 4 AND 300),
  CONSTRAINT romo_carta_auditoria_sku CHECK (length(sku) BETWEEN 3 AND 100),
  UNIQUE (store_id,revision)
);

-- Ni el navegador público ni una identidad anónima pueden escribir.
REVOKE ALL ON public.romo_carta_ediciones_v1 FROM PUBLIC;
REVOKE ALL ON public.romo_carta_ediciones_auditoria_v1 FROM PUBLIC;
-- El usuario de aplicación de Neon Romo deberá existir y ser el mismo
-- autenticado por el endpoint dedicado. NO otorgar permisos a roles Uki.
GRANT SELECT, INSERT, UPDATE ON public.romo_carta_ediciones_v1 TO romos_app_service;
GRANT SELECT, INSERT ON public.romo_carta_ediciones_auditoria_v1 TO romos_app_service;
GRANT USAGE, SELECT ON SEQUENCE public.romo_carta_ediciones_auditoria_v1_id_seq TO romos_app_service;

COMMIT;

-- Sin seed, sin UPDATE del catálogo antiguo, sin sincronización automática.
-- La primera edición manual autorizada usa CAS revision 0 -> 1 con
-- auditoría en la MISMA sentencia SQL. Un conflicto devuelve 409.
