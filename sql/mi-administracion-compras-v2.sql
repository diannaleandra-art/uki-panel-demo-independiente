-- QA: guardar encabezado de compra y articulos en una sola transaccion.
-- No altera movimientos/cierres operativos; no actualiza stock.
CREATE OR REPLACE FUNCTION public.fin_registrar_compra_v1(
 p_negocio uuid,p_sucursal uuid,p_fecha date,p_proveedor text,
 p_referencia text,p_total bigint,p_neto bigint,p_iva bigint,p_otros bigint,
 p_descuento bigint,p_pendiente boolean,p_articulos jsonb,p_uid text,p_documento_clave text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
 k text;
 m_id uuid;
 fila jsonb;
 idx int:=0;
 qty numeric;
 unit_cost bigint;
 total_item bigint;
 n int;
 existing uuid;
BEGIN
 IF p_total<1 OR p_total>1000000000 OR p_neto<0 OR p_iva<0 OR p_otros<0 OR p_descuento<0
    OR p_neto+p_iva+p_otros-p_descuento<>p_total THEN
   RAISE EXCEPTION 'El total no coincide con neto, IVA, otros cargos y descuentos.';
 END IF;
 IF char_length(btrim(coalesce(p_proveedor,'')))<2 OR char_length(p_proveedor)>120
    OR char_length(coalesce(p_referencia,''))>130 THEN
   RAISE EXCEPTION 'Proveedor o número de factura incorrecto.';
 END IF;
 IF p_fecha IS NULL OR p_fecha>current_date+interval '30 days' THEN
   RAISE EXCEPTION 'Fecha de compra incorrecta.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.fin_negocios WHERE id=p_negocio AND activo=true) THEN
   RAISE EXCEPTION 'Negocio inválido.';
 END IF;
 IF p_sucursal IS NOT NULL AND NOT EXISTS
  (SELECT 1 FROM public.fin_sucursales WHERE id=p_sucursal AND negocio_id=p_negocio AND activo=true) THEN
   RAISE EXCEPTION 'La sucursal no pertenece al negocio.';
 END IF;
 IF jsonb_typeof(p_articulos)<>'array' OR jsonb_array_length(p_articulos)>60 THEN
   RAISE EXCEPTION 'Los artículos deben ser una lista de hasta 60 productos.';
 END IF;
 k=encode(digest(concat_ws('|','compra_factura',p_negocio::text,lower(btrim(p_proveedor)),
                      p_fecha::text,lower(btrim(p_referencia)),p_total::text,coalesce(p_documento_clave,'')),'sha256'),'hex');
 SELECT id INTO existing FROM public.fin_movimientos WHERE clave_unica=k;
 IF existing IS NOT NULL THEN
  RETURN jsonb_build_object('ok',false,'duplicado',true,'id',existing);
 END IF;
 -- Si ya había un gasto/compra manual idéntico, solicitar decisión explícita y no sumar de nuevo.
 SELECT id INTO existing FROM public.fin_movimientos WHERE negocio_id=p_negocio
  AND sucursal_id IS NOT DISTINCT FROM p_sucursal AND fecha=p_fecha AND tipo IN ('compra','gasto')
  AND monto=p_total AND lower(btrim(proveedor))=lower(btrim(p_proveedor))
  AND estado<>'anulado' LIMIT 1;
 IF existing IS NOT NULL THEN
  RETURN jsonb_build_object('ok',false,'posible_duplicado',true,'id',existing);
 END IF;
 INSERT INTO public.fin_movimientos(
  negocio_id,sucursal_id,tipo,fecha,monto,medios,categoria,concepto,proveedor,referencia,estado,fuente,
  datos,clave_unica,creado_por
 ) VALUES(
  p_negocio,p_sucursal,'compra',p_fecha,p_total,'{}'::jsonb,'Mercadería','Compra desde factura',
  btrim(p_proveedor),btrim(p_referencia),CASE WHEN p_pendiente THEN 'pendiente' ELSE 'pagado' END,
  'factura',
  jsonb_build_object('neto',p_neto,'iva',p_iva,'otros',p_otros,'descuento',p_descuento,
    'desglose_confirmado',jsonb_array_length(p_articulos)>0,'fecha_importacion',now()),
  k,p_uid
 ) ON CONFLICT DO NOTHING RETURNING id INTO m_id;
 IF m_id IS NULL THEN
  RETURN jsonb_build_object('ok',false,'duplicado',true);
 END IF;
 FOR fila IN SELECT value FROM jsonb_array_elements(p_articulos)
 LOOP
  idx:=idx+1;
  IF char_length(btrim(coalesce(fila->>'nombre','')))<2
     OR char_length(fila->>'nombre')>180
     OR coalesce(fila->>'cantidad','') !~ '^[0-9]{1,6}([.][0-9]{1,3})?$'
     OR coalesce(fila->>'precio_unitario','') !~ '^[0-9]{1,10}$'
     OR coalesce(fila->>'total','') !~ '^[0-9]{1,10}$'
  THEN
   RAISE EXCEPTION 'Revisa los artículos y las cantidades.';
  END IF;
  qty=(fila->>'cantidad')::numeric;
  unit_cost=(fila->>'precio_unitario')::bigint;
  total_item=(fila->>'total')::bigint;
  IF qty<=0 OR qty>100000 OR unit_cost>1000000000 OR total_item>1000000000
      OR abs(round(qty*unit_cost)-total_item)>2 THEN
   RAISE EXCEPTION 'Cantidad, precio unitario o importe de artículo incorrectos.';
  END IF;
  INSERT INTO public.fin_compra_items(
   compra_id,posicion,descripcion,cantidad,unidad,precio_unitario,total_linea
  ) VALUES(m_id,idx,btrim(fila->>'nombre'),qty,
    left(coalesce(nullif(btrim(fila->>'unidad'),''),'un'),15),unit_cost,total_item);
 END LOOP;
 INSERT INTO public.fin_auditoria(entidad,entidad_id,accion,nuevo,actor_uid)
 VALUES('compra',m_id::text,'crear',jsonb_build_object('proveedor',p_proveedor,'fecha',p_fecha,'total',p_total,'articulos',idx),p_uid);
 RETURN jsonb_build_object('ok',true,'id',m_id,'articulos',idx);
END;
$$;
