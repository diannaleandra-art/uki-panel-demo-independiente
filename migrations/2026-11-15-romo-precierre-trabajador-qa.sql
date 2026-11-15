-- 2026-11-15 Romo La Serena: recepcion de precierre por PIN SEPARADO de inventario.
-- Instalacion aditiva, no cierra turnos ni altera ventas.
BEGIN;
DO $$
BEGIN
 IF current_database()<>'romos_sushi' OR
    to_regclass('public.romo_estado_operativo_v1') IS NULL OR
    to_regclass('public.romo_pin_inventario_v1') IS NULL THEN
  RAISE EXCEPTION 'Solo se permite instalar en la base Romo existente';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.romo_precierre_pin_v1 (
 store_id text PRIMARY KEY CHECK(store_id='romo:serena'),
 salt text NOT NULL CHECK(salt ~ '^[a-f0-9]{32}$'),
 hash text NOT NULL CHECK(hash ~ '^[a-f0-9]{64}$'),
 creado_por text NOT NULL CHECK(length(creado_por) BETWEEN 1 AND 128),
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.romo_precierre_envios_v1 (
 id uuid PRIMARY KEY,
 store_id text NOT NULL DEFAULT 'romo:serena' CHECK(store_id='romo:serena'),
 turno_ref text NOT NULL CHECK(turno_ref ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}@[1-9][0-9]{12,14}$'),
 fecha_operativa text NOT NULL CHECK(fecha_operativa ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
 inicio_ms bigint NOT NULL CHECK(inicio_ms BETWEEN 1500000000000 AND 99999999999999),
 trabajador text NOT NULL CHECK(length(btrim(trabajador)) BETWEEN 2 AND 60),
 efectivo_contado bigint NOT NULL CHECK(efectivo_contado BETWEEN 0 AND 100000000),
 observaciones text NOT NULL DEFAULT '' CHECK(length(observaciones)<=300),
 estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','conciliado')),
 recibido_en timestamptz NOT NULL DEFAULT now(),
 identidad_hash text NOT NULL CHECK(identidad_hash ~ '^[a-f0-9]{64}$'),
 conciliado_por text,
 revision_conciliada bigint,
 conciliado_en timestamptz,
 UNIQUE(store_id,turno_ref),
 CHECK(turno_ref=fecha_operativa||'@'||inicio_ms::text),
 CHECK((estado='pendiente' AND conciliado_en IS NULL AND conciliado_por IS NULL AND revision_conciliada IS NULL)
    OR (estado='conciliado' AND conciliado_en IS NOT NULL
       AND conciliado_por IS NOT NULL AND revision_conciliada>=1))
);
CREATE INDEX IF NOT EXISTS romo_precierre_envios_hist_v1
 ON public.romo_precierre_envios_v1(store_id,recibido_en DESC);

-- Neon puede asignar grants por defecto: bloquear todas las escrituras directas
-- de las cuentas usadas por la aplicación. Solo función controlada de recepción.
REVOKE ALL ON TABLE public.romo_precierre_pin_v1,
 public.romo_precierre_envios_v1 FROM PUBLIC,romos_app_service,romos_clave_alta_qa_20261114;
GRANT SELECT ON TABLE public.romo_precierre_pin_v1,
 public.romo_precierre_envios_v1 TO romos_app_service;

CREATE OR REPLACE FUNCTION public.romo_precierre_enviar_v1(
 p_id uuid,p_turno_ref text,p_fecha_operativa text,p_inicio_ms bigint,
 p_trabajador text,p_efectivo bigint,p_obs text,p_identidad_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prev public.romo_precierre_envios_v1%ROWTYPE; id_guardado uuid;
BEGIN
 IF current_database()<>'romos_sushi' OR p_id IS NULL OR
    p_fecha_operativa IS NULL OR p_fecha_operativa !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR
    to_char(to_date(p_fecha_operativa,'YYYY-MM-DD'),'YYYY-MM-DD')<>p_fecha_operativa OR
    p_inicio_ms IS NULL OR p_inicio_ms<1500000000000 OR p_inicio_ms>99999999999999 OR
    p_turno_ref IS NULL OR p_turno_ref<>p_fecha_operativa||'@'||p_inicio_ms::text OR
    coalesce(length(btrim(p_trabajador)),0) NOT BETWEEN 2 AND 60 OR
    p_efectivo IS NULL OR p_efectivo<0 OR p_efectivo>100000000 OR
    p_obs IS NULL OR length(p_obs)>300 OR
    p_identidad_hash IS NULL OR p_identidad_hash !~ '^[a-f0-9]{64}$' OR
    to_timestamp(p_inicio_ms/1000.0)>now()+interval '5 minutes' OR
    to_timestamp(p_inicio_ms/1000.0)<now()-interval '36 hours' THEN
  RAISE EXCEPTION 'Precierre enviado fuera de alcance o con datos inválidos';
 END IF;
 INSERT INTO public.romo_precierre_envios_v1(
  id,store_id,turno_ref,fecha_operativa,inicio_ms,
  trabajador,efectivo_contado,observaciones,identidad_hash)
 VALUES(p_id,'romo:serena',p_turno_ref,p_fecha_operativa,p_inicio_ms,
  btrim(p_trabajador),p_efectivo,p_obs,p_identidad_hash)
 ON CONFLICT(store_id,turno_ref) DO NOTHING RETURNING id INTO id_guardado;
 IF id_guardado IS NOT NULL THEN
  RETURN jsonb_build_object('ok',true,'duplicate',false,'id',id_guardado,
   'estado','pendiente');
 END IF;
 SELECT * INTO prev FROM public.romo_precierre_envios_v1
 WHERE store_id='romo:serena' AND turno_ref=p_turno_ref;
 IF prev.id=p_id AND prev.efectivo_contado=p_efectivo AND
    prev.trabajador=btrim(p_trabajador) AND prev.observaciones=p_obs AND
    prev.identidad_hash=p_identidad_hash THEN
  RETURN jsonb_build_object('ok',true,'duplicate',true,'id',prev.id,
   'estado',prev.estado);
 END IF;
 RAISE EXCEPTION 'Ya existe un conteo para este turno; pide revisión al dueño';
END; $$;

REVOKE ALL ON FUNCTION public.romo_precierre_enviar_v1(
 uuid,text,text,bigint,text,bigint,text,text) FROM PUBLIC,romos_clave_alta_qa_20261114;
GRANT EXECUTE ON FUNCTION public.romo_precierre_enviar_v1(
 uuid,text,text,bigint,text,bigint,text,text) TO romos_app_service;

-- El PIN solo se configura una vez desde Google duenos.
-- La API de dueños puede crear PIN y conciliar el envío tras CAS, sin
-- conceder DML directo al rol de servicio. Se usan procedimientos cerrados.
CREATE OR REPLACE FUNCTION public.romo_precierre_crear_pin_v1(
 p_salt text,p_hash text,p_uid text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE creado text;
BEGIN
 IF current_database()<>'romos_sushi' OR p_salt !~ '^[a-f0-9]{32}$' OR
    p_hash !~ '^[a-f0-9]{64}$' OR
    length(p_uid) NOT BETWEEN 1 AND 128 THEN
  RAISE EXCEPTION 'Configuración de PIN no válida';
 END IF;
 INSERT INTO public.romo_precierre_pin_v1(store_id,salt,hash,creado_por)
 VALUES('romo:serena',p_salt,p_hash,p_uid)
 ON CONFLICT(store_id) DO NOTHING RETURNING store_id INTO creado;
 RETURN creado='romo:serena';
END; $$;
CREATE OR REPLACE FUNCTION public.romo_precierre_conciliar_v1(
 p_id uuid,p_turno_ref text,p_revision bigint,p_uid text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE marcado uuid;
BEGIN
 IF current_database()<>'romos_sushi' OR p_id IS NULL OR
    p_turno_ref IS NULL OR p_revision IS NULL OR p_revision<1 OR
    coalesce(length(p_uid),0) NOT BETWEEN 1 AND 128 THEN
  RAISE EXCEPTION 'Confirmación de precierre no válida';
 END IF;
 UPDATE public.romo_precierre_envios_v1 SET estado='conciliado',
  revision_conciliada=p_revision,conciliado_por=p_uid,conciliado_en=now()
 WHERE id=p_id AND store_id='romo:serena' AND turno_ref=p_turno_ref
  AND estado='pendiente'
  AND EXISTS(SELECT 1 FROM public.romo_estado_operativo_v1
   WHERE store_id='romo:serena' AND revision>=p_revision)
 RETURNING id INTO marcado;
 IF marcado IS NOT NULL THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.romo_precierre_envios_v1
  WHERE id=p_id AND store_id='romo:serena' AND turno_ref=p_turno_ref
   AND estado='conciliado' AND conciliado_por=p_uid);
END; $$;
REVOKE ALL ON FUNCTION public.romo_precierre_crear_pin_v1(text,text,text),
 public.romo_precierre_conciliar_v1(uuid,text,bigint,text)
 FROM PUBLIC,romos_clave_alta_qa_20261114;
GRANT EXECUTE ON FUNCTION public.romo_precierre_crear_pin_v1(text,text,text),
 public.romo_precierre_conciliar_v1(uuid,text,bigint,text)
 TO romos_app_service;
COMMIT;
