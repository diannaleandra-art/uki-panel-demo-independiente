# Romo Sushi · paridad de cobros y persistencia de formularios
Fecha: 16-11-2026. Rama: preparacion/uki-romo-sobre-main-20261114.

## Preparado sin publicar
- Medios del cobro de PRODUCTOS alineados con la referencia oficial Uki: efectivo, transferencia, débito, Edenred, otros, Uber Eats, PedidosYa y Rappi.
- En cobro de DELIVERY se mantienen solo los medios que admite Uki para el reparto (sin las tres apps).
- Las formas mixtas siguen requiriendo montos enteros que sumen exactamente productos y envío, sin dar por recibidos pagos automáticamente.
- La validación del candidato de cobro exige turno abierto Y base física previamente confirmada; nunca toma como base el valor inicial predeterminado.
- El delivery de un pedido que se va a cobrar debe estar confirmado entre $1 y $4.000; el total del pedido se limita a $3.000.000. Un pedido con propina previa exige conciliación; no se finge que esa propina se cobró con este formulario.
- La actualización GET de solicitudes cada 45 segundos ya no redibuja ni elimina los campos pendientes de un pedido cuya ficha está abierta ni un motivo de rechazo seleccionado. El estado de la consulta se anuncia sin perder lo escrito.

## Sin modificar
- Operación oficial de Uki Regimiento y Uki La Serena, base y precios reales, estado Neon, pedidos anteriores, cajas, timbres, QR, ni los módulos que todavía faltan validar.
- Ningún pago, pedido, cierre ni movimiento de prueba creado.
- La edición pendiente ya existente conserva el mismo pedido, los datos anteriores y el historial: se comprobará manualmente en una operación real antes de producción.

## Comprobación manual obligatoria antes de publicación
1. Abrir turno de Romo con base real y verificar caja independiente.
2. Abrir pedido pendiente y escribir una edición sin guardar; esperar la actualización de bandeja: los campos no deben desaparecer.
3. Guardar edición real con responsable/motivo y confirmar el mismo folio en Neon e historial, sin venta nueva.
4. Cobrar un pedido real con los medios correctos; si el cliente divide su pago, comprobar que ambos montos cuadren; revisar caja, timbre y reporte.
5. Comprobar que delivery no admita medios de apps, no supere $4.000, y que un pedido pagado no cobre dos veces.

Estado: código preparado; no validado manualmente; no promover a producción sin la revisión integral de funciones y permisos.
