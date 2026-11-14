# Integración Romo · recepción en la misma bandeja (14-11-2026)

Esta actualización crea en la rama Preview de Romo el endpoint `/api/romo-solicitudes-carta-qa` y lo muestra en **Pedidos**, bajo la misma sesión Google del panel. Una solicitud no es venta, no suma caja, no genera timbre ni pedido hasta aceptación cifrada confirmada. El pedido manual #1 permanece intacto.

- GET: lectura exclusiva de dueños desde la propia base `romos_sushi`, flag `ROMO_SOLICITUDES_LECTURA_QA_ENABLED`. La vista limpia la memoria al salir.
- PATCH: el motor recuperado permite reservar, rechazar o aceptar una solicitud y registrar la misma copia cifrada con CAS en Neon; sigue cerrado con `ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED` y requiere rol de dueños.
- POST: preparado exclusivamente para el origen exacto de la carta Romo; sigue CERRADO con `ROMO_SOLICITUDES_PUBLICO_QA_ENABLED`, requiere `ROMO_SOLICITUDES_RATE_SALT` y no registra ventas automáticamente.
- La ruta usa solo las credenciales Neon del proyecto Romo, con rol lector para GET y rol escritor restringido para PATCH/POST; nunca URLs, usuarios o datos de Uki.
- No se modifican valores de caja, timbres, precios, cierres, pedidos existentes ni registros productivos. La aceptación seguirá cerrada hasta integrar la carta y realizar la única prueba integral manual autorizada.

Pendiente de conexión: permitir aceptación y edición desde el **mismo formulario de Uki** con las reglas de armado/delivery, previa confirmación de clave y estado. No publicar la carta para clientes mientras siga cerrada la recepción pública.
