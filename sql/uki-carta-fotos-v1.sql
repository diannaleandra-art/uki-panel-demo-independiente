-- Uki Sushi: fotos de productos/promociones por sucursal (Neon ya existente).
-- Ejecutar ANTES de desplegar api/uki-carta-fotos-live.js.
-- Imágenes JPEG/WebP/PNG optimizadas por el iPhone a <= 256 KiB cada una.
-- No altera ni borra pedidos, caja, inventario ni los productos originales.
CREATE TABLE IF NOT EXISTS public.uki_carta_fotos_v1 (
  branch TEXT NOT NULL CHECK (branch IN ('arica','serena')),
  sku TEXT NOT NULL CHECK (length(sku) BETWEEN 5 AND 120),
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/webp','image/png')),
  data_base64 TEXT NOT NULL CHECK (length(data_base64) BETWEEN 50 AND 350000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch,sku)
);
