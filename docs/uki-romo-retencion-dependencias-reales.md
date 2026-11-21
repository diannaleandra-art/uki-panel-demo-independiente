# Retención: dependencias confirmadas en el panel

Generación mensual operativa separada por sucursal. Primera copia real de noviembre desde 2026-12-05. No se activa borrado hasta comprobar recuperación de la copia y dependencias.

- Solicitudes WhatsApp reales: pendiente, aceptada, rechazada. No liberar si hay borrador, pedido sin pago/entrega, pedido vinculado ausente, fecha de finalización reciente o incierta. Las incidencias sin solución permanecen.
- Pedidos: se usan en `ukiVistaCliente`, deduplicación de código/carta, historial y conciliación. No eliminar por fecha únicamente. Conservar ids y totales históricos de todos los perfiles vinculados antes de retirar detalle.
- Timbres: `ventasValidas` retorna el contador antiguo si no hay movimientos; canjes determinan reinicio. No eliminar el último conjunto de movimientos sin preservar saldo vigente y estado de canjes. Mantener beneficios aunque el historial supere 95 días.
- Caja: preservar saldo acumulado, repartidores pendientes, auditoría, rectificaciones y cierre original. No reemplazar el estado con una copia antigua.
- Si el mes ya tiene una copia y hubo cambios posteriores, mantener el original. La discrepancia bloquea la limpieza; una copia corregida y recuperable debe quedar archivada antes de eliminar.

Los cambios de este lote son de diagnóstico y pruebas. No hay cron de eliminación, escritura de datos operativos ni cambios en credenciales. No hacer un despliegue aislado solo por este diagnóstico; integrar con la siguiente entrega necesaria.