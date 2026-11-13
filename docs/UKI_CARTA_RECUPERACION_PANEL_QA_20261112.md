# Uki · Recuperar solicitud con reserva vencida — QA, 12 noviembre 2026

Objetivo: que la dueña pueda liberar una reserva de una solicitud pendiente y vencida desde el panel **Pedidos** sin entrar a Neon, sin liberar otras solicitudes ni repetir ventas. Aplica a Uki Regimiento Arica y Uki La Serena. Se prepara para Romo cuando su sistema comercial esté habilitado.

## Reglas

- El servidor verifica **JWT Firebase Google firmado**, correo verificado, proveedor Google y un **UID incluido en la lista exclusiva de dueños** definida en la variable cifrada `UKI_CARTA_RECUPERAR_OWNER_UIDS`. No sirve el token del QR del trabajador, PIN ni el permiso genérico de atención.
- Solo se activa si `UKI_CARTA_RECUPERAR_RESERVAS_ENABLED=true` en **producción**. Por defecto desactivado; no hay permiso ni publicaciones comerciales en esta preparación.
- Se requiere: solicitud con `estado='pendiente'`, `pedido_interno=''`, token de reserva aún activo, `reserva_hasta<NOW()`. El tiempo por sí solo NO elimina reservas.
- Debe revisarse el historial de pedidos **incluyendo cancelados**, caja y otros dispositivos. El almacenamiento operativo Uki usa cifrado y **el servidor de solicitudes no puede verificar por sí mismo el contenido de una venta cifrada**. Por ello exige comprobación local sin vinculación, confirmación expresa y motivo obligatorio (5–200 caracteres) por parte de la dueña.
- Una única actualización SQL condicional libera solo `reserva_token_hash` y `reserva_hasta`, actualiza la marca de tiempo y añade una entrada de auditoría en `datos.recuperaciones` con UID, motivo y fecha. Se conservan estado, cliente, WhatsApp, importe, histórico de responsable, caja, pagos y timbres.
- Si otra sesión reservó, aceptó o modificó la solicitud, o si la reserva no había vencido, retorna conflicto y NO fuerza un desbloqueo.
- El panel muestra la opción solo tras verificar el permiso de dueña por el servidor mediante la sesión Google, y solo sobre reservas realmente vencidas. Antes de actuar reconsulta Neon y verifica en la copia sincronizada de Uki que no esté registrada.
- Una vez liberada, el pedido original permanece pendiente para aceptar/rechazar normalmente. No se crea una nueva venta.
- Implementación de Romo queda pendiente en su rama de integración aislada, no mezclar estas rutas/credenciales con Uki.

## Pendiente

No se ha desplegado ni habilitado la función. Antes de publicar, probar en iPhone con dos sesiones, revisar el estado cifrado más reciente y verificar el historial de caja por sucursal. Requiere autorización expresa de la dueña para producción.

## Panel

En el mismo `firebase/uki-carta-remotas-panel.js`, solo una reserva vencida y con Google de dueña recibe el botón **Recuperar solicitud**. Se pide motivo y confirmación explícita de revisión de caja, historial y otro dispositivo; a continuación se ejecuta PATCH protegido y se actualiza la bandeja. No se añadió pantalla adicional.

## Corrección solicitada: panel normal y personal
La opción **Recuperar solicitud** se muestra dentro de Pedidos → Carta digital en el panel habitual, al personal autenticado de la sucursal con su acceso existente (Google o QR firmado y activo). No se requiere panel de dueños. Exige nombre del responsable, motivo, verificación de caja/historial y autorización del servidor, dejando UID, fecha y motivo registrados. Esta decisión sustituye la referencia anterior de «solo dueños». Se mantiene únicamente en pruebas y sin publicación comercial.
