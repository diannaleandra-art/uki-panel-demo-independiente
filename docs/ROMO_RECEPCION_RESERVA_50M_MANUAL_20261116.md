# Romo La Serena — recepción segura y reserva manual de 50 minutos
Fecha: 16-11-2026. Rama: preparacion/uki-romo-sobre-main-20261114.

## Cambios agrupados en un solo commit (sin publicar)
- Reserva de solicitud Romo: 50 minutos, igual a la última versión aprobada de Uki. El plazo se fija al reservar justo antes de confirmar el guardado atómico, no al abrir la ficha.
- Al vencer la reserva, sigue bloqueada contra otro pedido: ya NO puede volver a reservarse automáticamente ni rechazarse solo porque venció.
- Contador visible en Pedidos de Romo y avisos visuales; sonido únicamente después de pulsar Activar aviso sonoro. El servidor envía su hora para ajustar el reloj del iPhone.
- Solo la cuenta autorizada con rol de dueños puede recuperar una reserva vencida. Exige comprobación manual de pedidos/caja/historial, nombre y motivo; deja constancia en datos de la solicitud en Neon Romo.
- No se altera la aceptación atómica ya preparada: una única revisión CAS debe confirmar a la vez pedido pendiente cifrado y solicitud aceptada. No marca pago ni timbre.
- No se crean pedidos, importes, cierres o pruebas comerciales. No se modifican las sucursales Uki ni el catálogo público Romo.

## Verificación manual pendiente
1. Confirmar en Preview que una solicitud reservada muestre el contador y que, al vencer, no permita aceptarla de nuevo automáticamente.
2. Con dueño autorizado y solo tras revisar pedido/caja/historial, comprobar recuperación manual y registro de responsable/motivo.
3. Realizar un pedido REAL con importe confirmado y aceptación única; verificar Neon Romo, historial, cobro, entrega y caja por los procedimientos aprobados.
4. Si falla una solicitud, no repetir ni cobrar sin conciliación manual.
5. No promover a producción hasta que caja, edición, permisos y recepción sean funcionalmente equivalentes a Uki.

Estado: preparado en código; NO validado manualmente; NO publicado a producción.
