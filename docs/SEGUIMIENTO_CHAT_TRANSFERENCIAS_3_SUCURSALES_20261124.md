# Seguimiento, chat y transferencias — alcance único para las tres sucursales
Fecha: 24-11-2026
Estado: EN PREPARACIÓN EN RAMA DE PRUEBAS. NO PUBLICADO, SIN CLIENTES NI BANCOS CONECTADOS.

## Regla confirmada por la propietaria
**Cada modificación funcional del seguimiento debe cubrir simultáneamente las tres sucursales:**
- `uki:arica` — Uki Regimiento Arica.
- `uki:serena` — Uki La Serena.
- `romo:serena` — Romo Sushi La Serena.

Romo es el primer lugar de pruebas, nunca una versión funcional exclusiva. El diseño y los criterios de aceptación deben ser equivalentes para las tres sucursales. Mantener datos, cobros, mensajes, accesos y tarjetas de cliente separados por identificador fuerte de sucursal. No copiar los números ni datos de cuenta Santander a otra sucursal automáticamente.

## Recorrido del cliente (mínimos pasos)
1. Hace el pedido por su carta digital. Recibe un enlace exclusivo para **Ver mi pedido**, sin registrarse ni instalar aplicaciones.
2. Si opta por seguimiento, abre el enlace para ver «solicitud recibida», «aceptado», «en preparación», «listo/en camino», «entregado», «rechazado/cancelado», según el estado guardado.
3. Si elige **Transferencia**, ver monto verificado y datos bancarios del local correspondiente sólo cuando estén confirmados por administración. Si falta cuenta bancaria verificada, no mostrar números ficticios ni permitir copiar.
4. Después de transferir toca **Ya transferí** una vez; el estado se vuelve «Transferencia por verificar», jamás «Pagada».
5. Cuando el agendador comprueba el abono en Santander o en la cuenta realmente definida para ese local, registra hora, monto y responsable. Entonces el cliente ve «Transferencia confirmada». Para pagos mixtos, se verifica solo el componente transferencia, pero el cobro total mantiene control de los demás medios.
6. Chat interno opcional **entre ese pedido y el panel**, independiente de WhatsApp Meta. Una entrada para cliente, una bandeja en el pedido para agendador, respuestas breves; sin alertas constantes ni abrir ventanas automáticamente.
7. Aviso sencillo: «Si quieres hacer seguimiento, conserva esta página abierta o guarda el enlace para regresar». Notificaciones push sólo por consentimiento y compatibilidad del dispositivo; nunca obligar a instalar ni aceptar avisos.

## Seguridad operacional
- La aceptación sólo se anuncia tras transacción persistida: no basta tocar «Aceptar y revisar».
- Pedido pendiente **no suma caja ni ventas confirmadas**.
- El cliente y las fotos de comprobantes **no confirman fondos recibidos**.
- El cierre/finalización normal de pedido con parte transferencia pendiente queda bloqueado. Rechazos, cancelaciones, devoluciones y rectificaciones tienen un procedimiento separado y auditado; no bloquear toda la caja global sin distinguir casos.
- Los mensajes del chat no cambian precios, estado de pago ni contenido de pedido.
- Enlace por pedido con token secreto no adivinable, mínimo de datos personales expuestos, límite de mensajes y control de identidad/sucursal. No usar código de tres cifras o WhatsApp completo como única autenticación.
- Sin cruces de datos entre sucursales y sin exponer identificadores de bases o credenciales en el cliente.

## Estado técnico comprobado en esta rama
- Núcleo compartido `lib/seguimiento-tres-sucursales-v1.cjs` y pruebas en `tests/seguimiento-tres-sucursales-v1.test.cjs`.
- Verificados mediante funciones puras los casos para las 3 sucursales, bloqueo de finalización, monto de pagos mixtos y aislamiento de datos bancarios.
- Se había empezado el prototipo exclusivo `lib/romo-seguimiento-transferencia-v1.cjs` y `api/romo-seguimiento-cliente-qa.js`; **no habilitar como solución definitiva**: necesita adaptarse al contrato compartido, persistencia del método de pago y el procedimiento de confirmación del servidor.
- Backend real diferente: Uki usa sus solicitudes de carta y estado de caja, Romo su aislamiento Neon. No compartir tablas ni autorizaciones por error.
- Todavía no está implementado el chat real, ni el enlace de seguimiento operativo en todas las cartas, ni la confirmación financiera por servidor para las tres. No existe sincronización Santander. No hay una publicación de estas funciones.

## Pruebas manuales antes de única publicación
Para cada local: pago total transferencia; pago mixto; efectivo sin mostrar banco; aceptar después de registrar; reenviar aviso sin duplicar; bloquear falsos positivos de comprobante; evitar finalizar transferencia pendiente; verificar autorización de la agendadora; cancelar/rechazar sin tocar caja; chat sin cambiar pedido; enlace inválido; caducidad/rotación; celular Safari y PC; desconexión sin pérdida; no mostrar bancos de otro local.
Realizar primero en Romo, después exactamente las mismas pruebas en las dos sucursales Uki. Sólo publicar **el lote conjunto** cuando todas sean correctas y se confirme costo/operación.
