# Romo · edición de productos en pedidos pendientes, igual a Uki

Comparación: el editor de pedidos de la versión oficial de Uki permite añadir y retirar líneas de productos antes de guardar. El editor Romo ya tenía cambio de nombre, cantidad, precio, detalles, delivery, responsable, motivo e historial, pero **solo dejaba editar el número original de líneas**.

Se extendió **esa misma edición existente** para permitir agregar o quitar líneas manteniendo el guardado cifrado CAS de Neon Romo, responsable y motivo obligatorios e historial de antes/después. Cada producto original mantiene su índice de procedencia; al quitar una línea, otra línea nunca hereda por error sus metadatos.

Controles conservados: solo pedido `Pendiente`, sin pago, sin propina, sin timbre, dentro del turno original abierto; sin alterar ID, folio, cliente, cobro ni caja. Las acciones solo se muestran en la pantalla de pedidos y requieren confirmación manual. No hay pedido automático ni función comercial ajena a Uki.

**Pendientes de paridad aún existentes:** edición de pedidos pagados/rectificaciones, diferentes modalidades y pagos QR, timbres con canjes, catálogo CRUD y la sincronización contable Mi Administración; no mostrarlos como funcionales antes de contar con guardado seguro confirmado.
