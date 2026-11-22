-- Costeo privado v1. Migración exclusivamente aditiva. NO aplicar sin revisar acceso de dueños.
-- Se conserva stock, catálogo, pedidos y caja tal y como están.
BEGIN;
CREATE TABLE IF NOT EXISTS public.costeo_precios_v1 (
  store_id text NOT NULL CHECK (store_id IN ('romo:serena')),
  sku text NOT NULL CHECK (length(btrim(sku)) BETWEEN 1 AND 180),
  unit text NOT NULL CHECK (unit IN ('kg','g','l','ml','un')),
  quantity numeric(18,6) NOT NULL CHECK (quantity > 0 AND quantity <= 100000000),
  price bigint NOT NULL CHECK (price > 0 AND price <= 1000000000),
  source_ref text CHECK (length(source_ref)<=240),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision>0),
  updated_by text NOT NULL CHECK (length(btrim(updated_by)) BETWEEN 1 AND 150),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(store_id,sku)
);
CREATE TABLE IF NOT EXISTS public.costeo_recetas_v1 (
  store_id text NOT NULL CHECK (store_id IN ('romo:serena')),
  product_sku text NOT NULL CHECK (length(btrim(product_sku)) BETWEEN 1 AND 180),
  variant_key text NOT NULL DEFAULT 'base' CHECK (length(btrim(variant_key)) BETWEEN 1 AND 180),
  ingredient_sku text NOT NULL CHECK (length(btrim(ingredient_sku)) BETWEEN 1 AND 180),
  quantity numeric(18,6) NOT NULL CHECK (quantity>0 AND quantity<=100000000),
  unit text NOT NULL CHECK (unit IN ('kg','g','l','ml','un')),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision>0),
  updated_by text NOT NULL CHECK (length(btrim(updated_by)) BETWEEN 1 AND 150),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(store_id,product_sku,variant_key,ingredient_sku)
);
-- Una receta borrador no puede generar rentabilidad: requiere confirmación explícita.
CREATE TABLE IF NOT EXISTS public.costeo_recetas_estado_v1 (
  store_id text NOT NULL CHECK (store_id IN ('romo:serena')),
  product_sku text NOT NULL CHECK (length(btrim(product_sku)) BETWEEN 1 AND 180),
  variant_key text NOT NULL DEFAULT 'base' CHECK (length(btrim(variant_key)) BETWEEN 1 AND 180),
  confirmed boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision>0),
  updated_by text NOT NULL CHECK (length(btrim(updated_by)) BETWEEN 1 AND 150),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(store_id,product_sku,variant_key)
);
-- Los precios son privados, nunca datos de la carta pública ni acceso por PIN trabajador.
ALTER TABLE public.costeo_precios_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costeo_recetas_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costeo_recetas_estado_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.costeo_precios_v1, public.costeo_recetas_v1, public.costeo_recetas_estado_v1 FROM PUBLIC;
COMMIT;
-- La API de dueños debe validar SKU existente, sucursal, unidad compatible y revisión.
-- Guardar receta y estado en una transacción; cualquier edición devuelve a borrador.
-- No descontar existencias hasta disponer de desglose completo y operación única por pedido.
