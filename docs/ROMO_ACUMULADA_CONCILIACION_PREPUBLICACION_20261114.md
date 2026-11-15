# Romo · conciliación preliminar de caja acumulada

Rama preparacion/uki-romo-sobre-main-20261114, no publicada.

## Qué se preparó
- Una consulta aislada para el apartado **Caja acumulada** que **no usa el servicio de Uki** y no crea ninguna nueva caja. Solo lee los cierres de la sesión cifrada Romo confirmada.
- Detecta cierres duplicados por `turnoClave`, fecha/horas incompatibles, falta de responsable, medios de cobro descuadrados, diferencias de arqueo o rectificaciones declaradas.
- Muestra **cantidad** de cierres con arqueo coincidente y por conciliar, más su estado individual, **sin atribuirlos a saldo acumulado**. No expone un saldo estimado ni agrega efectivo de tarjetas/transferencias, caja chica o delivery.
- Mantiene las siete pestañas de Caja de Uki. No se escriben movimientos, se borran cierres ni se toca la base original Uki.

## Pendiente y requisito para publicación
Falta un ledger persistido en Neon Romo de caja acumulada, con identidad/autorización de trabajador o dueño, saldo inicial físico contado, transacciones auditadas con idempotencia, clave única para cierres posteriores a la apertura, rectificaciones por diferencial, retiros y conciliación manual. El reporte de conciliación no sustituye ese trabajo, ni las pruebas manuales de turno/arqueo desde iPhone.

No se efectuó despliegue de producción ni se generaron ventas o movimientos de prueba.
