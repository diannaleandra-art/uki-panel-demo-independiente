# Romo · aclaraciones de cierres exactamente como Uki (16-11-2026)

Fuente aprobada: `firebase/uki-sushi-local.html` en rama oficial `main`.
La aclaración de cierre de Uki (`cierre_aclarado`) agrega dato, valor correcto, responsable y motivo, sin alterar caja o los montos originales. El pedido olvidado es diferente: crea una rectificación de cierre y requiere conciliación financiera.

## Código preparado en rama Romo
- Mismo formulario oficial Uki desde Historial y Reportes. Su botón en Romo usa una copia cifrada propia y guardado CAS de Neon (no almacenamiento local de Uki).
- El módulo `prepararAclaracionCierreRomoQA` verifica que exista un único cierre original del turno, que los datos pertenecen a Romo y que la aclaración no esté duplicada. Anexa a `ajustesHistoricos` sin modificar `S.cierres`, pedidos, dinero, medio de pago o efectivo.
- Se usa la misma señal de operación en curso para impedir salir durante un guardado. Una respuesta incierta advierte revisar el historial antes de reintentar.
- CSV, PDF imprimible y WhatsApp de Romo incluyen las notas guardadas junto al cierre, sin recalcular importes ni sincronizar con Mi Administración.
- Pedidos olvidados, rectificaciones monetarias, devoluciones y pedidos pagados o de caja cerrada quedan bloqueados hasta un mecanismo de conciliación auditado. No se inventan capacidades diferentes a Uki.

## Pendiente manual antes de publicar
Acceder a un cierre REAL en Romo → Caja → Historial → Corregir datos → completar los 4 campos → confirmar → revisar el mismo turno, WhatsApp, Excel y PDF. Corroborar el monto original y la independencia de las dos sucursales Uki. Si el resultado es incierto, consultar el historial antes de reintentar. Ningún pedido, cierre ni cobro de prueba creado.

Estado: preparado, no habilitado en producción ni verificado con operación comercial manual.
