-- Solo rama QA; NO ejecutar hasta autorizar infraestructura de dueños.
-- Registro de configuraciones independientes, nunca ventas ni una carta publicada.
CREATE TABLE IF NOT EXISTS public.fin_locales_operativos_qa(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 negocio_id uuid NOT NULL REFERENCES public.fin_negocios(id),
 sucursal_id uuid NOT NULL UNIQUE REFERENCES public.fin_sucursales(id),
 store_id text NOT NULL UNIQUE,
 configuracion jsonb NOT NULL,
 estado text NOT NULL DEFAULT 'borrador' CHECK(estado='borrador'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
 creado_por text NOT NULL,
 actualizado_por text NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT now(),
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 CHECK ((configuracion->>'copiarDatos')::boolean=false),
 CHECK ((configuracion->'modulos'->>'publicado')::boolean=false)
);
CREATE INDEX IF NOT EXISTS fin_locales_operativos_qa_negocio_idx
 ON public.fin_locales_operativos_qa(negocio_id);
