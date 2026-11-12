-- Uki Sushi · Migración ADITIVA preparada para producción. EJECUTAR SOLO CON AUTORIZACIÓN EXPLÍCITA.
-- Antes: verificar respaldo, proyecto Neon, branch de producción, permisos y fecha del corte.
-- Cada tabla usa branch (arica/serena); no se alteran tablas operativas ni precios originales.
BEGIN;
CREATE TABLE IF NOT EXISTS public.uki_carta_categorias_personalizadas_v1 (
  branch text NOT NULL CHECK (branch IN ('arica','serena')),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,44}$'),
  nombre text NOT NULL CHECK (char_length(trim(nombre)) BETWEEN 2 AND 45),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch,slug)
);
CREATE TABLE IF NOT EXISTS public.uki_carta_producto_categoria_v1 (
  branch text NOT NULL CHECK (branch IN ('arica','serena')),
  sku text NOT NULL CHECK (char_length(sku) BETWEEN 3 AND 120),
  category_slug text NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch,sku),
  FOREIGN KEY (branch,category_slug)
    REFERENCES public.uki_carta_categorias_personalizadas_v1(branch,slug)
);
CREATE TABLE IF NOT EXISTS public.uki_carta_descuentos_v1 (
  branch text NOT NULL CHECK (branch IN ('arica','serena')),
  sku text NOT NULL CHECK (char_length(sku) BETWEEN 3 AND 120),
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 0 AND 99),
  version integer NOT NULL DEFAULT 1 CHECK(version>=1),
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch,sku)
);
COMMIT;
-- NOTA: las tablas existentes de productos y promociones no reciben cambios.
-- El precio de referencia se conserva en su columna price; la API calculará el total.
