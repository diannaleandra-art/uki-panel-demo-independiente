-- ROMO / PILOTO QA — NO APLICAR EN NEON PRINCIPAL SIN AUTORIZACIÓN EXPRESA.
-- Esta tabla contiene solo constancia mínima de una única operación,
-- no crea ni cobra pedidos ni cifra información. El snapshot permanece AES-GCM.
-- Solo se aplica a la rama aislada de pruebas al validar el mecanismo.
CREATE TABLE IF NOT EXISTS public.romo_cancelacion_pedido_qa_v1 (
 store_id text NOT NULL CHECK (store_id='romo:serena'),
 pedido_id integer NOT NULL CHECK (pedido_id=1),
 turno_ref text NOT NULL CHECK (turno_ref='2026-11-14@1794676606187'),
 revision_anterior bigint NOT NULL CHECK (revision_anterior=2),
 revision_neon bigint NOT NULL CHECK (revision_neon=3),
 snapshot_sha256 text NOT NULL CHECK (snapshot_sha256~'^[a-f0-9]{64}$'),
 motivo_sha256 text NOT NULL CHECK (motivo_sha256~'^[a-f0-9]{64}$'),
 creado_por_uid text NOT NULL CHECK (length(creado_por_uid) BETWEEN 1 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT romo_cancelacion_pedido_qa_v1_pkey PRIMARY KEY (store_id,pedido_id),
 CONSTRAINT romo_cancelacion_pedido_qa_v1_revision_unique
  UNIQUE (store_id,revision_neon)
);
-- Permiso más reducido: auditoría append-only, sin UPDATE/DELETE de constancias.
-- Neon puede heredar privilegios DEFAULT de nuevas tablas; revocarlos primero.
-- La constancia debe ser append-only para la cuenta de aplicación.
REVOKE UPDATE,DELETE ON public.romo_cancelacion_pedido_qa_v1 FROM romos_app_service;
GRANT SELECT,INSERT ON public.romo_cancelacion_pedido_qa_v1 TO romos_app_service;
