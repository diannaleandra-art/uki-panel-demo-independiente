-- ROMO, SOLO RAMA NEON QA: prueba controlada de permiso Google de dueños.
-- Nunca aplicar en Neon principal. No modifica pedidos, caja ni snapshot AES-GCM.
CREATE TABLE IF NOT EXISTS public.romo_prueba_escritura_aislada_qa_v1 (
 operation_id text PRIMARY KEY CHECK (operation_id='romo-qa-autorizacion-20261117'),
 store_id text NOT NULL CHECK (store_id='romo:serena'),
 observed_revision bigint NOT NULL CHECK (observed_revision=2),
 actor_sha256 text NOT NULL CHECK (actor_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT NOW()
);
REVOKE ALL ON public.romo_prueba_escritura_aislada_qa_v1 FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.romo_prueba_escritura_aislada_qa_v1 FROM romos_app_service;
GRANT SELECT, INSERT ON public.romo_prueba_escritura_aislada_qa_v1 TO romos_app_service;
-- Para ejecutar, el rol de servicio debe poder consultar el estado cifrado,
-- pero esta ruta NO debe tener una sentencia UPDATE sobre dicho estado.
