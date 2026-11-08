-- Ingredientes seleccionables en la carta; NO son insumos del inventario.
-- Aditiva. No modifica pagos, stock, pedidos, timbres ni cierres.
CREATE TABLE IF NOT EXISTS public.uki_armado_ingredientes_v1 (
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 sku text NOT NULL,
 category text NOT NULL CHECK (category IN ('vegetal','proteina','envoltura')),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 70),
 surcharge integer NOT NULL DEFAULT 0 CHECK (surcharge BETWEEN 0 AND 50000),
 surfaces text[] NOT NULL CHECK (cardinality(surfaces) BETWEEN 1 AND 6),
 available boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
 updated_by text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(branch,sku),
 CHECK (surfaces <@ ARRAY['classic','premium','monthly','handroll','burger','gohan']::text[])
);
CREATE UNIQUE INDEX IF NOT EXISTS uki_armado_ingredientes_v1_name_uq
 ON public.uki_armado_ingredientes_v1(branch,category,lower(trim(name)));
CREATE INDEX IF NOT EXISTS uki_armado_ingredientes_v1_catalog_idx
 ON public.uki_armado_ingredientes_v1(branch,available,category);
