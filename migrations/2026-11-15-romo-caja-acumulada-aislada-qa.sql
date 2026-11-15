-- 2026-11-15 · Romo La Serena · caja acumulada propia (preparación).
-- ÚNICAMENTE base existente romos_sushi, nunca sobre la BD de Uki.
-- Migración aditiva, NO ejecutar en producción sin autorización.
-- El saldo inicial requiere conteo físico real; NO migrar cifras de cierres.
BEGIN;
DO $$
BEGIN
 IF current_database()<>'romos_sushi' THEN
  RAISE EXCEPTION 'Esta migración es EXCLUSIVA de romos_sushi';
 END IF;
 IF to_regclass('public.romo_cierres_constancia_v1') IS NULL THEN
  RAISE EXCEPTION 'Primero habilita las constancias definitivas existentes de Romo';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.romo_caja_acum_cuenta_v1 (
 store_id text PRIMARY KEY CHECK (store_id='romo:serena'),
 balance bigint NOT NULL DEFAULT 0 CHECK (balance BETWEEN 0 AND 1000000000),
 initialized boolean NOT NULL DEFAULT false,
 initialized_at timestamptz,
 initialized_by text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (initialized OR (balance=0 AND initialized_at IS NULL))
);
CREATE TABLE IF NOT EXISTS public.romo_caja_acum_movimientos_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id text NOT NULL REFERENCES public.romo_caja_acum_cuenta_v1(store_id),
 op_key uuid NOT NULL,
 tipo text NOT NULL CHECK (tipo IN ('apertura','entrada','gasto','retiro','cierre')),
 monto bigint NOT NULL CHECK (monto BETWEEN -100000000 AND 100000000),
 saldo_resultante bigint NOT NULL CHECK (saldo_resultante BETWEEN 0 AND 1000000000),
 concepto text NOT NULL CHECK (length(btrim(concepto)) BETWEEN 3 AND 240),
 actor_uid text NOT NULL CHECK (length(actor_uid) BETWEEN 1 AND 150),
 responsable text NOT NULL CHECK (length(btrim(responsable)) BETWEEN 2 AND 80),
 source_key text,
 creado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE (store_id,op_key),
 CHECK ((tipo='cierre')=(source_key IS NOT NULL)),
 CHECK (source_key IS NULL OR source_key ~ '^romo:serena\|[0-9]{4}-[0-9]{2}-[0-9]{2}@[1-9][0-9]{12,14}$')
);
CREATE INDEX IF NOT EXISTS romo_caja_acum_historial_v1
 ON public.romo_caja_acum_movimientos_v1(store_id,creado_en DESC);
CREATE TABLE IF NOT EXISTS public.romo_caja_acum_cierres_v1 (
 store_id text NOT NULL REFERENCES public.romo_caja_acum_cuenta_v1(store_id),
 source_key text NOT NULL,
 fecha_operativa text NOT NULL CHECK (fecha_operativa ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
 monto_acreditado bigint NOT NULL CHECK (monto_acreditado BETWEEN 0 AND 100000000),
 constancia_revision bigint NOT NULL CHECK (constancia_revision>=1),
 movimiento_id uuid NOT NULL REFERENCES public.romo_caja_acum_movimientos_v1(id),
 PRIMARY KEY(store_id,source_key)
);

CREATE OR REPLACE FUNCTION public.romo_caja_acum_aplicar_v1(
 p_action text,p_amount bigint,p_op_key uuid,p_actor_uid text,
 p_responsable text,p_concept text,p_source_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 a public.romo_caja_acum_cuenta_v1%ROWTYPE;
 prev public.romo_caja_acum_movimientos_v1%ROWTYPE;
 closed public.romo_caja_acum_cierres_v1%ROWTYPE;
 receipt public.romo_cierres_constancia_v1%ROWTYPE;
 mov public.romo_caja_acum_movimientos_v1%ROWTYPE;
 delta bigint;next_balance bigint;typ text;actual_amount bigint;
 ms bigint;
BEGIN
 IF p_action NOT IN ('inicializar','entrada','gasto','retiro','sincronizar_cierre') OR
    p_op_key IS NULL OR
    coalesce(length(btrim(p_actor_uid)),0) NOT BETWEEN 1 AND 150 OR
    coalesce(length(btrim(p_responsable)),0) NOT BETWEEN 2 AND 80 OR
    coalesce(length(btrim(p_concept)),0) NOT BETWEEN 3 AND 240 THEN
  RAISE EXCEPTION 'Solicitud de caja acumulada inválida';
 END IF;
 IF p_action='sincronizar_cierre' THEN
  IF p_amount IS NOT NULL OR
    p_source_key IS NULL OR
    p_source_key !~ '^romo:serena\|[0-9]{4}-[0-9]{2}-[0-9]{2}@[1-9][0-9]{12,14}$'
  THEN RAISE EXCEPTION 'Falta referencia de cierre único'; END IF;
 ELSE
  IF p_source_key IS NOT NULL OR p_amount IS NULL OR
     p_amount<CASE WHEN p_action='inicializar' THEN 0 ELSE 1 END OR
     p_amount>100000000
  THEN RAISE EXCEPTION 'Importe o referencia inválidos'; END IF;
 END IF;

 INSERT INTO public.romo_caja_acum_cuenta_v1(store_id)
 VALUES('romo:serena') ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.romo_caja_acum_cuenta_v1
 WHERE store_id='romo:serena' FOR UPDATE;
 SELECT * INTO prev FROM public.romo_caja_acum_movimientos_v1
 WHERE store_id='romo:serena' AND op_key=p_op_key;
 IF FOUND THEN
  IF prev.tipo<>CASE p_action WHEN 'inicializar' THEN 'apertura'
      WHEN 'sincronizar_cierre' THEN 'cierre' ELSE p_action END
    OR prev.source_key IS DISTINCT FROM p_source_key
    OR (p_action<>'sincronizar_cierre' AND abs(prev.monto)<>p_amount)
    OR prev.responsable<>btrim(p_responsable) OR
    prev.actor_uid<>btrim(p_actor_uid) OR
    prev.concepto<>btrim(p_concept)
  THEN RAISE EXCEPTION 'Clave idempotente reutilizada con otros datos'; END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',true,
     'balance',a.balance,'initialized',a.initialized,'movimiento',prev.id);
 END IF;
 IF p_action='inicializar' THEN
  IF a.initialized THEN RAISE EXCEPTION 'Saldo físico inicial ya registrado'; END IF;
  delta=p_amount;typ='apertura';
 ELSIF p_action='sincronizar_cierre' THEN
  IF NOT a.initialized OR a.initialized_at IS NULL THEN
   RAISE EXCEPTION 'Primero registrar el saldo físico contado'; END IF;
  SELECT * INTO closed FROM public.romo_caja_acum_cierres_v1
  WHERE store_id='romo:serena' AND source_key=p_source_key;
  IF FOUND THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,
    'balance',a.balance,'initialized',true,'source_key',p_source_key);
  END IF;
  -- La cantidad procede de la CONSTANCIA REAL en Neon, NO del navegador.
  SELECT * INTO receipt FROM public.romo_cierres_constancia_v1
   WHERE store_id='romo:serena' AND source_key=p_source_key
   FOR SHARE;
  IF NOT FOUND OR receipt.turno_ref IS NULL OR
     p_source_key<>'romo:serena|'||receipt.turno_ref OR
     coalesce(receipt.resumen->>'turno_ref','')<>receipt.turno_ref OR
     coalesce(receipt.resumen->>'fecha_operativa','')<>receipt.fecha_operativa::text OR
     coalesce(receipt.resumen->>'fuente_unica','')<>p_source_key OR
     coalesce(receipt.resumen->>'estado','')<>'pendiente_confirmacion_neon' OR
     receipt.revision_neon IS NULL OR receipt.revision_neon<1
  THEN RAISE EXCEPTION 'Constancia Romo no verificable'; END IF;
  IF jsonb_typeof(receipt.resumen->'efectivo_contado')<>'number' OR
     jsonb_typeof(receipt.resumen->'diferencia_efectivo')<>'number' OR
     jsonb_typeof(receipt.resumen->'fecha_cierre_ms')<>'number'
  THEN RAISE EXCEPTION 'Constancia sin arqueo válido'; END IF;
  actual_amount=(receipt.resumen->>'efectivo_contado')::bigint;
  ms=(receipt.resumen->>'fecha_cierre_ms')::bigint;
  IF (receipt.resumen->>'diferencia_efectivo')::bigint<>0 OR
     actual_amount<0 OR actual_amount>100000000 OR
     ms<=0 OR to_timestamp(ms/1000.0)<=a.initialized_at OR
     to_timestamp(ms/1000.0)>now()+interval '20 minutes'
  THEN RAISE EXCEPTION 'Cierre sin arqueo exacto posterior al saldo inicial'; END IF;
  delta=actual_amount;typ='cierre';
 ELSE
  IF NOT a.initialized THEN
   RAISE EXCEPTION 'Primero registrar saldo físico inicial'; END IF;
  delta=CASE WHEN p_action IN ('gasto','retiro') THEN -p_amount
    ELSE p_amount END;
  typ=p_action;
 END IF;

 next_balance=a.balance+delta;
 IF next_balance<0 OR next_balance>1000000000 THEN
  RAISE EXCEPTION 'Saldo insuficiente o importe fuera de rango'; END IF;
 UPDATE public.romo_caja_acum_cuenta_v1 SET
   balance=next_balance,initialized=true,
   initialized_at=CASE WHEN p_action='inicializar' THEN now()
     ELSE a.initialized_at END,
   initialized_by=CASE WHEN p_action='inicializar' THEN p_actor_uid
     ELSE a.initialized_by END,
   updated_at=now()
 WHERE store_id='romo:serena';
 INSERT INTO public.romo_caja_acum_movimientos_v1
 (store_id,op_key,tipo,monto,saldo_resultante,concepto,actor_uid,
  responsable,source_key)
 VALUES('romo:serena',p_op_key,typ,delta,next_balance,
  btrim(p_concept),btrim(p_actor_uid),btrim(p_responsable),p_source_key)
 RETURNING * INTO mov;
 IF p_action='sincronizar_cierre' THEN
  INSERT INTO public.romo_caja_acum_cierres_v1
   (store_id,source_key,fecha_operativa,monto_acreditado,
    constancia_revision,movimiento_id)
  VALUES('romo:serena',p_source_key,receipt.fecha_operativa::text,
     actual_amount,receipt.revision_neon,mov.id);
 END IF;
 RETURN jsonb_build_object('ok',true,'duplicate',false,
  'balance',next_balance,'initialized',true,'movimiento',mov.id,
  'source_key',p_source_key,'importe',delta);
END $$;

-- El actor debe proceder SIEMPRE del token Google verificado en la API.
-- Conceder lectura/ejecución al servicio, NUNCA escritura SQL directa.
REVOKE ALL ON TABLE public.romo_caja_acum_cuenta_v1,
 public.romo_caja_acum_movimientos_v1,public.romo_caja_acum_cierres_v1
 FROM PUBLIC;
REVOKE ALL ON FUNCTION public.romo_caja_acum_aplicar_v1(
 text,bigint,uuid,text,text,text,text) FROM PUBLIC;
GRANT SELECT ON TABLE public.romo_caja_acum_cuenta_v1,
 public.romo_caja_acum_movimientos_v1,public.romo_caja_acum_cierres_v1
 TO romos_app_service;
GRANT EXECUTE ON FUNCTION public.romo_caja_acum_aplicar_v1(
 text,bigint,uuid,text,text,text,text) TO romos_app_service;
COMMIT;
