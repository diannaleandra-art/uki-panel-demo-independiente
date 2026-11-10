-- Uki Sushi: preparación de QA; NO EJECUTAR EN PRODUCCIÓN hasta aprobar
-- migración compatible + carta + validación QR en el mismo lanzamiento.
-- Nunca modifica pedidos, cajas, timbres, precios ni promociones existentes.
ALTER TABLE public.uki_carta_promos_custom_v1
 ADD COLUMN IF NOT EXISTS promo_type text NOT NULL DEFAULT 'sushi',
 ADD COLUMN IF NOT EXISTS customizable boolean NOT NULL DEFAULT TRUE;
ALTER TABLE public.uki_carta_promos_custom_v1
 DROP CONSTRAINT IF EXISTS uki_carta_promos_custom_v1_roll_count_check;
ALTER TABLE public.uki_carta_promos_custom_v1
 ADD CONSTRAINT uki_carta_promos_custom_v1_roll_count_check CHECK (
    (promo_type='sushi' AND roll_count BETWEEN 1 AND 20)
    OR (promo_type IN ('gohan','pizza','combo') AND roll_count=0)
 );
ALTER TABLE public.uki_carta_promos_custom_v1
 ADD CONSTRAINT uki_carta_promos_custom_v1_tipo_check CHECK (
    promo_type IN ('sushi','gohan','pizza','combo')
    AND (promo_type='sushi' OR customizable=FALSE)
 );
