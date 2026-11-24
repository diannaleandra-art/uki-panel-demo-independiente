# Continuidad del bloqueo de transferencias - tres sucursales (24 nov 2026)
Estado: RAMA DE PRUEBAS. No publicado en los paneles comerciales.

## Regla de negocio (sin pasos adicionales)
Cliente: envía el pedido y elige transferencia; cuenta y monto sólo aparecen si la sucursal los tiene verificados. Pulsa «Ya transferí» para avisar; esto NO acredita dinero.
Agendadora: abre ese mismo pedido, consulta el abono real en el banco y confirma. Sólo después puede marcar como pagado o entregado.
Los pedidos en efectivo y tarjeta conservan sus controles habituales, sin pedir una verificación de transferencia.
Los pagos mixtos necesitan monto transferido exacto y el resto conciliado.

## Implementación nueva en QA
- lib/seguimiento-verificar-cierre-qa.cjs: comprueba la transferencia guardada en QA por ID+tienda, bloqueando «pendiente», «avisada», monto incierto, y aceptando «confirmada». Si no hay transferencia estructurada, falla de forma segura.
- api/seguimiento-verificar-cierre-qa.js: endpoint privado GET de solo lectura, exige sesión Google autorizada por sucursal, jamás cambia caja.
- public/romo-panel-qa/index.html: comprobación antes de marcar pagado al guardar, marcar entregado y cobrar en Romo.
- tests/seguimiento-bloqueo-guardado-panel-qa.test.cjs: casos por las tres sucursales, permisos y rutas.
- La versión de QA conserva aislamiento, el código de seguridad no modifica producción.

## Limitaciones críticas antes de publicación
1. Esta es una **verificación previa de interfaz** y **no todavía un bloqueo transaccional del guardado real**. La operación comercial debe validar el estado de la transferencia EN LA MISMA TRANSACCIÓN que cambia a pagado/entregado. Como parte del panel comercial utiliza snapshots cifrados, aún falta adaptar el servicio de guardado sin introducir bypass.
2. Los pagos provenientes de WhatsApp/manuales todavía no tienen una identidad de pedido UUID confiable en el servicio de seguimiento; si se declara transferencia sin identidad, la versión QA bloquea el cierre hasta asociarla. No usar este guardia en producción sin resolverlo.
3. Uki conserva solicitudes anteriores que sólo tienen pago declarado por cliente; se deben registrar montos validados por el servidor al aceptar el pedido, sin confiar en el navegador.
4. Siguen pendientes validar cuenta bancaria por local, integración operativa, pruebas manuales en Safari/PC y control de caja/historial.
5. El demo público de revisión no es un sistema comercial; se mantienen cartas y cajas reales intactas.

## Resultado automatizado
GitHub Actions ejecución 45342313820: 60 pruebas, 60 aprobadas, 0 fallidas, sin escribir pagos reales.
