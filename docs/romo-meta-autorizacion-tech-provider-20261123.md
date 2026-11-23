# Romo Sushi La Serena — preparación para autorización oficial de Meta
Fecha: 2026-11-23
Estado: PREPARADO, SIN ENVÍO NI APROBACIÓN DE META. SIN CONEXIÓN DEL NÚMERO.
Objetivo: supervisar conversaciones y contrastar con pedidos SIN responder por API, sin reemplazar WhatsApp Business ni WhatsApp Web y sin intermediarios mensuales.

## Acceso y requisitos de Meta (fuentes oficiales, verificadas 2026-11-23)
- Página de aplicaciones: https://developers.facebook.com/apps
- Convertirse en Tech Provider: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- Incorporar números existentes mediante Coexistence: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- Embedded Signup versión 4 (v2/v3 descontinuadas desde octubre 2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4
- Permisos y verificación Tech Provider: https://developers.facebook.com/docs/development/release/tech-providers/

## Paso A — Revisión de la cuenta empresarial (requiere inicio de sesión de la propietaria)
1. Entrar a https://developers.facebook.com/apps con la cuenta Meta administradora del negocio.
2. Revisar si ya existe una app empresarial para WhatsApp. No crear una segunda si hay una adecuada.
3. Revisar el Business Portfolio al que pertenece la app; confirmar que corresponde legalmente a la empresa propietaria del número de Romo.
4. Si no existe la app, crear una con el caso de uso WhatsApp y asociarla al portafolio empresarial.
5. En **Use cases > Customize > WhatsApp > Tech Provider onboarding** revisar estado de verificación empresarial. Meta solicita nombre, dirección, teléfono, correo, sitio web y posiblemente documentos oficiales. Estos deben ser aportados por el titular; nunca guardar identificaciones o secretos en GitHub.
6. Si la verificación está disponible y los datos son correctos, iniciarla en la consola. No afirmar que fue enviada o aprobada hasta confirmación visible de Meta.

## Paso B — Preparación para revisión de la app (posterior a verificación)
- Completar configuración básica: nombre coherente de la app, icono autorizado, categoría, dominio y política de privacidad real.
- Revisar permisos `whatsapp_business_management` y `whatsapp_business_messaging` con acceso avanzado si Meta los requiere.
- La revisión oficial exige **dos demostraciones**: envío de mensaje de prueba y creación de plantilla. Meta permite usar una demostración con número de pruebas/API Setup y WhatsApp Manager en lugar de habilitar envíos a clientes.
- Realizar estas demostraciones solo con recursos de prueba, nunca con el WhatsApp operativo de Romo.
- Solicitar App Review y luego Access Verification de Tech Provider según lo que muestre Meta. No anticipar aprobaciones.
- Configurar Embedded Signup versión v4 con registro de sesión, únicamente después de tener permisos aprobados.

## Paso C — Webhook y panel (ramal de desarrollo, todavía no publicado)
- El código de recepción de mensajes se encuentra en `api/uki-whatsapp-supervision-webhook.js`, modo **solo lectura** con bandera apagada.
- La vista privada está en `public/mi-administracion-duenos.html`, filtrada inicialmente a `romo:serena`.
- Los secretos se configuran como variables seguras en Vercel, nunca en código, documentación o mensajes de chat.
- Se requiere ensayar la firma de Meta (HMAC SHA256 sobre bytes originales) y el comportamiento del parser en Vercel, con eventos simulados y sin datos personales reales.
- Migración de tabla y conexión a datos reales **no ejecutadas**. No se debe activar la bandera antes de comprobar acceso y recepción.
- Los ecos de mensajes enviados desde WhatsApp Business podrían ser incompletos según dispositivo. La ausencia de respuesta recibida por webhook NO es prueba de que la agendadora no haya contestado.
- Comparación con pedidos operativos todavía pendiente; cualquier diferencia solo se mostrará tras comprobar vínculo entre conversación y pedido.

## Paso D — Vinculación del número (PROHIBIDO realizar hasta la aprobación y la autorización del titular)
- Comprobar compatibilidad de WhatsApp Business y país; conservar copia de seguridad de chats según las opciones reales de la app.
- Revisar efecto en WhatsApp Web; puede ser necesario volver a vincular dispositivos.
- Aceptación de Meta y código QR/código de verificación se completan por la administradora desde el teléfono de Romo.
- No compartir OTP, credenciales, tokens ni PIN en ChatGPT.
- Probar con una conversación autorizada sin respuesta API; comprobar entrada, eco, sucursal, duplicados, acceso privado y no alteración de caja/pedidos.
- Si hay pérdida de funciones o se requieren cargos no autorizados, detener conexión; preservar número y atención habitual.

## Presupuesto autorizado actualmente
- Sin proveedor comercial contratado, sin envío mediante Cloud API.
- Sin consumo de créditos de Make.
- Sin promesa de costo total cero: infraestructura en Vercel/Neon y análisis IA pueden tener cargos por consumo. Revisar antes de ampliar.
- La autorización como Tech Provider no implica garantía de aprobación ni un plazo específico.

## Próximo bloqueo real
Se requiere iniciar sesión en Meta Developers con la cuenta administradora del negocio para revisar si existe app/portafolio y si la verificación de Meta está iniciada. Esta sesión **no está disponible desde ChatGPT en este turno**. El usuario debe abrir la consola en su navegador; sin acceso autenticado no se puede crear ni presentar la solicitud en su nombre.

**No publicar esta rama ni cambiar el número de Romo antes de revisión y aceptación de todos estos puntos.**
