-- PREPARADO ÚNICAMENTE PARA REVISIÓN. NO EJECUTAR SIN AUTORIZACIÓN EXPLÍCITA.
-- Ejecutar exclusivamente después de instalar y verificar:
--   1. columnas promo_type/customizable y constraint QA ya probado,
--   2. API de precios y QR compatible con combo,
--   3. carta pública compatible con combo y banner.
-- Esta operación no toca clientes, pedidos, caja, timbres, cierres ni sucursal Serena.
-- Requiere que la fila de producción conserve VERSION=2 y precio=$6.000.
BEGIN;
DO $$
DECLARE found_count INTEGER;
BEGIN
 SELECT count(*) INTO found_count
 FROM public.uki_carta_promos_custom_v1 p
 WHERE p.branch='arica'
  AND p.sku='monthly:super-gohan-clasico-mas-dos-korokes-6a5885b2'
  AND p.name='Súper gohan clásico más dos korokes'
  AND p.price=6000 AND p.visible IS TRUE AND p.available IS TRUE
  AND p.version=2 AND p.roll_count=1 AND p.pieces_per_roll=12
  AND p.sauce_count=1 AND p.korokes=2 AND p.promo_type='sushi'
  AND EXISTS (
   SELECT 1 FROM public.uki_carta_fotos_v1 f
   WHERE f.branch=p.branch AND f.sku=p.sku
  );
 IF found_count<>1 THEN
   RAISE EXCEPTION 'Abortado: cambió promoción, versión o fotografía. Revisar manualmente.';
 END IF;
END $$;

UPDATE public.uki_carta_promos_custom_v1
SET description=CASE
      WHEN description ILIKE '%2 korokes%' THEN description
      ELSE trim(description)||' · Incluye 2 korokes'
    END,
    roll_count=0,pieces_per_roll=12,sauce_count=0,korokes=0,
    promo_type='combo',customizable=FALSE,
    version=version+1,updated_at=NOW()
WHERE branch='arica'
 AND sku='monthly:super-gohan-clasico-mas-dos-korokes-6a5885b2'
 AND version=2 AND price=6000;

-- Validar antes de COMMIT: una sola fila, SKU original, $6.000,
-- visible=true, size=0, fotografía y published_at conservados.
DO $$
DECLARE found_count INTEGER;
BEGIN
 SELECT count(*) INTO found_count
 FROM public.uki_carta_promos_custom_v1 p
 WHERE p.branch='arica'
  AND p.sku='monthly:super-gohan-clasico-mas-dos-korokes-6a5885b2'
  AND p.version=3 AND p.price=6000 AND p.visible=TRUE
  AND p.roll_count=0 AND p.size=0 AND p.sauce_count=0
  AND p.korokes=0 AND p.promo_type='combo'
  AND p.customizable=FALSE AND p.published_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.uki_carta_fotos_v1 f
              WHERE f.branch=p.branch AND f.sku=p.sku);
 IF found_count<>1 THEN
  RAISE EXCEPTION 'Abortado: los datos finales no coinciden.';
 END IF;
END $$;
COMMIT;
