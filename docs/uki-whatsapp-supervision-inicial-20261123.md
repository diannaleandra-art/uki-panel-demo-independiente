# Preparación · Supervisión de WhatsApp de solo lectura · 23/11/2026

## Objetivo aprobado
Mostrar en **Mi Administración** conversaciones de trabajo de **Uki Regimiento Arica, Uki La Serena y Romo Sushi La Serena**, detectar posibles pedidos sin verificar, cambios y reclamos, y comparar diferencias con pedidos únicamente si el vínculo con un pedido real fue confirmado.

**La agendadora sigue respondiendo desde WhatsApp Business del celular y WhatsApp Web.** No hay chatbot, autoenvíos, plantillas, respuestas por API ni límite de mensajes que habilite un autoenvío accidental. Los saludos y la carta digital se configurarán posteriormente con las herramientas gratuitas de WhatsApp Business, si se decide.

## Estado de esta rama
- Agregado receptor de webhooks **firmados** por Meta, desactivado por defecto.
- Distingue `messages` entrantes y `smb_message_echoes` (`message_echoes`) enviados desde la app.
- Los mensajes de texto se guardarán cifrados (AES-256-GCM); cliente identificado con hash y 4 últimos dígitos. Se ignoran adjuntos y no se descargan archivos privados.
- Registro idempotente por sucursal + identificador del mensaje.
- Vista privada de solo lectura, con Google + PIN de dueños y filtro de las tres sucursales.
- Reglas de alerta **provisional**: posible reclamo, posible cambio, posible pedido. Una alerta no atribuye culpa.
- Comparación 60 vs. 36 piezas implementada como función aislada que exige asociación verificada a un pedido; **no enlazada aún al panel de pedidos**.
- No se ha ejecutado la migración, no hay números conectados, no hay información real sincronizada, no se ha publicado.
- No se incorporó un modelo externo de IA ni un gasto por consumo de IA: primero probar reglas claras y baratas.

## Orden de implementación confirmado
1. **Romo Sushi · La Serena**: primer piloto y primer número que se conectaría.
2. **Uki Regimiento Arica**: segundo, después de probar Romo.
3. **Uki La Serena**: tercero, después de validar los dos anteriores.

No conectar ni publicar números sin confirmar antes que WhatsApp Business y WhatsApp Web siguen funcionando.

## Antes de conectar cualquier número
1. Hacer una prueba de coexistencia oficial con **un número**, confirmando que la agendadora conserva el celular, sus respuestas rápidas y WhatsApp Web; confirmar las condiciones económicas del proveedor.
2. Verificar en pruebas la recepción de mensajes de clientes y los ecos de respuestas desde el dispositivo que usa la agendadora. Puede haber ecos faltantes de dispositivos vinculados: **nunca marcar "sin contestar" sólo por ausencia del eco**.
3. Probar que el endpoint no contiene métodos de envío ni usa la API de Meta para responder.
4. Aprobar el aviso interno y controles de privacidad: acceso exclusivo de dueños, finalidad laboral, mínimo contenido necesario, informes sin exposición de teléfonos y protección de datos personales.
5. Configurar de manera privada, **nunca en GitHub**, `UKI_WA_SUPERVISION_ENABLED`, `UKI_WA_VERIFY_TOKEN`, `UKI_WA_META_APP_SECRET`, `UKI_WA_ENCRYPTION_KEY` (32 bytes en base64), `UKI_WA_PHONE_MAP_JSON` (ID de teléfono de Meta a clave de sucursal). Reutilizar únicamente la base privada QA de Mi Administración, sin apuntar a la base de pedidos.
6. Revisar si Vercel entrega **bytes originales de webhook** para HMAC. Rechazar peticiones si el body se transformó o si falta la firma, hasta confirmar el comportamiento del despliegue.
7. Ejecutar la migración **sólo en QA**, hacer pruebas manuales con mensajes autorizados y validar duplicados, roles, cifrado, cobertura y ausencia de envíos.

## Pendiente para la supervisión real
- Integrar lectura segura de los pedidos operativos de cada sucursal, con vínculo explícito por número/código y comprobación humana, sin modificar ni crear pedidos.
- Diseñar una cola de incidencias verificables y métricas de conversaciones sin inferir falsos errores.
- Política de retención: mostrar los últimos 35 días por ahora. **No borrar datos** hasta comprobar el respaldo mensual y el procedimiento de conservación acordado. El almacenamiento real todavía no tiene purga habilitada.
- Pruebas manuales end-to-end y publicación única agrupada, sólo después de autorización.
