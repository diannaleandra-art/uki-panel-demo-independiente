# Romo Sushi · validación de apertura, precierre y cierre (lote de preparación)
Fecha: 16-11-2026. Rama: `preparacion/uki-romo-sobre-main-20261114`.

## Corregido solo en Romo (sin publicación)
- La apertura de caja no trae un valor $0 ya escrito en base o caja chica. Ambos campos exigen importe explícito, admitiendo cero cuando es el monto físico real.
- La función de apertura deja de asumir base $0 por argumento omitido y deja de arrastrar caja chica anterior si el usuario no indica nueva cantidad.
- El cierre definitivo requiere turno abierto, base confirmada y un importe válido de caja chica antes de preparar el resumen. Se mantiene la validación de timbres pendientes, solicitudes de carta, contado físico, diferencias y comprobación atómica de Neon.
- `cash.close` queda reservado al rol `duenos` también en la matriz compartida de permisos, en coherencia con `api/romo-cierre-definitivo-qa.js`; no se amplían permisos de agendador.
- Se conserva el precierre de trabajadores sin cierre del día, el historial por responsable, los pagos mixtos, la caja acumulada y los cálculos actuales de Uki como referencia. El efectivo neto del cierre sigue expresado sin base inicial, tal como el indicador del panel oficial.

## Pendientes reales
- PIN independiente para trabajadores de caja/precierres: NO conectar con el PIN exclusivo de inventario.
- Revisar permisos reales de trabajador/agendador, dos turnos de precierre, historial, comprobantes y apertura/cierre en iPhone con operaciones REALES manuales.
- Conciliar rectificaciones posteriores al cierre y sincronización de Mi Administración sin replicar ingresos.
- No habilitar funciones ni promover la rama de preparación antes de validar manualmente toda la operación.

No se crearon pagos, pedidos, cierres, empleados, pruebas automáticas, despliegues ni escrituras de producción.
