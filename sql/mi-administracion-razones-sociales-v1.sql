-- Mi Administración QA: razones sociales distintas de marcas y sucursales.
-- Relaciones muchos a muchos: una marca puede operar bajo distintas razones sociales.
-- Ninguna venta/caja/pedido operativo de Uki se altera.
CREATE TABLE IF NOT EXISTS public.fin_razones_sociales(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nombre text NOT NULL CHECK(char_length(btrim(nombre)) BETWEEN 2 AND 140),
 rut text NOT NULL DEFAULT '' CHECK(char_length(btrim(rut))<=20),
 activo boolean NOT NULL DEFAULT true,
 creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_razones_nombre_ci_uq
 ON public.fin_razones_sociales(lower(btrim(nombre)));
CREATE UNIQUE INDEX IF NOT EXISTS fin_razones_rut_uq
 ON public.fin_razones_sociales(upper(regexp_replace(rut,'[^0-9Kk]','','g')))
 WHERE btrim(rut)<>'';
CREATE TABLE IF NOT EXISTS public.fin_negocio_razones(
 negocio_id uuid NOT NULL REFERENCES public.fin_negocios(id),
 razon_social_id uuid NOT NULL REFERENCES public.fin_razones_sociales(id),
 creado_en timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(negocio_id,razon_social_id)
);
ALTER TABLE public.fin_movimientos
 ADD COLUMN IF NOT EXISTS razon_social_id uuid REFERENCES public.fin_razones_sociales(id);
ALTER TABLE public.fin_documentos
 ADD COLUMN IF NOT EXISTS razon_social_id uuid REFERENCES public.fin_razones_sociales(id);
CREATE INDEX IF NOT EXISTS fin_movimientos_razon_fecha_idx
 ON public.fin_movimientos(razon_social_id,fecha DESC);
CREATE INDEX IF NOT EXISTS fin_documentos_razon_fecha_idx
 ON public.fin_documentos(razon_social_id,creado_en DESC);
-- La factura aportada identifica legalmente al comprador; no se asignan otros negocios por suposición.
INSERT INTO public.fin_razones_sociales(nombre,rut)
 VALUES('INVERSIONES ROMO SPA','78.165.233-4')
 ON CONFLICT DO NOTHING;
INSERT INTO public.fin_negocio_razones(negocio_id,razon_social_id)
 SELECT b.id,r.id FROM public.fin_negocios b CROSS JOIN public.fin_razones_sociales r
 WHERE b.nombre='Romo''s Sushi' AND r.nombre='INVERSIONES ROMO SPA'
 ON CONFLICT DO NOTHING;
-- Solo la factura de referencia, cuya razón social se leyó del PDF, se clasifica.
UPDATE public.fin_movimientos AS m
 SET razon_social_id=r.id,
     datos=coalesce(m.datos,'{}'::jsonb) || jsonb_build_object('comprador_factura','INVERSIONES ROMO SPA','observacion_factura','REGIMIENTO')
 FROM public.fin_razones_sociales r
 JOIN public.fin_negocios b ON b.nombre='Romo''s Sushi'
 WHERE m.negocio_id=b.id AND m.tipo='compra' AND m.fuente='factura'
 AND m.proveedor='COMERCIALIZADORA BOMBO SPA' AND m.referencia='78969'
 AND m.fecha='2026-11-06' AND m.monto=177674
 AND m.razon_social_id IS NULL AND r.nombre='INVERSIONES ROMO SPA';
INSERT INTO public.fin_auditoria(entidad,entidad_id,accion,nuevo,actor_uid)
 SELECT 'compra',m.id::text,'clasificar_razon_desde_factura',
 jsonb_build_object('razon_social_id',m.razon_social_id,'fuente','PDF 78969(1).pdf'),
 'sistema:migracion-qa'
 FROM public.fin_movimientos m WHERE m.proveedor='COMERCIALIZADORA BOMBO SPA'
 AND m.referencia='78969' AND m.fecha='2026-11-06' AND m.monto=177674
 AND m.razon_social_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.fin_auditoria a WHERE a.entidad='compra'
 AND a.entidad_id=m.id::text AND a.accion='clasificar_razon_desde_factura');
