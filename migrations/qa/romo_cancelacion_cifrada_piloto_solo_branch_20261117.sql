-- SOLO rama Neon QA br-gentle-wave-be71bcpa; NO ejecutar en principal.
-- Constancia de un UNICO ensayo del pedido #1, revision inicial 2.
-- El sobre AES-GCM se actualiza SOLO en la rama aislada, con CAS.
-- El servidor no puede demostrar la semantica del contenido cifrado.
CREATE TABLE IF NOT EXISTS public.romo_cancelacion_sobre_piloto_qa_v1 (
 store_id text NOT NULL CHECK (store_id='romo:serena'),
 pedido_id integer NOT NULL CHECK (pedido_id=1),
 revision_anterior bigint NOT NULL CHECK (revision_anterior=2),
 revision_nueva bigint NOT NULL CHECK (revision_nueva=3),
 previo_md5 text NOT NULL CHECK (previo_md5='2ecee5d9256b2fa5b93e77864cbdea51'),
 nuevo_md5 text NOT NULL CHECK (nuevo_md5 ~ '^[a-f0-9]{32}$'),
 actor_sha256 text NOT NULL CHECK (actor_sha256 ~ '^[a-f0-9]{64}$'),
 categoria text NOT NULL CHECK (categoria='local'),
 motivo_sha256 text NOT NULL CHECK (motivo_sha256 ~ '^[a-f0-9]{64}$'),
 creado_en timestamptz NOT NULL DEFAULT NOW(),
 PRIMARY KEY (store_id,pedido_id),
 UNIQUE (store_id,revision_nueva)
);
REVOKE ALL ON public.romo_cancelacion_sobre_piloto_qa_v1 FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.romo_cancelacion_sobre_piloto_qa_v1 FROM romos_app_service;
GRANT SELECT, INSERT ON public.romo_cancelacion_sobre_piloto_qa_v1 TO romos_app_service;
