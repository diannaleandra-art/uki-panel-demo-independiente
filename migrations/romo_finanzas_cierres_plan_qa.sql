-- PLAN QA NO EJECUTADO. Aplicar primero en rama privada de finanzas con
-- aprobación separada y pruebas. NO instalar en base de Uki productivo.
-- Registro de cierres Romo exclusivo; no interviene fin_uki_cierres_live_v1
-- ni fin_movimientos. Una fila por turno protege contra doble venta.
CREATE TABLE IF NOT EXISTS public.fin_romo_cierres_live_v1 (
 store_id text NOT NULL CHECK (store_id='romo:serena'),
 source_key text PRIMARY KEY,
 turno_ref text NOT NULL,
 fecha_operativa date NOT NULL,
 fecha_cierre_ms bigint NOT NULL CHECK (fecha_cierre_ms>1700000000000),
 revision_neon bigint NOT NULL CHECK (revision_neon>=1),
 venta_total bigint NOT NULL CHECK (venta_total BETWEEN 0 AND 1000000000),
 pedidos integer NOT NULL CHECK (pedidos BETWEEN 0 AND 10000),
 medios jsonb NOT NULL CHECK (jsonb_typeof(medios)='object'),
 gastos_cierre bigint NOT NULL CHECK (gastos_cierre BETWEEN 0 AND 1000000000),
 delivery_por_pagar bigint NOT NULL CHECK (delivery_por_pagar BETWEEN 0 AND 1000000000),
 propinas bigint NOT NULL CHECK (propinas BETWEEN 0 AND 1000000000),
 retiros bigint NOT NULL CHECK (retiros BETWEEN 0 AND 1000000000),
 caja_chica_inicial bigint NOT NULL CHECK (caja_chica_inicial BETWEEN 0 AND 1000000000),
 caja_chica_gastos bigint NOT NULL CHECK (caja_chica_gastos BETWEEN 0 AND 1000000000),
 efectivo_contado bigint NOT NULL CHECK (efectivo_contado BETWEEN 0 AND 1000000000),
 diferencia_efectivo bigint NOT NULL CHECK (diferencia_efectivo BETWEEN -1000000000 AND 1000000000),
 recibido_de_uid text NOT NULL,
 creado_en timestamptz NOT NULL DEFAULT now(),
 actualizado_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE (store_id,turno_ref)
);
