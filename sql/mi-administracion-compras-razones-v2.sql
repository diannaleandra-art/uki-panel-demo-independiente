-- Transacción única para compras asociadas a razón social (QA financiero).
CREATE OR REPLACE FUNCTION public.fin_registrar_compra_v2(
 p_negocio uuid,p_sucursal uuid,p_fecha date,p_proveedor text,
 p_referencia text,p_total bigint,p_neto bigint,p_iva bigint,p_otros bigint,
 p_descuento bigint,p_pendiente boolean,p_articulos jsonb,p_uid text,p_documento_clave text,
 p_razon_social uuid,p_comprador_factura text,p_observacion_factura text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; movimiento uuid;
BEGIN
 IF p_razon_social IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.fin_negocio_razones nr
  JOIN public.fin_razones_sociales r ON nr.razon_social_id=r.id
  WHERE nr.negocio_id=p_negocio AND nr.razon_social_id=p_razon_social AND r.activo=true
 ) THEN
  RAISE EXCEPTION 'Selecciona una razón social vinculada a ese negocio.';
 END IF;
 result:=public.fin_registrar_compra_v1(
 p_negocio,p_sucursal,p_fecha,p_proveedor,p_referencia,p_total,p_neto,p_iva,p_otros,
 p_descuento,p_pendiente,p_articulos,p_uid,p_documento_clave);
 IF result->>'ok'='true' THEN
   movimiento=(result->>'id')::uuid;
   UPDATE public.fin_movimientos SET razon_social_id=p_razon_social,
   datos=coalesce(datos,'{}'::jsonb)||jsonb_build_object(
     'comprador_factura',left(coalesce(p_comprador_factura,''),140),
     'observacion_factura',left(coalesce(p_observacion_factura,''),140)
   ) WHERE id=movimiento;
   INSERT INTO public.fin_auditoria(entidad,entidad_id,accion,nuevo,actor_uid)
   VALUES('compra',movimiento::text,'asignar_razon_social_al_registrar',
   jsonb_build_object('razon_social_id',p_razon_social),p_uid);
 END IF;
 RETURN result;
END;
$$;
