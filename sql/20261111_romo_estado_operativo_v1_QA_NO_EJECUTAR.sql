-- PREPARACIÓN PRIVADA / QA. NO EJECUTAR SIN APROBACIÓN EXPLÍCITA.
-- Destino EXCLUSIVO: base romos_sushi / proyecto romos-sushi-la-serena.
-- No modifica tablas de Uki ni habilita pedidos reales.
--
-- Una única foto cifrada para todo el estado de Romo (pedidos, caja,
-- cierres, historiales, clientes). Esto respeta las mismas estructuras
-- del panel Uki, pero sin mezclar las dos bases de datos.
-- Inventario se sincronizará por separado con los mismos controles de roles.

BEGIN;

CREATE TABLE IF NOT EXISTS public.romo_estado_operativo_v1 (
  store_id text NOT NULL PRIMARY KEY
    CONSTRAINT romo_estado_operativo_solo_serena
      CHECK (store_id = 'romo:serena'),
  revision bigint NOT NULL DEFAULT 1
    CONSTRAINT romo_estado_operativo_revision_positiva
      CHECK (revision >= 1),
  snapshot jsonb NOT NULL
    CONSTRAINT romo_estado_operativo_snapshot_objeto
      CHECK (jsonb_typeof(snapshot) = 'object'),
  actualizado_por text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT romo_estado_operativo_sucursal_unica
    CHECK (snapshot->>'sucursal' = 'Romo’s Sushi La Serena'),
  CONSTRAINT romo_estado_operativo_formato_cifrado
    CHECK (snapshot->>'formato' = 'uki-v813-browser'),
  CONSTRAINT romo_estado_operativo_version
    CHECK (snapshot->>'version' = '1')
);

REVOKE ALL ON public.romo_estado_operativo_v1 FROM PUBLIC;
REVOKE ALL ON public.romo_estado_operativo_v1 FROM romos_app_service;
GRANT SELECT, INSERT, UPDATE ON public.romo_estado_operativo_v1 TO romos_app_service;
-- Nunca DELETE para la cuenta técnica.
-- Auditoría y revisiones CAS se controlan en el API con UPDATE ... WHERE revision=$2.

COMMIT;

-- No se insertan snapshots, usuarios ni contraseñas.
