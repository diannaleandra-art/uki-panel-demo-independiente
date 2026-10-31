# Uki Sushi · Preparación operativa (SIN ACTIVAR)

Esta rama contiene una **copia separada** del panel v8.15 para Regimiento Arica y La Serena. No es el menú público ni el panel NUBE QA.

## Alcance

- `operativo/panel-local.html`: misma interfaz de pedidos, caja, cierres, timbres, gastos y respaldos, con acceso directo a la sucursal desde un enlace, y aviso de estado de sincronización.
- `operativo/uki-autoguardado.js`: elimina el máximo de 10 guardados por sesión de QA; mantiene guardado diferido, deduplicación de cambios y parada ante errores o revisiones concurrentes.
- `operativo/uki-snapshot.js`: **usa exclusivamente la colección nueva `uki_operacion_v1`**, no `uki_sucursales` de las pruebas.
- Almacenamiento del navegador: `uki_operativo_v1_cifrado_` (no comparte datos ni sobrescribe el de QA).
- `UKI_OPERACION_HABILITADA=false` bloquea carga, guardado y uso del panel para la operación; **no cambiar a true antes de las validaciones y autorización expresa de lanzamiento**.

## No se ha hecho

1. No se han modificado las reglas activas de Firebase: la colección nueva no está habilitada.
2. No se han ejecutado pruebas reales de lectura/escritura en `uki_operacion_v1`.
3. No se ha publicado esta ruta en GitHub Pages: está solamente en la rama de preparación.
4. No se ha verificado sincronización con dos teléfonos ni el plan/posibles cargos de Firebase.

## Antes de lanzar

1. Incorporar la regla nueva **sin sustituir las reglas QA existentes**, validar permisos con cuenta autorizada y cuenta ajena; comprobar que lectura/escritura en cada sucursal sea la esperada.
2. Activar `UKI_OPERACION_HABILITADA` solo tras esa comprobación.
3. Probar una venta FICTICIA por sucursal en colección operativa nueva, confirmar guardado, actualizar, volver a cargar y hacer respaldo; eliminar datos de ensayo antes de recibir ventas reales.
4. Comprobar comportamiento ante 2 modificaciones simultáneas y recuperación segura; **un celular principal de escritura por sucursal** hasta completar esa validación.
5. Comprobar el crecimiento acumulado de snapshots (las generaciones cifradas antiguas no se borran automáticamente), límites/alertas de gasto de Firebase y contar con procedimiento alternativo (registro manual/WhatsApp) si falla Internet.
6. Publicar solo tras autorización explícita de la propietaria.

## Enlaces previstos DESPUÉS de autorizar publicación

- Regimiento Arica: `/operativo/panel-local.html?sucursal=regimiento`
- Uki La Serena: `/operativo/panel-local.html?sucursal=la-serena`

Los enlaces se refieren a la misma aplicación: solo preseleccionan una sucursal, no son una barrera de permisos. No son enlaces operativos hasta la publicación definitiva. No enviarlos todavía al personal.

## Corrección en pagos y fidelización

Los pedidos nuevos quedan **pendientes de pago** por defecto; requieren confirmación al marcar pagados. Solo los pagos confirmados incrementan ventas y timbres, y revertir un pago elimina ese movimiento. No se modificó el panel habitual.

## Uso previsto tras lanzamiento

Los locales pueden iniciar sesión con la misma cuenta Google dedicada a Uki Sushi, introducir la contraseña local de la sucursal y la clave cifrada de la nube. Las credenciales **no deben ponerse en GitHub**. Quien use esa cuenta podrá operar ambas sucursales (no hay auditoría por trabajador).

Si aparece **error**, **conflicto**, **sincronización detenida** o **pendiente**, no confiar en que el registro ya esté en Firebase: conservar el teléfono y guardar un respaldo. No restaurar un respaldo antiguo sobre registros recientes.

El panel no envía mensajes reales por WhatsApp; esa acción está desactivada en esta copia.
