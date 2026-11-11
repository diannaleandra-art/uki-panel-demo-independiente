-- ROMO LA SERENA — PROPUESTA DE TABLA SOLO PARA REVISIÓN
-- NO EJECUTAR. No contiene datos de Uki ni activa operaciones.
-- Aprobación expresa y validación de rol SQL antes de aplicar.
BEGIN;
CREATE TABLE IF NOT EXISTS public.romo_inventario_v1(
 store_id TEXT PRIMARY KEY CHECK(store_id='romo:serena'),
 revision BIGINT NOT NULL CHECK(revision>0),
 contenido JSONB NOT NULL CHECK(jsonb_typeof(contenido)='object'),
 actualizado_por TEXT NOT NULL,
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL ON TABLE public.romo_inventario_v1 FROM PUBLIC;
COMMIT;
