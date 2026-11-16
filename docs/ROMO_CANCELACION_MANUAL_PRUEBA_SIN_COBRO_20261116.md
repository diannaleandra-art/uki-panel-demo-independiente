# Cancelación auditada de pedido de prueba pendiente · Romo La Serena

Fecha: 2026-11-16. Preparación independiente Romo. Referencia: captura del pedido real de prueba «PRUEBA – NO PREPARAR», retiro de 14-11, sin cobro, $1.000, turno 2026-11-14.

## Problema y corrección
El panel ya tiene `ukiRomoCambiarEstadoQA(id,'cancelar')`, que exige «Cliente/Local», motivo y responsable, y `prepararCancelacionRomoQA`, que conserva registro original y auditoría, rechaza cualquier pago o cierre confirmado y exige CAS cifrado de Neon Romo.

La UI ocultaba el formulario de cancelación de todo pedido cuyo cliente empezara por «PRUEBA», aunque la misma UI sí bloqueaba correctamente cobros, entregas y edición. Se habilitó **únicamente el formulario de cancelación** para esos pedidos, sin quitar las protecciones de cobro, entrega y edición.

- No hay borrado de registros, devolución, caja o turno nuevo.
- La cancelación **no es automática**; el dueño o responsable debe completar el formulario, revisar y confirmar manualmente.
- En caso de conflicto o guardado incierto, comprobar la revisión de Neon y el historial antes de repetir.
- Se conserva la fecha original del pedido de 14-11 y el registro de la jornada. Cualquier ajuste de la jornada 2026-11-14 necesita diagnóstico posterior con datos ya conciliados y revisión de base/cierres.
- Ninguna modificación de código del Uki oficial, ni cambios en producción Uki.

## Verificación manual obligatoria
Desde iPhone: abrir Romo QA → Pedidos → PRUEBA – NO PREPARAR → «Cancelar pedido sin cobro» → «Local», motivo «Pedido de prueba del panel, no preparado ni cobrado», responsable real → confirmar una sola vez → comprobar en Neon la nueva revisión y que aparece como Cancelado, con pago y venta $0. No crear operaciones de prueba adicionales.
