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