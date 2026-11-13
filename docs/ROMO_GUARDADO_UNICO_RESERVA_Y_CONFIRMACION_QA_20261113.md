# Romo · Guardar y aceptar en la misma pantalla Uki (QA, 13 noviembre 2026)

El panel único prepara la ruta completa para una solicitud de Romo con **reserva remota exclusiva → nuevo pedido del motor Uki → único guardado cifrado → comprobante firmado → aceptación en la bandeja Romo**.

## Lo incorporado en QA
1. `uki-romo-sesion-nube-qa.mjs` incorpora `reservar({id,claimToken})` y comprueba tienda, UUID, sesión activa y estado devuelto. Una reserva de otro teléfono devuelve 409, bloquea esa sesión y exige recargar.
2. `ndGuardar()` en el panel original deja de enviar solicitudes Romo a la API Uki: llama la reserva Romo antes de generar pedido y jamás interpreta una solicitud como pago confirmado.
3. Los productos de la carta Romo deben tener precio positivo validado por el trabajador. Si la solicitud está reservada y la respuesta se pierde, no se libera automáticamente; se exige conciliación.
4. El guardado del pedido Romo hace **una sola** escritura explícita del estado cifrado y, si viene de carta, usa `guardarYAceptar()`. La aceptación exige revisión y comprobante de servidor; si no se confirma, restaura la vista anterior y cierra la sesión para evitar duplicación antes de recargar. No se añade una segunda venta.
5. `guardarEnLocalStorage()` omite el guardado automático mientras `ndGuardar()` mantiene el bloqueo en Romo. Esto es imprescindible porque `aviso()` llama a `render()` y podría crear una escritura duplicada entre el pedido y su comprobante.
6. Un pedido Romo solo mostrará «guardado y confirmado» **después** de la respuesta satisfactoria. Uki conserva su ruta de Firebase y su secuencia habitual.

## Activación y barreras pendientes
- No activar `ROMO_RUNTIME_HABILITADO_QA=false`, `ROMO_PANEL_BANDEJA_HABILITADA_QA=false`, `ROMO_SOLICITUDES_CLIENTE_HABILITADAS_QA=false` sin pruebas con dos teléfonos, roles y caja.
- El componente original de pedidos se reutiliza; no se crea otra pantalla, otra clave ni se mezcla la base Uki.
- La tabla de solicitudes existe solo en la **rama Neon de pruebas**, no en la base principal Romo. Falta aprobación específica para migrarla.
- Falta demostrar el recorrido real en navegadores, con moneda, pago mixto, timbres y cierres, y resolver cualquier hallazgo antes de publicar la carta y activar ventas.
- No ejecutar migración SQL ni desplegar a producción solo por fusionar este código QA.
