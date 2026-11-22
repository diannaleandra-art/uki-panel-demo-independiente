-- Función nueva: conserva las funciones anteriores y no modifica filas existentes.
CREATE OR REPLACE FUNCTION public.uki_caja_acum_sincronizar_contado_v2(p_branch text, p_close_key text, p_day text, p_amount bigint, p_close_ms bigint, p_op_key uuid, p_actor_uid text, p_responsable text, p_concepto text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 account public.uki_caja_acum_cuentas_live%ROWTYPE;
 last_close public.uki_caja_acum_cierres_live%ROWTYPE;
 result jsonb;
BEGIN
 IF p_branch NOT IN ('arica','serena') OR length(p_close_key) NOT BETWEEN 8 AND 150
    OR p_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR p_amount IS NULL OR
    p_amount<0 OR p_amount>100000000 OR p_close_ms IS NULL OR p_close_ms<=0 OR
    p_op_key IS NULL OR length(btrim(p_responsable)) NOT BETWEEN 2 AND 80
    OR coalesce(length(btrim(p_concepto)),0) NOT BETWEEN 3 AND 240
    OR p_close_key<>('uki|'||p_branch||'|'||p_close_ms::text)
 THEN RAISE EXCEPTION 'Identificación del cierre inválida'; END IF;
 PERFORM 1 FROM public.uki_caja_acum_cuentas_live WHERE branch=p_branch FOR UPDATE;
 SELECT * INTO account FROM public.uki_caja_acum_cuentas_live WHERE branch=p_branch;
 IF NOT FOUND OR NOT account.initialized OR account.initialized_at IS NULL
 THEN RAISE EXCEPTION 'Primero concilia y registra saldo inicial'; END IF;
 IF to_timestamp(p_close_ms/1000.0)<=account.initialized_at
 THEN RAISE EXCEPTION 'Cierre anterior al saldo inicial: ya incluido en la conciliación'; END IF;
 IF to_timestamp(p_close_ms/1000.0)>now()+interval '20 minutes'
 THEN RAISE EXCEPTION 'Fecha de cierre futura; revisa el reloj del equipo'; END IF;
 SELECT * INTO last_close FROM public.uki_caja_acum_cierres_live
 WHERE branch=p_branch AND cierre_clave=p_close_key FOR UPDATE;
 IF FOUND AND last_close.fecha_operativa<>p_day
 THEN RAISE EXCEPTION 'La fecha operativa no coincide con el cierre existente'; END IF;
 IF FOUND AND last_close.monto_actual=p_amount
 THEN RETURN jsonb_build_object('ok',true,'duplicate',true,'branch',p_branch,
      'saldo',account.balance,'importe',0,'cierre_clave',p_close_key); END IF;
 SELECT public.uki_caja_acum_aplicar_live(p_branch,
   CASE WHEN FOUND THEN 'ajustar_cierre' ELSE 'cierre' END,
   p_amount,p_op_key,p_actor_uid,p_concepto,p_day,p_close_key,NULL,p_responsable)
 INTO result;
 RETURN result||jsonb_build_object('cierre_clave',p_close_key);
END $function$;
