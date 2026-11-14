# Romo — movimientos de caja independientes (preview)

Se integraron en la rama `preparacion/uki-romo-sobre-main-20261114` los formularios de gastos, retiros, deliverys manuales a pagar, pagos al repartidor y configuración explícita de base de caja. El formulario de Uki no se altera y Romo mantiene navegación y acceso existentes.

## Reglas
- Todas las acciones son explícitas, exclusivas de dueños Google en la rama QA, con confirmación antes de guardar, sobre cifrado AES y revisión CAS positiva en Neon. No hay guardado automático de render.
- Una operación que no recibe confirmación de revisión queda marcada como incierta; no se reintenta automáticamente.
- Gastos y retiros disminuyen disponible, repartos manuales aumentan solo deuda, pagos a repartidor disminuyen disponible y deuda; no son ventas ni cobros de clientes.
- Base de caja y caja chica se configuran separadamente antes del primer cobro o gasto del turno. Las sucursales Uki conservan sus valores predeterminados. Para los días nuevos de Romo, el valor predeterminado pasa a cero. No se corrigen automáticamente los saldos ya registrados.
- Para pagos en efectivo se exige saldo disponible (base más entradas y salidas). Pagos al repartidor no pueden superar entregas registradas menos pagos ya confirmados.
- El resumen de caja es la misma función totales() de Uki y se conserva trazabilidad en arrays existentes del estado Romo. No se han activado precierres, cierres, timbres, inventario, ni envíos automáticos de carta.

## Control de implementación
La última revisión registrada en la base fue 2, con el pedido piloto #1 pendiente. No se han creado movimientos ficticios ni automáticos para probar. Se necesita comprobación manual desde el panel antes de usar los nuevos movimientos en producción. La rama pública main no se modifica.
