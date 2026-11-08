# Uki Sushi · Auditoría de pedidos únicos (7 noviembre 2026)

**Alcance:** prueba y revisión técnica, no producción. No modificar carta pública, caja, pedidos existentes, cierres, timbres, inventario ni accesos. No desplegar sin autorización expresa.

## Evidencia revisada

- Panel de pruebas: `feature/uki-evitar-duplicados-carta-manual-2026-11-07`, `firebase/uki-sushi-local.html` y `firebase/uki-carta-remotas-panel.js`.
- API de carta de prueba: repositorio `uki-sushi-respaldo`, archivo `api/carta-solicitudes-live.js`.
- El ingreso inicial en Neon es idempotente por `request_key` con `ON CONFLICT(request_key) DO NOTHING`; esa unicidad es solo de la **solicitud**, no constituye por sí sola garantía de venta única en Firebase.
- Los controles actuales revisan `S.pedidos`, `S.solicitudesWhatsApp` y la bandeja remota; son correctivos de interfaz y pueden trabajar con vistas locales desactualizadas.
- Al guardar un pedido nuevo se añade a `S.pedidos` y la confirmación de la solicitud Neon se hace **después**, cuando Firebase comunica que el respaldo quedó sincronizado. El `PATCH` Neon tiene una transición condicional `WHERE estado='pendiente'`, pero ejecutarla después del registro local deja una ventana de carrera entre dispositivos.
- La nube operativa Firebase utiliza revisión de manifiesto y `runTransaction` para evitar sobrescribir otra revisión silenciosamente; sin embargo el estado local puede mostrar un pedido nuevo antes del respaldo confirmado, y un conflicto requiere conciliación. No debe interpretarse el aviso local como confirmación final compartida.
- Otra limitación: comparar solo `codigoCarta` por sucursal en todo `S.pedidos` puede bloquear un pedido legítimo cuando se reutiliza un código corto en otra fecha. La solicitud remota ya ofrece `id` UUID específico; conservar ese identificador es prioritario.
- Los pedidos sin folio y pegados manuales requieren una política explícita de coincidencia (origen, sucursal, cliente/teléfono, mensaje normalizado y periodo), además de revisión humana para casos dudosos.

## Regla objetivo, sin crear otra caja ni otra pantalla

1. La carta o WhatsApp crean una **solicitud pendiente**, no una venta.
2. La identificación primaria de un pedido de la carta es `branch + cartaSolicitudRemotaId` (UUID); nunca usar un folio de tres dígitos como identidad permanente.
3. Antes de convertir una solicitud en venta, usar una exclusión mutua **central y atómica** basada en la identidad primaria. Dos dispositivos no deben poder obtener dos autorizaciones de registro para la misma solicitud. No utilizar la sola comprobación de memoria local como candado.
4. La confirmación definitiva al agendador debe requerir éxito del guardado compartido (Firebase). Si la reserva existe pero la nube falla, NO marcar exitoso, NO sumar una segunda venta y exponer conciliación segura del registro pendiente (sin liberar automáticamente reservas inciertas y sin borrar históricos).
5. La transición en Neon a `aceptada` debe ocurrir tras identificar el pedido confirmado, con capacidad de reintento idempotente.
6. Al intentar `Pegar WhatsApp` o `Nuevo pedido`, avisar y enlazar a la solicitud original; un folio potencialmente repetido entre días no puede bloquear automáticamente otro pedido.
7. Conservar formulario actual: pagos mixtos de productos y reparto, cobros cruzados entre locales, propinas, timbres, retiro/consumo/delivery, historial, caja y cierres sin cambios funcionales.

## Pruebas de aceptación obligatorias en entornos aislados

- Dos dispositivos aceptan la misma solicitud simultáneamente: una única venta persistida y una única referencia de origen; el segundo ve aviso claro.
- Una solicitud automática aparece en Pendientes y el mismo WhatsApp se intenta pegar manualmente: una única venta.
- Un pedido ya aceptado vuelve a enviarse: abrir el original, sin incrementar ventas/caja/timbres.
- Una solicitud rechazada conserva motivo y detalle sin crear venta ni alterar caja.
- Un código corto se repite en otro día con un cliente distinto: no bloquear el pedido válido solo por el número.
- Un mismo código se recibe en dos sucursales: no mezclar sucursales.
- Conflicto o pérdida de conexión durante el guardado compartido: no declarar éxito, no inventar pedido, conservar posibilidad de conciliación y no duplicar al reintentar.
- Pedido de mesa y pedidos manuales legítimos sin UUID siguen funcionando.
- Revisar exactitud de pagos mixtos, cobros en otro local, reparto, descuentos, propinas, timbres y reporte/cierre después de la modificación.

## Puerta de publicación

No proclamar protección total sin pruebas de simultaneidad y recuperación ante errores en QA aislada. Coordinar cambios de panel y backend antes de cualquier despliegue. **Producción y datos reales quedan intactos.**


## Avance verificable posterior (7 noviembre 2026, QA únicamente)

- **Servidor de carta, desarrollado en rama de pruebas:** 
  - Código \`lib/uki-carta-registro-unico.cjs\`: reserva de un único agendador por sucursal+UUID; reintento del mismo token; confirmación idempotente posterior al registro.
  - API \`api/carta-solicitudes-live.js\`: nueva acción autenticada \`reservar\` y confirmación protegida, exclusivamente si se activa el flag \`UKI_CARTA_REGISTRO_UNICO_ENABLED=true\`.
  - Migración aditiva **NO ejecutada** \`migrations/2026-11-07-uki-carta-registro-unico-qa.sql\` para registro único central.
  - GitHub Actions QA **aprobó las seis pruebas** en \`https://github.com/diannaleandra-art/uki-sushi-respaldo/actions/runs/42428654776\`.
- **Panel de pruebas:** rama \`feature/uki-evitar-duplicados-carta-manual-2026-11-07\`, con reserva previa a \`S.pedidos.push\`, token almacenado en pedido para enviar confirmación tras sincronización de nube y prioridad del UUID real ante folio corto. GitHub Actions QA aprobado: \`https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/42428786622\`.
- **Sin publicación de producción ni migración de Neon.** Estas dos ramas se deben validar juntas con el flag apagado primero y activarlo solo tras desplegar tabla, backend y panel compatibles.
- **No afirmar protección total aún:** faltan pruebas integradas entre dos navegadores reales, persistencia Firebase y API Neon en QA aislado; recuperación/conciliación de reservas que se interrumpan; identificación definitiva de mensajes pegados sin UUID. No eliminar bloqueo por timeout sin verificar la nube.
- **Coexistencia con cambios históricos:** antes de encender el flag, conciliar solicitudes pendientes que ya tienen un pedido guardado pero no contienen \`cartaReservaToken\`; jamás bloquearlas ni crear ventas duplicadas.
