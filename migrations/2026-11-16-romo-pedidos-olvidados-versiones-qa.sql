-- Romo La Serena · versiones consecutivas para pedidos OMITIDOS de cierres.
-- SOLO PREPARACIÓN. No ejecutar en producción antes de prueba manual/autorización.
-- No se registra dinero nuevo en el turno actual: el cobro ya ocurrió.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'romos_sushi' OR
  to_regclass('public.romo_cierres_constancia_v1') IS NULL OR
  to_regclass('public.romo_estado_operativo_v1') IS NULL
 THEN RAISE EXCEPTION 'Solo en la base de Romo y con cierres originales';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.romo_pedidos_olvidados_versiones_v1(
 store_id text NOT NULL DEFAULT 'romo:serena' CHECK(store_id='romo:serena'),
 fuente_original text NOT NULL,
 fuente_previa text NOT NULL,
 fuente_unica text NOT NULL,
 turno_ref text NOT NULL,
 version integer NOT NULL CHECK(version BETWEEN 2 AND 32),
 solicitud_id bigint NOT NULL CHECK(solicitud_id>0),
 clave_olvido text NOT NULL CHECK(clave_olvido ~ '^[0-9a-f]{64}$'),
 fecha_operativa_original date NOT NULL,
 monto_productos bigint NOT NULL CHECK(monto_productos>0),
 monto_delivery bigint NOT NULL CHECK(monto_delivery>=0),
 total_pedido bigint NOT NULL CHECK(total_pedido>0),
 cobro_local bigint NOT NULL CHECK(cobro_local>=0),
 cobro_externo bigint NOT NULL CHECK(cobro_externo>=0),
 reparto_pendiente bigint NOT NULL CHECK(reparto_pendiente>=0),
 version_venta_anterior bigint NOT NULL CHECK(version_venta_anterior>=0),
 version_venta_rectificada bigint NOT NULL CHECK(version_venta_rectificada>=0),
 revision_original bigint NOT NULL CHECK(revision_original>0),
 revision_neon bigint NOT NULL CHECK(revision_neon>1),
 sha_original text NOT NULL CHECK(sha_original ~ '^[0-9a-f]{64}$'),
 sha_previa text NOT NULL CHECK(sha_previa ~ '^[0-9a-f]{64}$'),
 sha_snapshot text NOT NULL CHECK(sha_snapshot ~ '^[0-9a-f]{64}$'),
 resumen jsonb NOT NULL CHECK(jsonb_typeof(resumen)='object'),
 creado_por_uid text NOT NULL CHECK(length(creado_por_uid) BETWEEN 1 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,fuente_unica),
 UNIQUE(store_id,fuente_original,version),
 UNIQUE(store_id,turno_ref,version),
 UNIQUE(store_id,turno_ref,solicitud_id),
 UNIQUE(store_id,clave_olvido),
 FOREIGN KEY(store_id,fuente_original)
  REFERENCES public.romo_cierres_constancia_v1(store_id,source_key),
 CHECK(fuente_original='romo:serena|'||turno_ref),
 CHECK(fuente_unica=fuente_original||'|v'||version),
 CHECK((version=2 AND fuente_previa=fuente_original) OR
       (version>2 AND fuente_previa=fuente_original||'|v'||(version-1))),
 CHECK(total_pedido=monto_productos+monto_delivery),
 CHECK(total_pedido=cobro_local+cobro_externo),
 CHECK(version_venta_rectificada=version_venta_anterior+cobro_local),
 CHECK(reparto_pendiente<=monto_delivery)
);
CREATE INDEX IF NOT EXISTS romo_olvidos_versiones_lookup
 ON public.romo_pedidos_olvidados_versiones_v1
 (store_id,turno_ref,version DESC);

CREATE OR REPLACE FUNCTION public.romo_confirmar_pedido_olvidado_versionado_v1(
 p_expected_revision bigint,p_snapshot jsonb,p_sha256 text,
 p_resumen jsonb,p_uid text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 orig public.romo_cierres_constancia_v1%ROWTYPE;
 current_state public.romo_estado_operativo_v1%ROWTYPE;
 previous public.romo_pedidos_olvidados_versiones_v1%ROWTYPE;
 v integer;turno text;fuente text;previa text;
 local bigint;externo bigint;productos bigint;delivery bigint;
 total bigint;dl bigint;de bigint;pl bigint;pe bigint;
 venta_orig bigint;venta_prev bigint;venta_nueva bigint;
 reparto bigint;version_prev integer;revision_nueva bigint;
 anterior_medios jsonb;nuevo_medios jsonb;medio text;
 medio_original bigint;fecha_ms bigint;confirmado_ms bigint;
 cifra text;existe boolean;
BEGIN
 IF current_database()<>'romos_sushi' OR p_expected_revision IS NULL OR
  p_expected_revision<1 OR p_expected_revision>9007199254740990 OR
  p_resumen IS NULL OR jsonb_typeof(p_resumen)<>'object' OR
  p_snapshot IS NULL OR jsonb_typeof(p_snapshot)<>'object' OR
  p_snapshot->>'formato'<>'uki-v813-browser' OR
  p_snapshot->>'version'<>'1' OR
  p_snapshot->>'sucursal'<>'Romo’s Sushi La Serena' OR
  NOT p_snapshot ?& ARRAY['salt','iv','cifrado'] OR
  p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' OR
  length(coalesce(p_uid,'')) NOT BETWEEN 1 AND 128 THEN
  RAISE EXCEPTION 'Los datos cifrados de Romo no están autorizados';
 END IF;
 IF p_resumen->>'origen'<>'romo' OR p_resumen->>'store_id'<>'romo:serena' OR
  p_resumen->>'tipo'<>'pedido_olvidado' OR
  p_resumen->>'estado'<>'pendiente_constancia_neon' OR
  p_resumen->>'sin_cobro_nuevo'<>'true' OR
  p_resumen->>'no_modifica_caja_actual'<>'true' OR
  p_resumen->>'comprobante_original_conservado'<>'true' THEN
  RAISE EXCEPTION 'La venta histórica no está conciliada';
 END IF;
 turno=p_resumen->>'turno_ref';
 fuente=p_resumen->>'fuente_original';
 previa=p_resumen->>'fuente_previa';
 IF turno IS NULL OR turno !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}@[1-9][0-9]{12,14}$'
  OR fuente IS DISTINCT FROM 'romo:serena|'||turno OR
  (p_resumen->>'version') !~ '^[0-9]{1,2}$' OR
  (p_resumen->>'solicitud_id') !~ '^[1-9][0-9]{0,11}$' OR
  (p_resumen->>'clave_olvido') !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'Cierre original o folio de solicitud incorrecto';
 END IF;
 v=(p_resumen->>'version')::integer;
 IF v<2 OR v>32 OR
  p_resumen->>'fuente_unica' IS DISTINCT FROM fuente||'|v'||v OR
  previa IS DISTINCT FROM
    (CASE WHEN v=2 THEN fuente ELSE fuente||'|v'||(v-1) END) THEN
  RAISE EXCEPTION 'La versión no es consecutiva';
 END IF;
 IF (p_resumen->>'productos') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'delivery') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'total') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'recibido_local') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'recibido_otro_local') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'delivery_local') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'delivery_otro_local') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'productos_local') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'productos_otro_local') !~ '^[0-9]{1,9}$' OR
  (p_resumen->>'venta_original') !~ '^[0-9]{1,10}$' OR
  (p_resumen->>'venta_previa') !~ '^[0-9]{1,10}$' OR
  (p_resumen->>'venta_rectificada') !~ '^[0-9]{1,10}$' OR
  (p_resumen->>'fecha_cierre_ms') !~ '^[0-9]{13}$' OR
  (p_resumen->>'fecha_confirmacion_ms') !~ '^[0-9]{13}$' OR
  (p_resumen->>'delivery_repartidor_por_conciliar') !~ '^[0-9]{1,9}$'
 THEN RAISE EXCEPTION 'Importes del pedido omitido inválidos';
 END IF;
 productos=(p_resumen->>'productos')::bigint;
 delivery=(p_resumen->>'delivery')::bigint;
 total=(p_resumen->>'total')::bigint;
 local=(p_resumen->>'recibido_local')::bigint;
 externo=(p_resumen->>'recibido_otro_local')::bigint;
 dl=(p_resumen->>'delivery_local')::bigint;
 de=(p_resumen->>'delivery_otro_local')::bigint;
 pl=(p_resumen->>'productos_local')::bigint;
 pe=(p_resumen->>'productos_otro_local')::bigint;
 reparto=(p_resumen->>'delivery_repartidor_por_conciliar')::bigint;
 venta_orig=(p_resumen->>'venta_original')::bigint;
 venta_prev=(p_resumen->>'venta_previa')::bigint;
 venta_nueva=(p_resumen->>'venta_rectificada')::bigint;
 fecha_ms=(p_resumen->>'fecha_cierre_ms')::bigint;
 confirmado_ms=(p_resumen->>'fecha_confirmacion_ms')::bigint;
 IF productos<1 OR total<1 OR total>100000000 OR
  total<>productos+delivery OR total<>local+externo OR
  dl+de<>delivery OR pl+pe<>productos OR
  pl+dl<>local OR pe+de<>externo OR
  reparto>delivery OR
  (p_resumen->>'reparto_realizado'='true')<>(reparto=delivery AND delivery>0) OR
  venta_prev+local<>venta_nueva OR venta_nueva>1000000000 OR
  fecha_ms<=0 OR confirmado_ms<=fecha_ms OR
  to_timestamp(confirmado_ms/1000.0)>now()+interval '20 minutes' OR
  coalesce(length(btrim(p_resumen->>'responsable')),0) NOT BETWEEN 2 AND 80 OR
  coalesce(length(btrim(p_resumen->>'motivo')),0) NOT BETWEEN 4 AND 300
 THEN RAISE EXCEPTION 'La conciliación histórica no cuadra';
 END IF;
 medio=p_resumen->>'medio_local';
 IF (local>0 AND medio NOT IN ('Efectivo','Transferencia','Débito','Edenred','Otros'))
 OR (local=0 AND medio IS NOT NULL) OR
 (local>0 AND coalesce(length(btrim(p_resumen->>'referencia_local')),0) NOT BETWEEN 4 AND 150)
 OR (externo>0 AND coalesce(length(btrim(p_resumen->>'local_externo')),0) NOT BETWEEN 2 AND 80)
 OR (externo>0 AND coalesce(length(btrim(p_resumen->>'referencia_externa')),0) NOT BETWEEN 4 AND 150)
 THEN RAISE EXCEPTION 'Falta confirmar a quién y por qué medio se pagó';
 END IF;
 IF p_resumen->>'fecha_operativa_original' IS DISTINCT FROM left(turno,10) OR
  p_resumen->>'modalidad' NOT IN ('Delivery','Retiro','Consumo en local') OR
  (p_resumen->>'modalidad'='Delivery' AND delivery=0) OR
  (p_resumen->>'modalidad'<>'Delivery' AND delivery>0)
 THEN RAISE EXCEPTION 'Fecha operativa o entrega original incorrecta';
 END IF;
 SELECT * INTO current_state FROM public.romo_estado_operativo_v1
  WHERE store_id='romo:serena' FOR UPDATE;
 IF NOT FOUND OR current_state.revision<>p_expected_revision
 THEN RAISE EXCEPTION 'Revisión Neon cambió: consultar antes de repetir'; END IF;
 SELECT * INTO orig FROM public.romo_cierres_constancia_v1
  WHERE store_id='romo:serena' AND source_key=fuente FOR SHARE;
 IF NOT FOUND OR orig.turno_ref<>turno OR
  orig.resumen->>'fuente_unica'<>fuente OR
  (orig.resumen->>'venta_total')::bigint<>venta_orig OR
  (orig.resumen->>'fecha_cierre_ms')::bigint<>fecha_ms
 THEN RAISE EXCEPTION 'Constancia original no coincide'; END IF;
 -- No mezclar en el mismo cierre la otra rama de corrección monetaria v2.
 IF to_regclass('public.romo_rectificaciones_cierre_v2') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.romo_rectificaciones_cierre_v2 '||
    'WHERE store_id=$1 AND fuente_original=$2)' INTO existe USING 'romo:serena',fuente;
  IF existe THEN RAISE EXCEPTION 'Este cierre tiene rectificación monetaria incompatible'; END IF;
 END IF;
 SELECT * INTO previous FROM public.romo_pedidos_olvidados_versiones_v1
  WHERE store_id='romo:serena' AND turno_ref=turno
  ORDER BY version DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  version_prev=previous.version;
  IF v<>version_prev+1 OR previa<>previous.fuente_unica OR
   venta_prev<>previous.version_venta_rectificada THEN
   RAISE EXCEPTION 'Versiones históricas no consecutivas';
  END IF;
  anterior_medios=previous.resumen->'medios_rectificados';
 ELSE
  IF v<>2 OR previa<>fuente OR venta_prev<>venta_orig
  THEN RAISE EXCEPTION 'No existe la versión anterior'; END IF;
  anterior_medios=orig.resumen->'medios';
 END IF;
 IF jsonb_typeof(anterior_medios)<>'object' OR
  anterior_medios IS DISTINCT FROM p_resumen->'medios_previos' OR
  jsonb_typeof(p_resumen->'medios_rectificados')<>'object'
 THEN RAISE EXCEPTION 'Medios históricos faltantes o incompatibles'; END IF;
 SELECT coalesce(sum((value)::bigint),0) INTO medio_original
  FROM jsonb_each_text(anterior_medios);
 IF medio_original<>venta_prev THEN
  RAISE EXCEPTION 'Los pagos previos no concilian'; END IF;
 IF local>0 THEN
  cifra=anterior_medios->>medio;
  IF cifra IS NULL THEN cifra='0'; END IF;
  IF cifra !~ '^[0-9]{1,10}$' THEN
   RAISE EXCEPTION 'Medio original no numérico'; END IF;
  nuevo_medios=jsonb_set(anterior_medios,ARRAY[medio],
   to_jsonb(cifra::bigint+local),true);
 ELSE nuevo_medios=anterior_medios; END IF;
 IF p_resumen->'medios_rectificados' IS DISTINCT FROM nuevo_medios THEN
  RAISE EXCEPTION 'Se modificaron medios diferentes al cobro histórico'; END IF;
 IF EXISTS(SELECT 1 FROM public.romo_pedidos_olvidados_versiones_v1
  WHERE store_id='romo:serena' AND (
   (turno_ref=turno AND solicitud_id=(p_resumen->>'solicitud_id')::bigint) OR
   clave_olvido=p_resumen->>'clave_olvido'))
 THEN RAISE EXCEPTION 'El pedido omitido ya fue confirmado'; END IF;
 -- Una sola operación SQL: con bloqueo CAS, recibo y nuevo sobre cifrado.
 UPDATE public.romo_estado_operativo_v1
  SET revision=revision+1,snapshot=p_snapshot,
   actualizado_por=p_uid,actualizado_en=now()
  WHERE store_id='romo:serena' RETURNING revision INTO revision_nueva;
 INSERT INTO public.romo_pedidos_olvidados_versiones_v1(
  store_id,fuente_original,fuente_previa,fuente_unica,turno_ref,
  version,solicitud_id,clave_olvido,fecha_operativa_original,
  monto_productos,monto_delivery,total_pedido,cobro_local,cobro_externo,
  reparto_pendiente,version_venta_anterior,version_venta_rectificada,
  revision_original,revision_neon,sha_original,sha_previa,sha_snapshot,
  resumen,creado_por_uid
 ) VALUES (
  'romo:serena',fuente,previa,fuente||'|v'||v,turno,v,
  (p_resumen->>'solicitud_id')::bigint,p_resumen->>'clave_olvido',
  left(turno,10)::date,productos,delivery,total,local,externo,reparto,
  venta_prev,venta_nueva,orig.revision_neon,revision_nueva,
  orig.snapshot_sha256,
  CASE WHEN previous.version IS NULL THEN orig.snapshot_sha256
       ELSE previous.sha_snapshot END,
  p_sha256,p_resumen,p_uid);
 RETURN jsonb_build_object('confirmado',true,'storeId','romo:serena',
  'fuenteOriginal',fuente,'fuenteVersion',fuente||'|v'||v,
  'version',v,'solicitudId',(p_resumen->>'solicitud_id')::bigint,
  'revision',revision_nueva,'ventaAnterior',venta_prev,
  'ventaRectificada',venta_nueva,'cobroLocal',local,'cobroExterno',externo);
END;
$$;

REVOKE ALL ON TABLE public.romo_pedidos_olvidados_versiones_v1 FROM PUBLIC;
REVOKE ALL ON TABLE public.romo_pedidos_olvidados_versiones_v1 FROM romos_app_service;
GRANT SELECT ON TABLE public.romo_pedidos_olvidados_versiones_v1 TO romos_app_service;
REVOKE ALL ON FUNCTION public.romo_confirmar_pedido_olvidado_versionado_v1(
 bigint,jsonb,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.romo_confirmar_pedido_olvidado_versionado_v1(
 bigint,jsonb,text,jsonb,text) TO romos_app_service;
COMMIT;
