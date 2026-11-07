-- QA: evitar doble conteo de una factura bajo la misma razón social
-- aunque se intente cargar en otra sucursal o marca.
CREATE UNIQUE INDEX IF NOT EXISTS fin_facturas_razon_proveedor_folio_unico
 ON public.fin_movimientos(
  razon_social_id,
  lower(btrim(proveedor)),
  lower(btrim(referencia))
 )
 WHERE tipo='compra' AND fuente='factura'
 AND estado<>'anulado' AND razon_social_id IS NOT NULL AND btrim(referencia)<>'';
