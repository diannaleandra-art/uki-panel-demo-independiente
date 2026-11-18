-- Solo QA Romo. Datos administrativos en borrador, separados de la carta aprobada.
-- No modifica romo_carta_ediciones_v1, pedidos, caja, ventas ni Uki.
CREATE TABLE IF NOT EXISTS public.romo_carta_admin_qa_v1 (
 store_id text PRIMARY KEY DEFAULT 'romo:serena' CHECK (store_id = 'romo:serena'),
 revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
 contenido jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(contenido)='object' AND octet_length(contenido::text)<=145000),
 actualizado_por text NOT NULL DEFAULT 'inicio',
 actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.romo_carta_admin_auditoria_qa_v1 (
 store_id text NOT NULL DEFAULT 'romo:serena' CHECK (store_id='romo:serena'),
 revision bigint NOT NULL CHECK (revision>0),
 accion text NOT NULL,
 registro_id text NOT NULL,
 anterior jsonb,
 nuevo jsonb,
 responsable_uid text NOT NULL,
 motivo text NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (store_id,revision)
);

INSERT INTO public.romo_carta_admin_qa_v1 (store_id,revision,contenido,actualizado_por)
 VALUES('romo:serena',0,'{}'::jsonb,'inicio')
 ON CONFLICT (store_id) DO NOTHING;

GRANT SELECT,UPDATE ON public.romo_carta_admin_qa_v1 TO romos_app_service;

GRANT SELECT,INSERT ON public.romo_carta_admin_auditoria_qa_v1 TO romos_app_service;
