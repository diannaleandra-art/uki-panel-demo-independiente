-- Uki Sushi · Caja acumulada EN EFECTIVO · SOLO BASE QA
-- No ejecutar en producción. Se requiere reconciliar saldo inicial físico.
-- En producción se preparará una migración separada después de aprobación QA.
CREATE TABLE IF NOT EXISTS public.uki_caja_acum_cuentas_qa (
  branch text PRIMARY KEY CHECK (branch IN ('arica','serena')),
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  initialized boolean NOT NULL DEFAULT false,
  initialized_at timestamptz,
  initialized_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.uki_caja_acum_movimientos_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL REFERENCES public.uki_caja_acum_cuentas_qa(branch),
  op_key uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('apertura','cierre','ajuste_cierre','entrada','gasto','retiro','traspaso_salida','traspaso_entrada')),
  monto bigint NOT NULL CHECK (monto BETWEEN -100000000 AND 100000000),
  saldo_resultante bigint NOT NULL CHECK (saldo_resultante >= 0),
  concepto text NOT NULL CHECK (length(btrim(concepto)) BETWEEN 3 AND 240),
  actor_uid text NOT NULL CHECK (length(actor_uid) BETWEEN 1 AND 150),
  fecha_operativa text,
  cierre_clave text,
  sucursal_destino text CHECK (sucursal_destino IS NULL OR sucursal_destino IN ('arica','serena')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch,op_key),
  CHECK (fecha_operativa IS NULL OR fecha_operativa ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);
CREATE INDEX IF NOT EXISTS uki_caja_acum_mov_qa_historial
 ON public.uki_caja_acum_movimientos_qa(branch,creado_en DESC);
CREATE TABLE IF NOT EXISTS public.uki_caja_acum_cierres_qa (
  branch text NOT NULL REFERENCES public.uki_caja_acum_cuentas_qa(branch),
  cierre_clave text NOT NULL CHECK (length(cierre_clave) BETWEEN 8 AND 150),
  fecha_operativa text NOT NULL CHECK (fecha_operativa ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  monto_actual bigint NOT NULL CHECK (monto_actual BETWEEN 0 AND 100000000),
  ultimo_movimiento uuid REFERENCES public.uki_caja_acum_movimientos_qa(id),
  PRIMARY KEY (branch,cierre_clave)
);
-- Todo se ejecuta dentro de UN solo statement SQL, con bloqueo FOR UPDATE.
-- Así ningún doble clic ni dos retiros concurrentes pueden gastar el mismo efectivo.
CREATE OR REPLACE FUNCTION public.uki_caja_acum_aplicar_qa(
  p_branch text, p_action text, p_amount bigint, p_op_key uuid,
  p_actor_uid text, p_concept text, p_day text DEFAULT NULL,
  p_close_key text DEFAULT NULL, p_dest text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql
SET search_path=public,pg_temp AS $$
DECLARE
  a public.uki_caja_acum_cuentas_qa%ROWTYPE;
  b public.uki_caja_acum_cuentas_qa%ROWTYPE;
  prior public.uki_caja_acum_movimientos_qa%ROWTYPE;
  mov public.uki_caja_acum_movimientos_qa%ROWTYPE;
  close_row public.uki_caja_acum_cierres_qa%ROWTYPE;
  delta bigint; newbalance bigint; in_amount bigint;
  chosen_type text; old_amount bigint;
BEGIN
  IF p_branch NOT IN ('arica','serena') OR p_action NOT IN
    ('inicializar','cierre','ajustar_cierre','entrada','gasto','retiro','traspaso') OR
    p_op_key IS NULL OR coalesce(length(p_actor_uid),0) NOT BETWEEN 1 AND 150 OR
    coalesce(length(btrim(p_concept)),0) NOT BETWEEN 3 AND 240 OR
    p_amount IS NULL OR p_amount < 0 OR p_amount > 100000000 THEN
    RAISE EXCEPTION 'Solicitud de efectivo inválida';
  END IF;
  IF p_day IS NOT NULL AND
     (p_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR to_char(to_date(p_day,'YYYY-MM-DD'),'YYYY-MM-DD')<>p_day)
     THEN RAISE EXCEPTION 'Fecha operativa inválida'; END IF;
  IF p_action IN ('cierre','ajustar_cierre') AND
    (coalesce(length(p_close_key),0) NOT BETWEEN 8 AND 150 OR p_day IS NULL)
    THEN RAISE EXCEPTION 'Cierre sin identificación o día'; END IF;
  IF p_action='traspaso' AND
    (p_dest NOT IN ('arica','serena') OR p_dest=p_branch OR p_amount=0)
    THEN RAISE EXCEPTION 'Traspaso inválido'; END IF;
  IF p_action NOT IN ('inicializar','cierre','ajustar_cierre') AND p_amount=0
    THEN RAISE EXCEPTION 'Importe debe ser mayor que cero'; END IF;
  IF p_action='traspaso' THEN
    INSERT INTO public.uki_caja_acum_cuentas_qa(branch)
    VALUES ('arica'),('serena') ON CONFLICT DO NOTHING;
    -- Bloqueos siempre en orden fijo para evitar deadlocks entre sucursales.
    PERFORM 1 FROM public.uki_caja_acum_cuentas_qa
      WHERE branch IN ('arica','serena') ORDER BY branch FOR UPDATE;
  ELSE
    INSERT INTO public.uki_caja_acum_cuentas_qa(branch) VALUES (p_branch)
    ON CONFLICT DO NOTHING;
    PERFORM 1 FROM public.uki_caja_acum_cuentas_qa WHERE branch=p_branch FOR UPDATE;
  END IF;
  SELECT * INTO a FROM public.uki_caja_acum_cuentas_qa WHERE branch=p_branch;
  IF p_action='traspaso' THEN
    SELECT * INTO b FROM public.uki_caja_acum_cuentas_qa WHERE branch=p_dest;
  END IF;
  -- No repetir movimientos: el mismo op_key retorna el efecto original.
  SELECT * INTO prior FROM public.uki_caja_acum_movimientos_qa
    WHERE branch=p_branch AND op_key=p_op_key;
  IF FOUND THEN
    IF (p_action='traspaso' AND (prior.tipo<>'traspaso_salida' OR prior.monto<>-p_amount OR prior.sucursal_destino<>p_dest))
      OR (p_action<>'traspaso' AND
        (prior.tipo<>CASE p_action WHEN 'inicializar' THEN 'apertura' WHEN 'ajustar_cierre' THEN 'ajuste_cierre' ELSE p_action END
         OR (p_action NOT IN ('ajustar_cierre') AND abs(prior.monto)<>p_amount)))
      OR (p_action IN ('cierre','ajustar_cierre') AND prior.cierre_clave IS DISTINCT FROM p_close_key)
      THEN RAISE EXCEPTION 'La clave de operación ya se utilizó para otra acción'; END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'branch',p_branch,'saldo',a.balance,
      'movimiento',prior.id,'importe',prior.monto);
  END IF;
  IF p_action='inicializar' THEN
    IF a.initialized THEN RAISE EXCEPTION 'La caja ya fue inicializada. Nunca repetir saldo inicial'; END IF;
    UPDATE public.uki_caja_acum_cuentas_qa SET
      balance=p_amount,initialized=true,initialized_at=now(),
      initialized_by=p_actor_uid,updated_at=now() WHERE branch=p_branch;
    delta=p_amount;chosen_type='apertura';
  ELSE
    IF NOT a.initialized THEN RAISE EXCEPTION 'Cuenta sin saldo inicial reconciliado'; END IF;
    IF p_action='traspaso' AND NOT b.initialized THEN
      RAISE EXCEPTION 'La sucursal de destino aún no tiene saldo inicial'; END IF;
    IF p_action='cierre' THEN
      SELECT * INTO close_row FROM public.uki_caja_acum_cierres_qa
        WHERE branch=p_branch AND cierre_clave=p_close_key FOR UPDATE;
      IF FOUND THEN RAISE EXCEPTION 'Cierre ya registrado; revisa antes de corregir'; END IF;
      delta=p_amount;chosen_type='cierre';
    ELSIF p_action='ajustar_cierre' THEN
      SELECT * INTO close_row FROM public.uki_caja_acum_cierres_qa
        WHERE branch=p_branch AND cierre_clave=p_close_key FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Este cierre aún no fue incorporado'; END IF;
      IF close_row.fecha_operativa<>p_day THEN
        RAISE EXCEPTION 'Día del cierre no coincide'; END IF;
      delta=p_amount-close_row.monto_actual;chosen_type='ajuste_cierre';
      IF delta=0 THEN RAISE EXCEPTION 'El cierre ya tiene ese importe'; END IF;
    ELSIF p_action IN ('retiro','gasto','traspaso') THEN
      delta=-p_amount;
      chosen_type=CASE p_action WHEN 'traspaso' THEN 'traspaso_salida' ELSE p_action END;
    ELSE
      delta=p_amount;chosen_type='entrada';
    END IF;
    IF a.balance+delta<0 THEN RAISE EXCEPTION 'Saldo insuficiente. No se puede usar efectivo que no existe'; END IF;
    UPDATE public.uki_caja_acum_cuentas_qa
       SET balance=balance+delta, updated_at=now() WHERE branch=p_branch;
  END IF;
  newbalance=a.balance+delta;
  INSERT INTO public.uki_caja_acum_movimientos_qa
    (branch,op_key,tipo,monto,saldo_resultante,concepto,actor_uid,fecha_operativa,cierre_clave,sucursal_destino)
  VALUES
    (p_branch,p_op_key,chosen_type,delta,newbalance,btrim(p_concept),p_actor_uid,p_day,p_close_key,p_dest)
  RETURNING * INTO mov;
  IF p_action='cierre' THEN
    INSERT INTO public.uki_caja_acum_cierres_qa
    (branch,cierre_clave,fecha_operativa,monto_actual,ultimo_movimiento)
    VALUES (p_branch,p_close_key,p_day,p_amount,mov.id);
  ELSIF p_action='ajustar_cierre' THEN
    UPDATE public.uki_caja_acum_cierres_qa
       SET monto_actual=p_amount,ultimo_movimiento=mov.id
      WHERE branch=p_branch AND cierre_clave=p_close_key;
  ELSIF p_action='traspaso' THEN
    UPDATE public.uki_caja_acum_cuentas_qa
       SET balance=balance+p_amount,updated_at=now() WHERE branch=p_dest;
    INSERT INTO public.uki_caja_acum_movimientos_qa
      (branch,op_key,tipo,monto,saldo_resultante,concepto,actor_uid,fecha_operativa,sucursal_destino)
    VALUES (p_dest,p_op_key,'traspaso_entrada',p_amount,b.balance+p_amount,
            btrim(p_concept),p_actor_uid,p_day,p_branch);
  END IF;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'branch',p_branch,'saldo',newbalance,
    'movimiento',mov.id,'importe',delta,
    'destino_saldo',CASE WHEN p_action='traspaso' THEN b.balance+p_amount ELSE NULL END);
END $$;