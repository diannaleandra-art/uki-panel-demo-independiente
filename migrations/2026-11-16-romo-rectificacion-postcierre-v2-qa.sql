-- 2026-11-16. Romo La Serena · rectificación v2 de cierre ORIGINAL.
-- SOLO MIGRACIÓN PREPARADA. No ejecutar ni habilitar escritura en producción.
-- Inmutable: el cierre original permanece en romo_cierres_constancia_v1.
-- Una operación atómica liga estado operativo CIFRADO (CAS) y recibo v2.
BEGIN;
DO $$
BEGIN
 IF current_database()<>'romos_sushi' THEN
  RAISE EXCEPTION 'Migración exclusiva de romos_sushi';
 END IF;
 IF to_regclass('public.romo_cierres_constancia_v1') IS NULL OR
    to_regclass('public.romo_estado_operativo_v1') IS NULL THEN
  RAISE EXCEPTION 'Faltan las constancias o el estado de Romo';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.romo_rectificaciones_cierre_v2 (
 store_id text NOT NULL DEFAULT 'romo:serena'
    CHECK(store_id='romo:serena'),
 fuente_unica text NOT NULL,
 fuente_original text NOT NULL,
 turno_ref text NOT NULL,
 version integer NOT NULL DEFAULT 2 CHECK(version=2),
 pedido_id bigint NOT NULL CHECK(pedido_id>0),
 clase text NOT NULL CHECK(clase IN ('devolucion','cobro_adicional')),
 medio text NOT NULL CHECK(medio IN ('Efectivo','Transferencia','Débito','Edenred','Otros')),
 importe bigint NOT NULL CHECK(importe BETWEEN 1 AND 100000000),
 delta bigint NOT NULL CHECK(delta BETWEEN -100000000 AND 100000000 AND delta<>0),
 turno_movimiento text NOT NULL,
 fecha_operativa_movimiento date NOT NULL,
 revision_original bigint NOT NULL CHECK(revision_original>0),
 revision_neon bigint NOT NULL CHECK(revision_neon>1),
 sha256_original text NOT NULL CHECK(length(sha256_original)=64),
 sha256_snapshot text NOT NULL CHECK(length(sha256_snapshot)=64),
 resumen jsonb NOT NULL CHECK(jsonb_typeof(resumen)='object'),
 creado_por_uid text NOT NULL CHECK(length(creado_por_uid) BETWEEN 1 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (store_id,fuente_unica),
 UNIQUE(store_id,fuente_original,version),
 UNIQUE(store_id,turno_ref,version),
 FOREIGN KEY(store_id,fuente_original)
   REFERENCES public.romo_cierres_constancia_v1(store_id,source_key),
 CHECK(fuente_original='romo:serena|'||turno_ref),
 CHECK(fuente_unica=fuente_original||'|v2'),
 CHECK(turno_movimiento<>turno_ref),
 CHECK((clase='devolucion' AND delta=-importe) OR
       (clase='cobro_adicional' AND delta=importe))
);
CREATE INDEX IF NOT EXISTS romo_rectificaciones_cierre_v2_por_movimiento
 ON public.romo_rectificaciones_cierre_v2
 (store_id,fecha_operativa_movimiento,turno_movimiento);

CREATE OR REPLACE FUNCTION public.romo_confirmar_rectificacion_cierre_v2(
 p_expected_revision bigint,
 p_snapshot jsonb,
 p_sha256 text,
 p_resumen jsonb,
 p_actor_uid text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
 o public.romo_cierres_constancia_v1%ROWTYPE;
 r public.romo_estado_operativo_v1%ROWTYPE;
 original_medios jsonb; propuesta_medios jsonb;
 k text; clase text; medio text; turno text; turno_mov text;
 importe bigint;delta bigint;venta_original bigint;venta_nueva bigint;
 fecha_cierre bigint;mov_ms bigint;inicio_ms bigint;
 revision_nueva bigint;
 fecha_mov date;
BEGIN
 IF current_database()<>'romos_sushi' OR
   p_expected_revision IS NULL OR p_expected_revision<1 OR
   length(p_sha256)<>64 OR p_sha256 !~ '^[0-9a-f]{64}$' OR
   coalesce(length(p_actor_uid),0) NOT BETWEEN 1 AND 128 OR
   p_resumen IS NULL OR jsonb_typeof(p_resumen)<>'object' OR
   p_snapshot IS NULL OR jsonb_typeof(p_snapshot)<>'object' OR
   p_snapshot->>'formato'<>'uki-v813-browser' OR
   p_snapshot->>'version'<>'1' OR
   p_snapshot->>'sucursal'<>'Romo’s Sushi La Serena' OR
   NOT (p_snapshot ?& ARRAY['salt','iv','cifrado']) THEN
  RAISE EXCEPTION 'Estado cifrado o credenciales Romo inválidos';
 END IF;
 IF p_resumen->>'origen'<>'romo' OR
   p_resumen->>'store_id'<>'romo:serena' OR
   p_resumen->>'estado'<>'pendiente_constancia_neon' OR
   p_resumen->>'version'<>'2' OR
   p_resumen->>'comprobante_original_conservado'<>'true' OR
   p_resumen->>'dinero_real_confirmado'<>'true' THEN
  RAISE EXCEPTION 'La rectificación no está lista para confirmar';
 END IF;
 turno=p_resumen->>'turno_ref';
 turno_mov=p_resumen->>'turno_movimiento';
 k=p_resumen->>'fuente_original';
 IF turno IS NULL OR
   turno !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}@[1-9][0-9]{12,14}$' OR
   turno_mov IS NULL OR
   turno_mov !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}@[1-9][0-9]{12,14}$' OR
   turno_mov=turno OR k<>'romo:serena|'||turno OR
   p_resumen->>'fuente_unica'<>k||'|v2' THEN
  RAISE EXCEPTION 'Los turnos de origen o movimiento no son válidos';
 END IF;
 clase=p_resumen->>'clase';medio=p_resumen->>'medio';
 IF clase NOT IN ('devolucion','cobro_adicional') OR
    medio NOT IN ('Efectivo','Transferencia','Débito','Edenred','Otros') OR
    (p_resumen->>'monto') !~ '^[0-9]{1,9}$' OR
    (p_resumen->>'pedido_id') !~ '^[0-9]{1,12}$' OR
    (p_resumen->>'delta') !~ '^[-]?[0-9]{1,9}$' OR
    (p_resumen->>'venta_original') !~ '^[0-9]{1,10}$' OR
    (p_resumen->>'venta_rectificada') !~ '^[0-9]{1,10}$' OR
    (p_resumen->>'confirmado_en_ms') !~ '^[0-9]{13}$' OR
    (p_resumen->>'fecha_cierre_ms') !~ '^[0-9]{13}$' OR
    coalesce(length(btrim(p_resumen->>'responsable')),0) NOT BETWEEN 2 AND 80 OR
    coalesce(length(btrim(p_resumen->>'motivo')),0) NOT BETWEEN 4 AND 300 OR
    coalesce(length(btrim(p_resumen->>'referencia')),0) NOT BETWEEN 4 AND 150 THEN
  RAISE EXCEPTION 'Importes o datos de auditoría inválidos';
 END IF;
 importe=(p_resumen->>'monto')::bigint;
 delta=(p_resumen->>'delta')::bigint;
 venta_original=(p_resumen->>'venta_original')::bigint;
 venta_nueva=(p_resumen->>'venta_rectificada')::bigint;
 fecha_cierre=(p_resumen->>'fecha_cierre_ms')::bigint;
 mov_ms=(p_resumen->>'confirmado_en_ms')::bigint;
 inicio_ms=split_part(turno_mov,'@',2)::bigint;
 fecha_mov=(p_resumen->>'fecha_operativa_movimiento')::date;
 IF importe<1 OR importe>100000000 OR
    (clase='devolucion' AND delta<>-importe) OR
    (clase='cobro_adicional' AND delta<>importe) OR
    venta_original+delta<>venta_nueva OR venta_nueva<0 OR
    mov_ms<=fecha_cierre OR mov_ms<inicio_ms OR
    to_timestamp(mov_ms/1000.0)>now()+interval '20 minutes' OR
    fecha_mov::text<>left(turno_mov,10) OR
    (to_timestamp(inicio_ms/1000.0) AT TIME ZONE 'America/Santiago')::date<>fecha_mov OR
    (to_timestamp(mov_ms/1000.0) AT TIME ZONE 'America/Santiago')::date<>fecha_mov THEN
  RAISE EXCEPTION 'El importe o el turno real del movimiento no concuerdan';
 END IF;

 -- Bloquear la revisión operativa, nunca volver a abrir el cierre anterior.
 SELECT * INTO r FROM public.romo_estado_operativo_v1
  WHERE store_id='romo:serena' FOR UPDATE;
 IF NOT FOUND OR r.revision<>p_expected_revision THEN
  RAISE EXCEPTION 'Romo cambió de revisión: consultar antes de reintentar';
 END IF;
 SELECT * INTO o FROM public.romo_cierres_constancia_v1
  WHERE store_id='romo:serena' AND source_key=k FOR SHARE;
 IF NOT FOUND OR o.turno_ref<>turno OR
   o.resumen->>'fuente_unica'<>k OR
   (o.resumen->>'fecha_cierre_ms')::bigint<>fecha_cierre OR
   (o.resumen->>'venta_total')::bigint<>venta_original THEN
  RAISE EXCEPTION 'La constancia original no respalda la rectificación';
 END IF;
 IF EXISTS(SELECT 1 FROM public.romo_rectificaciones_cierre_v2
    WHERE store_id='romo:serena' AND fuente_original=k) THEN
  RAISE EXCEPTION 'Ya se confirmó una versión de este cierre';
 END IF;
 original_medios=o.resumen->'medios';
 propuesta_medios=p_resumen->'medios_rectificados';
 IF jsonb_typeof(original_medios)<>'object' OR
    original_medios IS DISTINCT FROM p_resumen->'medios_original' OR
    jsonb_typeof(propuesta_medios)<>'object' OR
    (original_medios->>medio) !~ '^[0-9]{1,10}$' OR
    (original_medios->>medio)::bigint+delta<0 OR
    propuesta_medios IS DISTINCT FROM jsonb_set(original_medios,
     ARRAY[medio],to_jsonb((original_medios->>medio)::bigint+delta),false) THEN
  RAISE EXCEPTION 'El ajuste modifica medios diferentes al original';
 END IF;

 UPDATE public.romo_estado_operativo_v1
 SET revision=revision+1,snapshot=p_snapshot,
     actualizado_por=p_actor_uid,actualizado_en=now()
 WHERE store_id='romo:serena' RETURNING revision INTO revision_nueva;
 INSERT INTO public.romo_rectificaciones_cierre_v2
 (store_id,fuente_unica,fuente_original,turno_ref,version,pedido_id,
  clase,medio,importe,delta,turno_movimiento,fecha_operativa_movimiento,
  revision_original,revision_neon,sha256_original,sha256_snapshot,resumen,
  creado_por_uid)
 VALUES('romo:serena',k||'|v2',k,turno,2,(p_resumen->>'pedido_id')::bigint,
  clase,medio,importe,delta,turno_mov,fecha_mov,
  o.revision_neon,revision_nueva,o.snapshot_sha256,p_sha256,
  p_resumen,p_actor_uid);
 RETURN jsonb_build_object('storeId','romo:serena','original',k,
   'fuenteRectificacion',k||'|v2','version',2,'revision',revision_nueva,
   'delta',delta,'medio',medio,'turnoMovimiento',turno_mov,'confirmado',true);
END;
$$;

REVOKE ALL ON TABLE public.romo_rectificaciones_cierre_v2 FROM PUBLIC;
REVOKE ALL ON TABLE public.romo_rectificaciones_cierre_v2 FROM romos_app_service;
GRANT SELECT ON TABLE public.romo_rectificaciones_cierre_v2 TO romos_app_service;
REVOKE ALL ON FUNCTION public.romo_confirmar_rectificacion_cierre_v2(
 bigint,jsonb,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.romo_confirmar_rectificacion_cierre_v2(
 bigint,jsonb,text,jsonb,text) TO romos_app_service;

COMMIT;
