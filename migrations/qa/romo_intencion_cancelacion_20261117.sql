-- Solo RAMA QA Neon de Romo. No aplicar a principal sin revisión y autorización.
-- Registro de INTENCIÓN de cancelación: no actualiza AES-GCM, pedidos ni caja.
-- Una sola intención para el pedido #1 mientras estado cifrado esté en revisión 2.
CREATE TABLE IF NOT EXISTS public.romo_cancelacion_intencion_qa_v1 (
 store_id text NOT NULL CHECK (store_id='romo:serena'),
 pedido_id integer NOT NULL CHECK (pedido_id=1),
 revision_observada bigint NOT NULL CHECK (revision_observada=2),
 categoria text NOT NULL CHECK (categoria IN ('local','cliente')),
 motivo_sha256 text NOT NULL CHECK (motivo_sha256~'^[a-f0-9]{64}$'),
 responsable_sha256 text NOT NULL CHECK (responsable_sha256~'^[a-f0-9]{64}$'),
 creado_por_uid text NOT NULL CHECK (length(creado_por_uid) BETWEEN 1 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT romo_cancelacion_intencion_qa_v1_pkey PRIMARY KEY (store_id,pedido_id)
);
-- El esquema Romo puede asignar UPDATE/DELETE por defecto a nuevas tablas.
REVOKE UPDATE,DELETE ON public.romo_cancelacion_intencion_qa_v1 FROM romos_app_service;
GRANT SELECT,INSERT ON public.romo_cancelacion_intencion_qa_v1 TO romos_app_service;
