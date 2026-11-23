-- PREPARACIÓN / NO EJECUTAR EN PRODUCCIÓN SIN PRUEBA Y RESPALDO CONFIRMADO.
-- Solo mensajes de trabajo WhatsApp en Mi Administración privada.
-- Esta tabla no referencia ni altera pedidos, cierres, caja ni clientes actuales.
BEGIN;
CREATE TABLE IF NOT EXISTS public.wa_supervision_mensajes(
 sucursal TEXT NOT NULL CHECK(sucursal IN ('uki:arica','uki:serena','romo:serena')),
 message_id TEXT NOT NULL CHECK(length(message_id) BETWEEN 4 AND 250),
 direccion TEXT NOT NULL CHECK(direccion IN ('cliente','agendadora')),
 cliente_hash CHAR(64) NOT NULL,
 cliente_ultimos4 CHAR(4) NOT NULL,
 fecha_mensaje TIMESTAMPTZ NOT NULL,
 tipo TEXT NOT NULL,
 contenido_cifrado TEXT NOT NULL,
 clasificacion TEXT NOT NULL CHECK(clasificacion IN
  ('general','posible_pedido','posible_cambio','posible_reclamo')),
 recibido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(sucursal,message_id)
);
CREATE INDEX IF NOT EXISTS wa_supervision_recientes
 ON public.wa_supervision_mensajes(sucursal,fecha_mensaje DESC);
CREATE INDEX IF NOT EXISTS wa_supervision_cliente
 ON public.wa_supervision_mensajes(sucursal,cliente_hash,fecha_mensaje DESC);
REVOKE ALL ON public.wa_supervision_mensajes FROM PUBLIC;
COMMIT;
