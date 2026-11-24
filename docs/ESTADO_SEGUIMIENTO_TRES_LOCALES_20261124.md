# Seguimiento de pedidos, chat y transferencias: estado de QA
Fecha: 24 de noviembre de 2026

## Sucursales cubiertas
- Uki Regimiento Arica (uki:arica)
- Uki La Serena (uki:serena)
- Romo Sushi La Serena (romo:serena)

## Código preparado en esta rama privada
1. Reglas compartidas de estados, transferencias y pago mixto.
2. Enlaces firmados, con vencimiento y huella persistida para bloquear reuso/filtración.
3. Dos formas previstas de entregar enlace: automáticamente desde el servidor que REGISTRA una solicitud pendiente (requires request_key original fuerte) y desde panel de agendadora para reenvío después de aceptar.
4. Pantalla cliente que muestra solicitud pendiente y cambia con confirmación persistida; botón «Ya transferí» sólo notifica, no acredita pago; mensajes por pedido.
5. Chat cifrado AES-256-GCM con identidad de sucursal/pedido, límites de mensajes y acceso del personal autorizado.
6. Bandeja del panel de pruebas para las tres sucursales, con consulta manual, respuesta, monto de transferencia y copia de enlace.
7. Regla compartida para BLOQUEAR la finalización normal de un pedido con transferencia no confirmada, además de exigir cobro real guardado y medios conciliados.
8. SQL para tablas de Uki y Romo en archivos NO_EJECUTAR, sin migraciones comerciales realizadas.

## Comprobaciones realizadas
- 45 comprobaciones ejecutadas sobre reglas puras del código compartido: finalización, pago mixto, registro incompleto, autorización y separación de sucursales.
- Revisión de sintaxis de doce archivos JavaScript CommonJS.
- Revisión de sintaxis de la pantalla cliente y del módulo de bandeja de las tres sucursales.
- Los archivos de pruebas de servidor con base simulada están creados; la suite Node completa aún NO se ejecutó.
- No se han probado sesiones reales, escritura QA ni teléfonos Safari; eso sigue pendiente.

## Bloqueos que se mantienen
No hay seguimiento nuevo público. No se ejecutaron las tablas NO_EJECUTAR ni se dieron permisos a bases reales. La función de seguimiento requiere un entorno Preview de Vercel, secretos válidos, QA aislada de Uki y Romo y banderas habilitadas. Sin todo eso devuelve respuesta de servicio no disponible. No se ha configurado ninguna cuenta Santander; nunca inventar RUT, banco, titular o número.

Tampoco hay sincronización directa con Santander ni confirmación de fondos por parte de la API bancaria. La agendadora debe comprobar personalmente el ingreso y el monto.

La regla que impide finalizar un pedido con transferencia pendiente está preparada, pero todavía no está conectada a la transacción real de cierre/entrega del panel. No afirmar que existe ya un bloqueo comercial efectivo.

## Para pasar a pruebas operativas
1. Aprobar y disponer de 2 bases QA realmente separadas de producción; confirmar rutas de registro de solicitudes de Uki y Romo sin hacer escrituras reales.
2. Ejecutar únicamente en QA las migraciones revisadas, con permisos mínimos y esquema validado.
3. Integrar llamada segura a issueForRegistered en el servicio que CONFIRMA recepción, devolviendo enlace sólo después de persistir huella; nunca aceptar identificación por folio/WhatsApp.
4. Conectar estado verdadero de preparación, salida y entrega desde panel, sin inferirlos de mensajes.
5. Conectar canFinishNormally de forma transaccional a finalización normal, manteniendo cancelaciones y rectificaciones auditadas.
6. Ejecutar Node suite y pruebas MANUALES de los tres locales: aceptación, link inválido, expiración, reenvío, pagos mixtos, abono faltante, duplicados, chat, Safari iPhone y escritorio.
7. Una única publicación conjunta tras constatar todo. No desplegar automáticamente desde esta rama.

Comando de pruebas: npm run test:seguimiento.
