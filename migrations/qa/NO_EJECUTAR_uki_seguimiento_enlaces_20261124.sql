-- NO EJECUTAR EN PRODUCCION. Esquema propuesto para QA aislada de Uki.
-- Uki Regimiento Arica y Uki La Serena comparten DB pero NO datos de seguimiento.
-- Nunca ejecutar en la base comercial sin respaldo y revision de permisos.
BEGIN;
CREATE TABLE IF NOT EXISTS public.uki_seguimiento_enlaces_qa_v1 (
 solicitud_id uuid PRIMARY KEY REFERENCES public.uki_carta_solicitudes_live(id) ON DELETE CASCADE,
 store_id text NOT NULL CHECK (store_id IN ('uki:arica','uki:serena')),
 branch text NOT NULL CHECK (branch IN ('arica','serena')),
 token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 emitido_en timestamptz NOT NULL DEFAULT now(),
 vence_en timestamptz NOT NULL,
 estado text NOT NULL DEFAULT 'active' CHECK (estado IN ('active','revoked')),
 revocado_en timestamptz,
 CHECK ((store_id='uki:arica' AND branch='arica') OR
        (store_id='uki:serena' AND branch='serena')),
 CHECK (vence_en > emitido_en AND vence_en <= emitido_en + interval '7 days'),
 CHECK ((estado='active' AND revocado_en IS NULL) OR
        (estado='revoked' AND revocado_en IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS uki_seguimiento_enlaces_qa_estado_idx
 ON public.uki_seguimiento_enlaces_qa_v1(branch,estado,vence_en);
REVOKE ALL ON TABLE public.uki_seguimiento_enlaces_qa_v1 FROM PUBLIC;
-- Falta asignar privilegios exclusivamente al servicio autenticado verificado.
-- Consulta del servidor DEBE cruzar solicitud_id Y branch con tabla origen.
COMMIT;
