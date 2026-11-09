-- Migración ADITIVA para carta Uki Sushi, por sucursal.
-- No toca pedidos, ventas, cierres, stock ni las promociones existentes.
CREATE TABLE IF NOT EXISTS public.uki_carta_visibilidad_v1 (
 branch TEXT NOT NULL CHECK(branch IN ('arica','serena')),
 sku TEXT NOT NULL CHECK(length(sku) BETWEEN 3 AND 120),
 visible BOOLEAN NOT NULL DEFAULT TRUE,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 updated_by TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(branch,sku)
);
CREATE TABLE IF NOT EXISTS public.uki_carta_promos_custom_v1 (
 branch TEXT NOT NULL CHECK(branch IN ('arica','serena')),
 sku TEXT NOT NULL CHECK(sku ~ '^monthly:[a-z0-9-]{8,110}$'),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=500),
 price INTEGER NOT NULL CHECK(price BETWEEN 1 AND 1000000),
 roll_count INTEGER NOT NULL CHECK(roll_count BETWEEN 1 AND 20),
 pieces_per_roll INTEGER NOT NULL CHECK(pieces_per_roll IN (10,12)),
 size INTEGER GENERATED ALWAYS AS (roll_count * pieces_per_roll) STORED,
 sauce_count INTEGER NOT NULL CHECK(sauce_count BETWEEN 0 AND 20),
 korokes INTEGER NOT NULL DEFAULT 0 CHECK(korokes BETWEEN 0 AND 30),
 payments TEXT[] NOT NULL DEFAULT ARRAY['efectivo','transferencia']::text[],
 available BOOLEAN NOT NULL DEFAULT TRUE,
 visible BOOLEAN NOT NULL DEFAULT FALSE,
 -- Al publicar por primera vez queda constancia histórica, incluso si luego se retira.
 published_at TIMESTAMPTZ,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
 updated_by TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(branch,sku),
 CHECK(cardinality(payments) BETWEEN 1 AND 5),
 CHECK(payments <@ ARRAY['efectivo','transferencia','debito','credito','edenred']::text[])
);
CREATE INDEX IF NOT EXISTS uki_carta_promos_custom_v1_publica_idx
 ON public.uki_carta_promos_custom_v1(branch,visible,available);

-- Compatible con una tabla preexistente: nunca borra ni cambia registros anteriores.
ALTER TABLE public.uki_carta_promos_custom_v1
 ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
