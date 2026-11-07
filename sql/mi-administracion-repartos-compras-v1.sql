-- QA Mi Administración: repartir el costo de UNA factura entre uno o dos locales.
-- Una compra permanece en fin_movimientos; distribuciones no son gastos adicionales.
CREATE TABLE IF NOT EXISTS public.fin_compra_repartos(
 id bigserial PRIMARY KEY,
 compra_id uuid NOT NULL REFERENCES public.fin_movimientos(id),
 negocio_id uuid NOT NULL REFERENCES public.fin_negocios(id),
 sucursal_id uuid NOT NULL REFERENCES public.fin_sucursales(id),
 monto bigint NOT NULL CHECK(monto>0 AND monto<=1000000000),
 creado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE(compra_id,sucursal_id)
);
CREATE INDEX IF NOT EXISTS fin_compra_repartos_sucursal_idx
 ON public.fin_compra_repartos(negocio_id,sucursal_id,compra_id);

CREATE OR REPLACE FUNCTION public.fin_repartir_compra_v1(
 p_compra uuid,p_destinos jsonb,p_uid text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
 m record;
 fila jsonb;
 n int:=0;
 total bigint:=0;
 negocio uuid;
 sucursal uuid;
 cantidad bigint;
BEGIN
 SELECT id,monto,razon_social_id INTO m FROM public.fin_movimientos
 WHERE id=p_compra AND tipo='compra' AND fuente='factura' AND estado<>'anulado'
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Factura de compra no encontrada.'; END IF;
 IF m.razon_social_id IS NULL THEN RAISE EXCEPTION 'Primero asigna una razón social a la factura.'; END IF;
 IF jsonb_typeof(p_destinos)<>'array' OR jsonb_array_length(p_destinos) NOT BETWEEN 1 AND 2
 THEN RAISE EXCEPTION 'Selecciona uno o dos locales para repartir la compra.'; END IF;
 FOR fila IN SELECT value FROM jsonb_array_elements(p_destinos)
 LOOP
  n:=n+1;
  IF coalesce(fila->>'negocio_id','') !~ '^[0-9a-fA-F-]{36}$'
   OR coalesce(fila->>'sucursal_id','') !~ '^[0-9a-fA-F-]{36}$'
   OR coalesce(fila->>'monto','') !~ '^[0-9]{1,10}$'
  THEN RAISE EXCEPTION 'Revisa negocio, sucursal e importe de cada local.'; END IF;
  negocio=(fila->>'negocio_id')::uuid;
  sucursal=(fila->>'sucursal_id')::uuid;
  cantidad=(fila->>'monto')::bigint;
  IF cantidad<1 OR cantidad>m.monto OR NOT EXISTS(
    SELECT 1 FROM public.fin_sucursales s JOIN public.fin_negocios b ON b.id=s.negocio_id
    WHERE s.id=sucursal AND s.negocio_id=negocio AND b.activo=true AND s.activo=true
  ) THEN RAISE EXCEPTION 'Revisa la sucursal y el monto de su distribución.'; END IF;
  total=total+cantidad;
 END LOOP;
 IF total<>m.monto THEN
  RAISE EXCEPTION 'La suma de los importes de locales debe ser igual al total de la factura.';
 END IF;
 IF (SELECT COUNT(DISTINCT elem->>'sucursal_id') FROM jsonb_array_elements(p_destinos) elem)<>n
 THEN RAISE EXCEPTION 'No puedes seleccionar el mismo local dos veces.'; END IF;
 DELETE FROM public.fin_compra_repartos WHERE compra_id=p_compra;
 FOR fila IN SELECT value FROM jsonb_array_elements(p_destinos)
 LOOP
  negocio=(fila->>'negocio_id')::uuid;sucursal=(fila->>'sucursal_id')::uuid;
  cantidad=(fila->>'monto')::bigint;
  INSERT INTO public.fin_compra_repartos(compra_id,negocio_id,sucursal_id,monto)
   VALUES(p_compra,negocio,sucursal,cantidad);
  -- La misma razón social puede comprar para varias marcas; su vínculo es una configuración única.
  INSERT INTO public.fin_negocio_razones(negocio_id,razon_social_id)
   VALUES(negocio,m.razon_social_id) ON CONFLICT DO NOTHING;
 END LOOP;
 INSERT INTO public.fin_auditoria(entidad,entidad_id,accion,nuevo,actor_uid)
 VALUES('compra',p_compra::text,'repartir_entre_locales',
 jsonb_build_object('distribucion',p_destinos,'total_sin_duplicar',m.monto),p_uid);
 RETURN jsonb_build_object('ok',true,'locales',n,'total',m.monto);
END;$$;

CREATE OR REPLACE FUNCTION public.fin_registrar_compra_v3(
 p_negocio uuid,p_sucursal uuid,p_fecha date,p_proveedor text,
 p_referencia text,p_total bigint,p_neto bigint,p_iva bigint,p_otros bigint,
 p_descuento bigint,p_pendiente boolean,p_articulos jsonb,p_uid text,p_documento_clave text,
 p_razon_social uuid,p_comprador_factura text,p_observacion_factura text,
 p_destinos jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; movimiento uuid;
BEGIN
 IF p_razon_social IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.fin_razones_sociales WHERE id=p_razon_social AND activo=true
 ) THEN RAISE EXCEPTION 'Selecciona la razón social compradora.'; END IF;
 -- Si es la primera compra de esta razón para la marca, vincularla sin pedir otro permiso.
 INSERT INTO public.fin_negocio_razones(negocio_id,razon_social_id)
 VALUES(p_negocio,p_razon_social) ON CONFLICT DO NOTHING;
 result:=public.fin_registrar_compra_v2(
  p_negocio,p_sucursal,p_fecha,p_proveedor,p_referencia,p_total,p_neto,p_iva,p_otros,
  p_descuento,p_pendiente,p_articulos,p_uid,p_documento_clave,
  p_razon_social,p_comprador_factura,p_observacion_factura);
 IF result->>'ok'='true' AND p_destinos IS NOT NULL THEN
  movimiento=(result->>'id')::uuid;
  PERFORM public.fin_repartir_compra_v1(movimiento,p_destinos,p_uid);
 END IF;
 RETURN result;
END;$$;
