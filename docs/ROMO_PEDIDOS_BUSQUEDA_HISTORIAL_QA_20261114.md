# Romo · búsqueda y archivo del mismo panel Uki (preparación)

Rama: `preparacion/uki-romo-sobre-main-20261114`. Código guardado sin publicación ni prueba comercial.

## Criterio
- Se utilizan los pedidos propios de `romo:serena` ya cargados por la sesión cifrada y las funciones de búsqueda oficiales `ukiPedidoCoincideBusqueda` y `ukiFechaCalendarioChile`.
- **Operación:** pedidos de la fecha operativa actual y todos los aún pendientes de cobro o entrega, incluso de días anteriores.
- **Historial:** pedidos completados/cancelados de días anteriores; **Todos:** registros del local, con búsqueda que puede abarcar todas las fechas.
- Búsqueda por nombre, WhatsApp, código de cliente, código de la carta, número de pedido y folio de turno; filtros de estado y calendario; selección de días anteriores. No se modifican los datos al consultar.
- Solicitudes de carta pendientes se siguen mostrando separadas de ventas. Las rechazadas visibles en la bandeja se muestran solo en historial, aclarando que la consulta puede ser parcial.
- Los filtros no acceden a la caja ni ejecutan `fechaTurnoRegistro`; se toma fecha operativa escrita en el pedido/folio o se deriva la fecha de registro en horario de Chile.
- Se impiden cobros o cambios de estado desde el procedimiento simplificado sobre pedidos pertenecientes a un cierre confirmado.

## Pendiente
Comprobar manualmente con pedidos reales del local, fechas y turnos; completar manejo de mesas, edición de ventas pagadas con conciliación y desbloqueo autorizado. No se ejecutaron pruebas automáticas ni se desplegó a producción. La vista oficial y datos de las dos sucursales Uki no cambian.
