-- REGISTRO HISTÓRICO: LAS DOS TABLAS FUERON CREADAS CON AUTORIZACIÓN 12-11-2026.
-- NO EJECUTAR NUEVAMENTE. Se conserva este SQL solo como documentación y auditoría.
-- El código PIN real aún no existe; el servicio de ingreso no está habilitado.
-- PROPUESTA, NO EJECUTAR SIN APROBACIÓN ADICIONAL DE LA DUEÑA.
-- Misma experiencia que Uki para empleados: nombre + código de 6 números.
-- No copia ni utiliza códigos o tablas de Uki; datos exclusivos Romo Serena.
-- La tabla de inventario Romo YA fue autorizada y creada anteriormente.
-- El usuario ya autorizó la creación de ambas tablas vacías y se verificó: 0 códigos, 0 intentos.
BEGIN;
CREATE TABLE public.romo_pin_inventario_v1(
  store_id TEXT PRIMARY KEY CHECK (store_id='romo:serena'),
  salt TEXT NOT NULL CHECK (salt ~ '^[a-f0-9]{32}$'),
  hash TEXT NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
  creado_por TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE public.romo_pin_intentos_v1(
  store_id TEXT NOT NULL CHECK (store_id='romo:serena'),
  identidad_hash TEXT NOT NULL CHECK (identidad_hash ~ '^[a-f0-9]{64}$'),
  fallos SMALLINT NOT NULL DEFAULT 0 CHECK (fallos BETWEEN 0 AND 5),
  bloqueado_hasta TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(store_id,identidad_hash)
);
REVOKE ALL ON public.romo_pin_inventario_v1 FROM PUBLIC;
REVOKE ALL ON public.romo_pin_intentos_v1 FROM PUBLIC;
COMMIT;

-- PENDIENTE ANTES DE HABILITAR:
-- 1. Crear un rol dueño verificado en la base de Romo, con su consentimiento.
-- 2. Asociar un código inventario Romo creado por dueño, no copiar el de Uki.
-- 3. Desarrollar rate-limit + bloqueo de intentos del servidor con estas tablas.
-- 4. Probar PIN equivocado, reintentos, separación Romo/Uki, auditoría por nombre.
-- 5. Revisar y autorizar cambios de datos antes de activar endpoint QA.
