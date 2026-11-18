-- Fotografías de productos/promociones de Romo en QA. Sin publicación al cliente.
CREATE TABLE IF NOT EXISTS public.romo_carta_admin_fotos_qa_v1 (store_id text NOT NULL DEFAULT 'romo:serena' CHECK(store_id='romo:serena'), sku text NOT NULL CHECK(length(sku) BETWEEN 1 AND 100), mime_type text NOT NULL DEFAULT 'image/jpeg' CHECK(mime_type='image/jpeg'), contenido bytea NOT NULL CHECK(octet_length(contenido) BETWEEN 1024 AND 300000), version integer NOT NULL DEFAULT 1 CHECK(version>=1), actualizado_por text NOT NULL, actualizado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(store_id,sku));

CREATE TABLE IF NOT EXISTS public.romo_carta_admin_fotos_auditoria_qa_v1 (event_id text PRIMARY KEY, store_id text NOT NULL DEFAULT 'romo:serena' CHECK(store_id='romo:serena'), sku text NOT NULL, accion text NOT NULL CHECK(accion IN ('subir','quitar')), version integer NOT NULL, sha256 text, bytes integer, responsable_uid text NOT NULL, creado_en timestamptz NOT NULL DEFAULT now());

GRANT SELECT,INSERT,UPDATE,DELETE ON public.romo_carta_admin_fotos_qa_v1 TO romos_app_service;

GRANT SELECT,INSERT ON public.romo_carta_admin_fotos_auditoria_qa_v1 TO romos_app_service;
