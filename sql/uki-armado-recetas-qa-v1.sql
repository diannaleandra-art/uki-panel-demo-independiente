-- Solo QA. No crear estas tablas en la base de producción.
CREATE TABLE IF NOT EXISTS public.uki_armado_opciones_qa (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 categoria text NOT NULL CHECK (categoria IN ('vegetal','proteina')),
 preparacion text NOT NULL CHECK (preparacion IN ('classic','premium','monthly','dish')),
 nombre text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 2 AND 80),
 recargo integer NOT NULL DEFAULT 0 CHECK (recargo BETWEEN 0 AND 50000),
 activo boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 actualizado_por text NOT NULL,
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uki_armado_opciones_qa_unicas
 ON public.uki_armado_opciones_qa(branch,categoria,preparacion,lower(btrim(nombre)));
CREATE INDEX IF NOT EXISTS uki_armado_opciones_qa_sucursal
 ON public.uki_armado_opciones_qa(branch,preparacion,categoria);

CREATE TABLE IF NOT EXISTS public.uki_recetas_costos_qa (
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 sku text NOT NULL CHECK (length(sku) BETWEEN 3 AND 120),
 ingredientes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ingredientes)='array'),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 actualizado_por text NOT NULL,
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(branch,sku)
);

CREATE TABLE IF NOT EXISTS public.uki_productos_retirados_qa (
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 sku text NOT NULL CHECK (length(sku) BETWEEN 3 AND 120),
 retirado boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1,
 actualizado_por text NOT NULL,
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(branch,sku)
);
