# Romo Sushi La Serena · Bloque 1: rectificaciones postcierre

Fecha: 16-11-2026. Rama: preparacion/uki-romo-sobre-main-20261114.
**Preparación GitHub. NO publicado, NO aplicado en Neon y NO validado comercialmente.**

## Recuperado de Uki
Las aclaraciones de datos del cierre son notas SIN movimiento financiero. Los pedidos olvidados y las rectificaciones monetarias requieren un cierre rectificado que conserve el comprobante original. No mezclar sus efectos de caja.

## Código preparado
- Historial Romo: solicitud pendiente por folio y cierre original, con tipo devolución/cobro adicional, medio, importe, responsable y motivo. No genera cobros.
- Módulo public/romo-panel-qa/uki-romo-rectificacion-confirmada-qa.mjs: confirma una propuesta pendiente, con caja nueva abierta, base física confirmada, evidencia del movimiento real y responsable. Preserva cierre original, pedido y ventas.
- Módulo lib/romo-rectificacion-constancia-v2-qa.mjs: validación por servidor del resumen, método y total. Consulta recibo v2 desde Neon para imprimir PDF en Safari. No acredita importación a Finanzas.
- Endpoint privado api/romo-rectificacion-cierre-v2-qa.js con Google dueño verificado y dos banderas apagadas de lectura/escritura. Sin transferencias bancarias automáticas.
- Migración SOLO PREPARADA migrations/2026-11-16-romo-rectificacion-postcierre-v2-qa.sql: nueva tabla inmutable y una operación atómica de snapshot cifrado CAS + recibo v2, enlazado por origen|v2 y revisión SHA256. No ejecutar sin autorización y pruebas.
- Caja/arqueo del turno actual: el delta de cierres anteriores figura SEPARADO de las ventas por pedidos. El cierre consulta Neon para verificar todos los recibos v2 del turno, bloquea ajustes sin constancia y distingue efectivo y medio.
- CSV, vista PDF imprimible, WhatsApp e Historial muestran el movimiento separado. Se respeta la fecha operativa al cruzar medianoche.
- La importación automática de cierres de Mi Administración permanece desactivada; las diferencias v2 requerirán importación idempotente separada en el bloque 3.

## Límites todavía no terminados
- Por seguridad solo se programa la PRIMERA versión v2 de una venta ya pagada. Versiones sucesivas v3+, pedidos olvidados, pago en otro local, refund de delivery y ajustes de propinas postcierre requieren su conciliación propia como en Uki antes de declarar Bloque 1 completo.
- La migración SQL NO fue ejecutada. La preparación se revisó mediante lectura y sintaxis JS, NO mediante operaciones reales ni pruebas comerciales.
- La confirmación manual solo debe hacerse tras devolver o recibir realmente el dinero. Una referencia registrada no demuestra por sí sola la transferencia.

## Revisión MANUAL para la publicación conjunta
1. Confirmar acceso exclusivo de dueños y bloqueo a agendadores.
2. Preparar una propuesta real de ajuste contra un pedido del cierre original y comprobar que Caja NO cambia.
3. Confirmar base de un turno nuevo y un movimiento de dinero que sí ocurrió, con comprobante/referencia.
4. Verificar creación de una sola constancia v2 y una sola revisión CAS; comprobar que reintentar no duplica.
5. Consultar constancia desde Neon; imprimir PDF v2 y conservar el PDF original.
6. Revisar medios, arqueo y efectivo del nuevo turno; cerrar y verificar CSV/WhatsApp/PDF con ajuste aparte de la venta.
7. Confirmar que Mi Administración no ha sumado de nuevo la venta y que ambas sucursales Uki están intactas.

**ESTADO REAL: núcleo de rectificación v2 preparado; falta ejecutar migración autorizada, homologar los demás tipos y completar pruebas manuales. Bloque 1 NO se declara terminado aún.**

## Complemento: pedidos olvidados y comprobantes sucesivos preparados

La limitación escrita anteriormente ("no soporta versiones v3+ ni pedidos olvidados") se refiere únicamente al mecanismo de **devolución/cobro adicional de una venta ya registrada**. Ese mecanismo sigue limitado a v2.

En **otra secuencia específica de pedidos olvidados**, ahora se preparó un circuito aparte v2–v32, que añade el importe histórico realmente cobrado por Romo y mantiene el cobro externo y delivery de repartidor como conceptos diferenciados, conservando los cierres originales. Ver `public/romo-panel-qa/uki-romo-confirmar-olvido-qa.mjs`, `lib/romo-olvidos-constancias-qa.mjs`, `api/romo-pedidos-olvidados-qa.js`, `migrations/2026-11-16-romo-pedidos-olvidados-versiones-qa.sql`.

Estos archivos **no se han desplegado, ni se ha ejecutado su migración ni autorizado movimiento comercial**. El guardado encriptado/versionado es programación preparada, no éxito bancario ni validación de la dueña. En pedidos olvidados se confirma dinero que ocurrió **antes del cierre original**, nunca se vuelve a recibir en la Caja actual. Se bloqueó la ruta heredada de Uki que no guardaba mediante CAS de Romo.

Pendiente antes de marcar finalizado: validación manual del circuito, origen externo y reparto no duplicado, permisos de dueños, comprobantes reales, errores de conexión, autorización segura de migración y reporte de ajustes a Mi Administración sin reimportar la venta original.

## Validación estructural en Neon QA — 16-11-2026

- Se saneó `migrations/2026-11-16-romo-pedidos-olvidados-versiones-qa.sql` (una única transacción, tabla y función, SHA-256 completo); commit `9ee5c919` en la misma rama de preparación.
- Se instalaron **solo en la rama Neon preexistente de prepublicación** `br-gentle-wave-be71bcpa` del proyecto `round-cell-98681740` las dos migraciones de cierres rectificados: pedidos olvidados versionados y rectificación monetaria v2. PostgreSQL aceptó ambas.
- En esa rama se comprobaron las dos tablas, claves únicas, relaciones con cierre original, funciones SECURITY DEFINER y permisos: el servicio `romos_app_service` puede consultar las constancias y ejecutar las funciones, pero no insertar filas de constancia directamente; las funciones no dan EXECUTE a PUBLIC.
- Verificación posterior en QA: **0 constancias rectificadas y 0 cierres originales**, sin transacciones comerciales ni pruebas automáticas de dinero. La rama antigua de QA `br-lingering-scene-berkq3k0` usa una clave de cierre diferente: el primer intento falló y quedó sin migraciones; no utilizarla para certificar compatibilidad con la base actual.
- **La base principal `romos_sushi` permanece sin ambas tablas nuevas**, y su esquema sí coincide con el de la rama de prepublicación usada. No se cambió producción Uki ni se hicieron despliegues. Las banderas de recepción/escritura permanecen apagadas.
- **Pendiente para cierre definitivo:** instalación en base principal con aprobación explícita, validación de permisos y recorridos manuales con cierres reales, conciliación de las versiones, caja, reportes y publicación agrupada. Pasar el SQL en QA no equivale a haber probado flujos comerciales.
