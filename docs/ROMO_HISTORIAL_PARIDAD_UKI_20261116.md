# Historial y Reportes — réplica Uki para Romo
Fecha: 16-11-2026. Rama: preparacion/uki-romo-sobre-main-20261114.

## Código preparado (sin publicación)
- Historial incluye el buscador, calendario y flechas de fecha aprobados en Uki.
- Mantiene los precierres separados de los cierres definitivos, reutilizando vHistorialPrecierres(). Su exportación de Excel ya usa nombre propio Romo (preexistente, no modificado).
- Cada cierre muestra pagos por medio, venta con/sin delivery, gastos, propinas, efectivo esperado/contado, diferencia, repartidor, responsable, hora y turno, sin calcular ventas a partir de solicitudes.
- Los CSV y PDF (imprimible de Safari) respetan la búsqueda del Historial; Reportes sigue usando el mismo vReportes() oficial por día/semana/mes.
- El módulo de exportación valida duplicados y congruencia de todos los cierres Romo ANTES de aplicar los identificadores de turnos visibles. No usa bases ni rutas de Uki.
- WhatsApp solo abre el texto para compartir; enviar continúa como acción manual.
- Edición de cierres, rectificaciones y pedidos olvidados siguen pendientes de un guardado CAS Neon Romo y no se exponen como controles de escritura.
- La fuente única de Mi Administración sería romo:serena|turno, pero la sincronización financiera NO está habilitada. Ningún cierre de prueba ni de producción se ha incorporado.

## Validación manual que falta
Consultar en iPhone un cierre REAL de Romo por fecha y texto, hacer navegación anterior/siguiente, abrir el detalle, descargar el mismo filtro en CSV/PDF y comparar el reporte oficial diario/semanal/mensual. Revisar dos precierres y que Uki no cambió. No crear cierres ficticios ni simular pagos.
