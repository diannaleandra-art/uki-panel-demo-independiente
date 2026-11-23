# Romo Sushi La Serena — piloto de supervisión WhatsApp (23 noviembre 2026)

## Objetivo
El número de WhatsApp Business de **Romo Sushi La Serena** se mantiene en el celular y WhatsApp Web de la agendadora. **Mi Administración** consulta mensajes que efectivamente recibe el proveedor, genera alertas preliminares para revisión de dueños y, más adelante, compara contra pedidos reales verificados. No se configuran respuestas automáticas por API ni se envían mensajes desde este módulo.

## Proveedor evaluado: PipesBot BYON (API v2)
- Según su documentación pública del 23/11/2026, plan Pro US$12/mes más US$5/mes por número BYON. **Piloto: desde US$17/mes**, sin impuestos ni cargos adicionales. Para 3 números, si comparten el mismo plan Pro: desde **US$27/mes**. Confirmar precios actuales, límites y facturación antes de pagar.
- El proveedor habilita **Coexistence** mediante incorporación oficial de Meta. El número no debe migrarse ni desvincularse de WhatsApp Business.
- Las respuestas que envía la agendadora en la aplicación Business siguen gratuitas; la API no envía respuestas.
- Algunas respuestas desde clientes vinculados no están garantizadas, principalmente WhatsApp para Windows; comprobar WhatsApp Web del navegador. Nunca declarar «sin responder» únicamente por un eco ausente.
- El alta puede desvincular la sesión de WhatsApp Web; puede ser necesario escanear el QR nuevamente. Preparar un horario de poco movimiento para la prueba.
- La vinculación necesita la aprobación del dueño con cuenta Meta y WhatsApp Business. **No pagar ni conectar sin aprobación**.

Referencias: https://docs.pipes.bot/docs/byon/coexistence
https://docs.pipes.bot/docs/byon/billing
https://docs.pipes.bot/docs/webhooks/security
https://docs.pipes.bot/docs/webhooks/payload

## Preparación técnica terminada en rama de pruebas
- `lib/uki-whatsapp-pipes.cjs`: valida que el mensaje sea de la sucursal del piloto, recibe entradas y ecos, ignora otros locales.
- `api/uki-whatsapp-pipes-webhook.mjs`: Web Request API (bytes originales), firma Standard Webhooks HMAC SHA256, tolerancia de tiempo 5 minutos, registro cifrado e idempotente en tabla privada. No contiene ningún envío.
- `tests/uki-whatsapp-pipes.test.cjs`: test con entradas, ecos, firma, reintentos caducados, sucursales y clientes sin número (BSUID).
- `public/mi-administracion-duenos.html`: módulo de lectura con Romo seleccionado por defecto.
- Los permisos de dueño dependen de Google y PIN. La tabla fue definida por migración pero **no aplicada**. No hay número real conectado y no se han recibido conversaciones.

## Configuración pendiente — sólo después de aprobar los costos
1. Revisar el plan y condiciones del proveedor, comprobar que el número sea elegible para Coexistence.
2. Habilitar el endpoint de pruebas con dominio de prueba accesible y SSL. No utilizar producción durante validaciones.
3. Aplicar migración en la base QA privada con respaldo comprobado.
4. Definir secretos sólo en Vercel, nunca enviar tokens ni contraseñas por chat: `UKI_WA_PIPES_WEBHOOK_SECRET` (whsec_), `UKI_WA_ENCRYPTION_KEY` (32 bytes base64), `UKI_WA_PIPES_NUMBER_MAP_JSON` (por ahora sólo `pn_...:romo:serena`), `UKI_WA_SUPERVISION_ENABLED=true` y `UKI_WA_PIPES_ENABLED=true`.
5. En PipesBot crear App BYON **v2** (no un número sandbox), configurar webhook firmado y activar **Forward messages sent from the phone**. Deshabilitar `Import chat history` y `Import contacts` inicialmente para minimizar datos.
6. El dueño realiza alta Meta/QR desde WhatsApp Business de Romo. Prohibido elegir migración del número existente.
7. Volver a vincular WhatsApp Web si fuera necesario; comprobar atajos `/hola`, `/carta`.
8. Probar desde un número propio: mensaje entrante de pedido, respuesta rápida desde celular, respuesta rápida desde WhatsApp Web, cambio de pedido y reclamo. Verificar que cada evento llegue una sola vez con hora correcta.
9. Comprobar costo real y consumo Meta en el portal, que **no existe llamada de envío por API**.
10. Completar vínculo seguro con pedido real, alertas verificables, política de conservación y revisión de privacidad con las trabajadoras. No publicar hasta completar QA.

## Regla de seguridad
Si una respuesta enviada desde WhatsApp Web no aparece en la API, mostrar «cobertura parcial» y nunca marcar automáticamente una falta de atención ni acusar a una trabajadora. Las conversaciones requieren manejo limitado a fines laborales y protección de datos personales.

## Estado
**Código preparado en rama QA, sin despliegue, sin proveedor contratado, sin vinculación real, sin publicación.**
