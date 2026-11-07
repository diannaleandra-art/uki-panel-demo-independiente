-- Mi Administración Privada: esquema nuevo y aislado (ninguna tabla operativa se modifica).
-- Aplicar primero en Neon QA; en producción solo después de verificar controles de acceso.
CREATE TABLE IF NOT EXISTS public.fin_pin_privado (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  salt text NOT NULL,
  hash text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.fin_pin_intentos (
  identidad text PRIMARY KEY,
  fallos integer NOT NULL DEFAULT 0,
  bloqueado_hasta timestamptz,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.fin_sesiones (
  token_hash text PRIMARY KEY,
  usuario_uid text NOT NULL,
  expira_en timestamptz NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_sesiones_expira_idx ON public.fin_sesiones(expira_en);
CREATE TABLE IF NOT EXISTS public.fin_negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 100),
  razon_social text NOT NULL DEFAULT '',
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.fin_sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.fin_negocios(id),
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 100),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE(negocio_id,nombre),
  UNIQUE(id,negocio_id)
);
CREATE TABLE IF NOT EXISTS public.fin_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.fin_negocios(id),
  sucursal_id uuid,
  tipo text NOT NULL CHECK(tipo IN ('venta','gasto','compra','costo_producto','retiro','ingreso_extra')),
  fecha date NOT NULL,
  monto bigint NOT NULL CHECK(monto>=0 AND monto<=1000000000),
  medios jsonb NOT NULL DEFAULT '{}'::jsonb,
  categoria text NOT NULL DEFAULT '',
  concepto text NOT NULL DEFAULT '',
  proveedor text NOT NULL DEFAULT '',
  referencia text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'registrado' CHECK(estado IN ('registrado','pendiente','pagado','anulado')),
  fuente text NOT NULL DEFAULT 'manual' CHECK(fuente IN ('manual','cierre','factura','ajuste')),
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  clave_unica text,
  creado_por text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (sucursal_id,negocio_id) REFERENCES public.fin_sucursales(id,negocio_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_movimientos_clave_unica_idx ON public.fin_movimientos(clave_unica) WHERE clave_unica IS NOT NULL;
CREATE INDEX IF NOT EXISTS fin_movimientos_fecha_idx ON public.fin_movimientos(negocio_id,fecha DESC);
CREATE INDEX IF NOT EXISTS fin_movimientos_sucursal_idx ON public.fin_movimientos(sucursal_id,fecha DESC);
CREATE TABLE IF NOT EXISTS public.fin_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.fin_negocios(id),
  sucursal_id uuid,
  movimiento_id uuid REFERENCES public.fin_movimientos(id),
  nombre text NOT NULL,
  mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp','application/pdf')),
  bytes integer NOT NULL CHECK(bytes>0 AND bytes<=1800000),
  contenido bytea NOT NULL,
  sha256 text NOT NULL,
  tipo text NOT NULL CHECK(tipo IN ('factura','boleta','cierre','comprobante','otro')),
  fecha_documento date,
  proveedor text NOT NULL DEFAULT '',
  creado_por text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (sucursal_id,negocio_id) REFERENCES public.fin_sucursales(id,negocio_id)
);
CREATE INDEX IF NOT EXISTS fin_documentos_busqueda_idx ON public.fin_documentos(negocio_id,creado_en DESC);
CREATE TABLE IF NOT EXISTS public.fin_auditoria (
  id bigserial PRIMARY KEY,
  entidad text NOT NULL,
  entidad_id text NOT NULL,
  accion text NOT NULL,
  anterior jsonb,
  nuevo jsonb,
  actor_uid text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_auditoria_fecha_idx ON public.fin_auditoria(creado_en DESC);
CREATE TABLE IF NOT EXISTS public.fin_costos_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.fin_negocios(id),
  nombre text NOT NULL CHECK(char_length(btrim(nombre)) BETWEEN 2 AND 100),
  precio_venta bigint NOT NULL DEFAULT 0 CHECK(precio_venta>=0),
  costo_estimado bigint NOT NULL DEFAULT 0 CHECK(costo_estimado>=0),
  detalle text NOT NULL DEFAULT '',
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_costos_negocio_idx ON public.fin_costos_productos(negocio_id);
