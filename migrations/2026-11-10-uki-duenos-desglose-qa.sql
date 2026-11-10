-- Solo rama Neon QA (uki-mesas-qa-2026-11-03).
-- No ejecutar en production ni alterar movimientos, pedidos o cierres existentes.
ALTER TABLE public.fin_uki_snapshots_qa
  ADD COLUMN IF NOT EXISTS gastos_cierre bigint NOT NULL DEFAULT 0
    CHECK (gastos_cierre BETWEEN 0 AND 1000000000),
  ADD COLUMN IF NOT EXISTS delivery_por_pagar bigint NOT NULL DEFAULT 0
    CHECK (delivery_por_pagar BETWEEN 0 AND 1000000000),
  ADD COLUMN IF NOT EXISTS propinas bigint NOT NULL DEFAULT 0
    CHECK (propinas BETWEEN 0 AND 1000000000),
  ADD COLUMN IF NOT EXISTS retiros bigint NOT NULL DEFAULT 0
    CHECK (retiros BETWEEN 0 AND 1000000000);
