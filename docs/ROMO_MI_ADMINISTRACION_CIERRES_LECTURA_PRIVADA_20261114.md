# Mi Administración: consulta privada de cierres Romo (Preview)
El panel de dueños de la rama Preview muestra una tarjeta de cierres confirmados de Romo separada de los totales de Uki. La API `/api/romo-cierres-duenos-consulta-qa` exige: (1) cuenta Google con rol *dueños* en Neon Romo; (2) sesión PIN financiera existente y vigente, confirmada desde el servidor mediante acción `estado` del servicio oficial de Mi Administración; (3) origen exacto de Preview y (4) bandera independiente de solo lectura. Se leen únicamente las constancias atómicas de Romo, nunca datos del cliente, ni pedidos cifrados, ni importes declarados por el navegador.

Los cierres se etiquetan **pendientes de incorporación contable**. No entran en las cifras generales hasta completar una importación autorizada e idempotente a la base financiera bajo el PIN de dueños. No se incluyen en `fin_movimientos`, que duplicaría ventas, y no se modifica el endpoint de administración en producción. Si PIN expiró o el servicio no está disponible, la consulta falla cerrada. No se activa sincronización financiera automática en esta etapa.

El equipo debe realizar una única prueba manual integral desde la carta hasta la constancia, luego consultar Mi Administración privada y corroborar el mismo turno antes de activar la contabilización.


## Continuidad: clave idempotente expuesta en lectura privada
La respuesta autorizada ahora incluye `source_key` para cada cierre Romo, validada contra `romo:serena|<turno_ref>` y contra duplicados en la respuesta, más `estado_contable: pendiente_incorporacion`. Esto **no suma las ventas** ni concede acceso adicional: se siguen exigiendo Google dueño, PIN financiero vigente, entorno Preview y origen permitido. La tabla/servicio de importación contable idempotente aún debe diseñarse y validarse contra la base comercial, con una única fuente por turno. No se ha realizado ninguna modificación en Neon.
