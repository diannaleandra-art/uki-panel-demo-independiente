-- Prepara catálogo de la bodega compartida de La Serena.
-- No copiar existencias ni mínimos de otra bodega. No actualizar ni borrar registros.
-- Ejecutar únicamente al confirmar la activación de la bodega única.
INSERT INTO public.uki_inventario_items_live
 (branch,sku,name,stock_unit,stock_qty,min_stock_qty,updated_by)
SELECT 'serena',src.sku,src.name,src.stock_unit,0,0,'catalogo-base-arica'
FROM public.uki_inventario_items_live src
WHERE src.branch='arica'
ON CONFLICT(branch,sku) DO NOTHING;
INSERT INTO public.uki_inventario_extras_live
 (branch,sku,name,category,stock_unit,stock_qty,min_stock_qty,updated_by)
SELECT 'serena',src.sku,src.name,src.category,src.stock_unit,0,0,'catalogo-base-arica'
FROM public.uki_inventario_extras_live src
WHERE src.branch='arica'
 AND NOT EXISTS(SELECT 1 FROM public.uki_inventario_extras_live t
   WHERE t.branch='serena' AND lower(trim(t.name))=lower(trim(src.name)))
ON CONFLICT DO NOTHING;
