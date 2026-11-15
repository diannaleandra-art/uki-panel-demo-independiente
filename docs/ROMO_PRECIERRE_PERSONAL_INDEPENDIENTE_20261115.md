# Precierre del trabajador de Romo — recepción aislada

Rama `preparacion/uki-romo-sobre-main-20261114`. Migración aditiva: `migrations/2026-11-15-romo-precierre-trabajador-qa.sql`.

La clave de seis cifras de precierre es **distinta** de la de inventario. Una vez configurada por Google con rol dueño, el trabajador solo puede enviar un conteo físico (incluido $0), observaciones, nombre y referencia del turno abierto, sin ver pedidos, totales, pagos ni cierre definitivo.

El dueño consulta el envío, verifica que corresponda al trabajador y turno que abrió en el panel cifrado, elige usar el monto y realiza el **guardado del precierre con confirmación manual** y el mismo CAS de Romo. El envío aislado no es una venta ni cambia Caja. El recibo es único por turno y resistente a reintentos; solo se marca conciliado tras confirmación del panel.

Banderas separadas para Preview, no habilitadas inicialmente. Nunca reutilizar el PIN de inventario, ni permitir usar la sesión de trabajador como Google dueño. No hay pedidos, contabilidad ni movimientos comerciales generados por este esquema. 
