# Romo La Serena · edición pendiente del mismo panel

En la rama `preparacion/uki-romo-sobre-main-20261114` se incorporó un formulario de edición directamente en la tarjeta de pedidos Romo. No es un panel nuevo ni habilita la operación pública.

La operación reutiliza `prepararEdicionPendienteRomoQA` (ya existente), exige responsable y motivo y conserva la misma cantidad de productos. Puede modificar nombre, cantidad, precio unitario, detalle y delivery de un pedido pendiente **sin pago**, exclusivamente dentro de su turno original abierto. No cambia folio, código, cliente, caja, timbres ni pedidos cerrados. Historial con valores antes/después. La actualización aparece solo al confirmar la nueva revisión CAS cifrada de Neon Romo.

Pendiente de verificación manual en Safari: apertura de turno, edición, bloqueo ante pago/cierre, simultaneidad de dos teléfonos e historial recuperado. No se realizaron pedidos o cambios reales de prueba. Uki oficial y carta comercial no se modifican.
