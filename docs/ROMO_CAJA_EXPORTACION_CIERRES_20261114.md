# Romo · exportaciones de cierres confirmados (preparación)

Rama `preparacion/uki-romo-sobre-main-20261114`, no publicada ni probada en iPhone.

- Solo datos del estado cifrado ya cargado para Romo, con número de revisión Neon validado; nunca solicita información de Uki ni genera cierres.
- Historial y reporte semanal permiten **CSV compatible con Excel** y vista HTML lista para **Imprimir / Guardar como PDF** desde la hoja de imprimir de Safari. No se presenta un TXT como si fuera PDF ni se afirma que CSV sea un libro XLSX.
- El módulo valida identidad de sucursal/turno, unicidad de cierres, fecha operativa, importes y que medios sumen la venta; ante inconsistencias NO exporta cifras engañosas.
- Exporta exclusivamente cierres definitivos existentes; no suma pedidos pendientes, solicitudes, precierres, delivery manual ni propinas por segunda vez.
- Cada cierre del historial tiene compartir por WhatsApp con resumen validado y medio de pago, sin incluir datos personales de clientes. Abrir WhatsApp no confirma envío ni escribe en Neon; pulsar Enviar sigue siendo manual.
- Los reportes indican que aún no se han contabilizado en Mi Administración y se conservan las fechas de operación chilenas.
- No altera permisos, caja acumulada, los datos de negocio ni las sucursales Uki.

**Pendiente antes de publicar:** prueba manual desde iPhone (CSV abierto en Excel/Numbers y hoja Imprimir de Safari, guardado PDF real), revisar casos de cierres rectificados, acumulada, autorizaciones de trabajador y sincronización idempotente con Mi Administración.
