# Romo · equivalencia de Clientes y Timbres con Uki final

Fecha: 15 de noviembre de 2026. La referencia es `firebase/uki-sushi-local.html` de `main`, en particular `vClientes()`, `verDiaTimbres()`, `ukiTarjetasAgrupadas()`, `ukiFechaTimbreCalendario()` y `ukiBusquedaPorDatos()`.

**Diferencia:** Romo mostraba siempre todas las tarjetas, todas las compras pagadas y los timbres pendientes, sin el desglose oficial por día ni la consulta de fechas anteriores. La búsqueda solo ocultaba tarjetas DOM del subconjunto presente.

**Corrección:** se reutilizan las funciones oficiales de búsqueda por nombre, WhatsApp y código, y los filtros de timbres por fecha actual, otra fecha y todos los días (en búsqueda). Se recuperan los contadores oficiales de clientes, movimientos de timbre ganados, premios de diez compras y pedidos pagados sin movimiento de timbre; también el calendario e historial por día. La tarjeta, el conteo de premios, el historial y los botones para WhatsApp siguen utilizando los mismos datos y las acciones Romo que ya guardan en CAS cifrado.

**No añadido:** ninguna función comercial ajena a Uki. El render de Clientes jamás crea cobros, clientes, timbres, canjes ni ventas. El envío de WhatsApp todavía exige presionar Enviar y confirmar desde Romo, con revisión Neon. Premios/canjes no se habilitan mientras su escritura segura no esté homologada. Las sucursales Uki oficiales no se modifican.

Validación comercial en iPhone: únicamente con pedidos ya existentes y sin crear datos de prueba.

Ajuste final de comparación: la lista de tarjetas por fecha incluye también movimientos de canje, tal como la `vClientes()` oficial (el contador de timbres ganados continúa contando exclusivamente ventas). Se muestra el número de timbres pendientes de envío sin volver a generarlos.
