-- ETAPA QA: resumen automático de Uki para dueños.
-- ADITIVO, solo ejecutar en la base QA privada existente. NUNCA en producción.
-- No altera fin_movimientos ni cierres, pagos, pedidos o inventario.
CREATE TABLE IF NOT EXISTS public.fin_uki_snapshots_qa (
  branch TEXT NOT NULL CHECK (branch IN ('arica','serena')),
  source_key TEXT NOT NULL CHECK (source_key ~ '^[a-f0-9]{64}$'),
  turno_ref TEXT NOT NULL CHECK (length(turno_ref) BETWEEN 3 AND 120),
  fecha_operativa DATE NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('abierto','cerrado')),
  revision BIGINT NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  venta_total BIGINT NOT NULL CHECK (venta_total BETWEEN 0 AND 1000000000),
  pedidos INTEGER NOT NULL CHECK (pedidos BETWEEN 0 AND 10000),
  medios JSONB NOT NULL CHECK (jsonb_typeof(medios)='object'),
  recibido_de_uid TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (branch,source_key)
);
CREATE INDEX IF NOT EXISTS fin_uki_snapshots_qa_fecha_idx
  ON public.fin_uki_snapshots_qa (fecha_operativa DESC,branch,estado);
COMMENT ON TABLE public.fin_uki_snapshots_qa IS
 'QA: Resúmenes operativos de ventas por turno, no conciliados, separados de fin_movimientos. Solo importación autorizada Google y lectura con PIN.';
