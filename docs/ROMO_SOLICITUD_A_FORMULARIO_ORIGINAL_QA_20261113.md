# Romo · Abrir solicitud de carta en Nuevo pedido del panel original (QA)

13 de noviembre de 2026. Continuación de la integración como tercera sucursal del MISMO panel Uki, sin publicar.

- La tarjeta de «Pedidos → Solicitudes de la carta · Romo La Serena» recibe **Aceptar y revisar** únicamente en la rama Romo y con el interruptor de bandeja activado. Una solicitud reservada en otro equipo no abre el botón.
- El botón NO acepta la solicitud, no crea ventas ni envía comprobantes. Valida tienda, UUID, estado pendiente, sucursal «Romo’s Sushi La Serena», folio, cliente, teléfono, formato del WhatsApp y exclusión de duplicados incluso cancelados.
- El mensaje propio de Romo se convierte en un borrador con los mismos campos del formulario **Nuevo pedido** existente: productos y cantidades, armado completo por roll, observaciones, modalidad, valor de delivery y medio de pago indicado. Se conservan como texto original para revisión.
- **Nunca presume que el pago está hecho**: \`pagado=false\`, \`cartaReservaToken=''\`, sin cambios a \`S.pedidos\` ni caja. Como el cliente no aporta precios individuales verificables, todos los precios de ítems quedan \`0\` para que el trabajador confirme los importes con el catálogo vigente antes de guardar, y no se permite la confirmación automática en esta etapa.
- Al abrir, la pantalla existente guarda primero un borrador anterior si lo hay, comprueba que la sesión privada Romo esté abierta y no bloqueada, y rechaza solicitudes ya registradas. No emplea los endpoints Uki ni nuevos formularios.
- La rama Romo sigue sin habilitar escritura, aceptación, caja, cifrado en vivo ni ventas. \`ROMO_PANEL_BANDEJA_HABILITADA_QA=false\` y \`ROMO_RUNTIME_HABILITADO_QA=false\` permanecen apagados. El botón de Guardar de Romo continúa protegido hasta completar la reserva central, el guardado cifrado y la confirmación del mismo pedido.
- Antes de activar: enlazar la reserva remota Romo al Guardar original sin usar el método Uki; guardar exactamente una revisión cifrada con deduplicación y conciliación ante respuesta perdida; impedir doble guardado automático; prueba de dos iPhone y autorización de publicación.
