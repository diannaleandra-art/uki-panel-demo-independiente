# Revisión manual de transferencias · Romo

Estado: implementación para revisión, sin publicar. Se comprobó sintaxis; los siguientes recorridos manuales todavía no se ejecutaron porque el navegador de revisión no estuvo accesible. No se ejecutaron suites automatizadas.

## Alcance

El pedido puede registrarse pendiente y aceptarse antes de recibir el pago. Para confirmar un pago con transferencia se pide revisar el abono en la cuenta, escribir el importe transferido y el responsable, y marcar una confirmación expresa. El número de operación es opcional; si se informa, no puede reutilizarse en otro pedido de Romo, aunque ese pedido esté cancelado o la revisión figure en su historial.

La revisión corresponde únicamente al importe local de transferencia en productos, delivery y propina del pedido. Los pagos en efectivo, tarjeta y otros locales no se incluyen en ese importe. El panel no consulta Santander ni genera un enlace bancario.

Una revisión guarda `transferenciaVerificacion` con versión, tipo manual, monto, responsable, fecha, referencia y firma de distribución. Las anteriores permanecen en `historialTransferencias`; esos registros no suman dinero. Editar importes o medios invalida la revisión anterior sin quitar el pago registrado ni borrar las diferencias financieras. Si esa corrección afecta un pedido entregado, vuelve a Pendiente cuando queda diferencia o revisión por resolver, y conserva su entrega anterior en la auditoría.

La entrega/finalización exige la revisión vigente de la transferencia y que no haya diferencias de cobro pendientes. El cierre de caja/turno conserva sus reglas anteriores.

## Entorno manual aislado

Se preparó una copia temporal del HTML del panel con cinco pedidos ficticios, los controles reales y los módulos puros reales. Tiene una política de contenido que bloquea conexiones, `fetch` y almacenamiento sustituidos por memoria, y carece de scripts de autenticación. No prueba permisos, red, cifrado ni CAS del servidor. El adaptador de persistencia solamente incrementa una revisión en memoria y no representa una conexión a Neon.

La copia temporal pertenece al entorno de esta sesión y no forma parte de la publicación. Para repetir la revisión, preparar una copia aislada del HTML y de sus módulos desde esta rama, con datos ficticios y conexiones bloqueadas. Regenerarla cuando cambie el código.

## Recorridos pendientes

| Caso | Acción manual | Resultado esperado |
| --- | --- | --- |
| Transferencia sin revisar | Pedido 1: intentar confirmar pago o entregar sin revisión. | No cambia pago ni entrega; aparece la falta de revisión. |
| Importe incorrecto | Escribir un importe distinto del transferido y marcar revisión. | La casilla no queda confirmada y se explica el importe esperado. |
| Revisión completa | Escribir importe exacto, nombre, número de operación opcional y marcar revisión; confirmar el cobro. | Un solo pago, responsable y fecha visibles; una revisión manual vigente. |
| Pago mixto | Pedido 2: repartir $6.000 en efectivo y $4.000 en transferencia. | Se pide revisar $4.000. Confirmar $10.000 como transferencia se rechaza. |
| Actualización de formulario | Cambiar medio, monto mixto, delivery, pago externo o propina después de revisar. | La revisión deja de estar confirmada; los campos siguen visibles con el importe actualizado. |
| Persistencia de campos | Escribir nombre y número de operación; navegar y volver o provocar un render sin cambiar el pedido. | Se conservan los campos en la sesión; no se confirma una distribución diferente. |
| Pago antiguo | Pedido 3: revisar un pago ya registrado. | Se guarda la revisión en el mismo pedido; no suma otra venta, cobro, propina ni timbre. |
| Operación duplicada | En otro pedido, usar `DEMO-OPERACION-4`, ya usada en el pedido 4. | Rechazo antes de guardar. Repetir con una referencia conservada en historial o un pedido cancelado debe seguir rechazándose. |
| Edición de entregado | Pedido 4: aumentar precio y guardar como responsable identificado. | Conserva dinero recibido, deja diferencia pendiente, invalida revisión y reabre el pedido. |
| Volver al importe anterior | Tras una edición, volver a los importes previos por la vía permitida. | La revisión invalidada no se reactiva automáticamente; requiere otra revisión manual. |
| Regularización | Resolver diferencia y volver a revisar transferencia. | Puede finalizarse el pedido cuando el pago, la revisión y las demás reglas existentes se cumplen. |
| Efectivo | Pedido 5: entregar conforme a las reglas existentes. | No pide revisión de transferencia. |
| Nuevo borrador | Usar “Nuevo borrador ficticio”; elegir transferencia y pago confirmado. | Exige revisión expresa antes de guardar pagado; puede guardarse pendiente sin inventar un cobro. |
| Cierre de caja | Consultar las reglas y formularios de cierre existentes. | No aparece un bloqueo de caja nuevo por transferencias; se conservan los bloqueos anteriores de diferencias. |

## Verificación posterior en preview autorizado

Pendiente confirmar visualmente en móvil y escritorio, y verificar la persistencia cifrada/CAS con una base de datos de prueba aislada. No usar datos ni dinero reales. La fixture no sustituye esas comprobaciones. La aceptación desde carta conserva su operación atómica previa; solo propaga la revisión cuando se guarda un pedido ya pagado. El botón ahora dice “Revisar y aceptar pedido” y no promete generar un enlace.
