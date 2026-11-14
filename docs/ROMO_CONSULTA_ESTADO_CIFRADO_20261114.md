# Romo — lectura de la primera copia cifrada desde Safari, 14-11-2026

La dueña confirmó en captura la primera preparación de estado vacío. La base Neon `romos_sushi` tiene `romo:serena` en `revision=1` con formato `uki-v813-browser`. La clave de Uki La Serena ya estaba vinculada, y la conexión Google/Neon ya se había verificado manualmente.

## Cambio: lectura real del cifrado, sin operaciones
En la misma pantalla de Romo se reutiliza el botón de lectura, ahora **Consultar estado cifrado de Romo**. Primero se valida Google de dueños y la contraseña vinculada mediante la consulta existente de solo lectura. Luego se obtiene el sobre AES cifrado vía GET `/api/romo-estado-cifrado-panel-qa`. El código del panel descifra exclusivamente en Safari con `abrirLocal` existente y valida la sucursal con `validarEstadoSucursal`. Se muestran únicamente revisión, cantidades de pedidos/cierres y los dos importes iniciales; no se abre `S.suc`, no se entra a los formularios y no se llama a guardado.

El endpoint estaba preparado con separación de datos y rol de Romo. Se habilitó **solo su GET**, mediante `ROMO_ESTADO_CIFRADO_QA_ENABLED=true` exclusivo a la rama Preview; `ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED` permanece ausente y por ello cualquier POST sigue rechazado. `ROMO_OPERATIVO_ENDPOINT_QA` permanece vacío y el adaptador de sesión sigue bloqueado. Ningún cambio en main ni en las dos sucursales de Uki.

## Verificación pendiente
Una sola comprobación manual desde iPhone después del despliegue. No repetir altas, no crear movimientos ficticios ni activar caja mientras no se confirme la recuperación de estado cifrado. Después conectar el guardado con control de revisiones y permisos de Romo, y adaptar los módulos del mismo panel de Uki evitando cualquier sincronización accidental a Firebase/Uki.
