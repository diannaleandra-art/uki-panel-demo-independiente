# Romo La Serena — preparación inicial cifrada con acción de dueños (14/11/2026)

Alcance: rama `preparacion/uki-romo-sobre-main-20261114`; no se modifica `main` Uki, cartas comerciales, ni los datos de los dos locales Uki.

## Punto de partida (ya comprobado manualmente)
Google autorizado, contraseña habitual Uki La Serena vinculada a Romo, conexión de solo lectura autorizada. 0 estados operativos existentes y 1 comprobante de clave cifrada.

## Nueva acción explícita
Dentro de la misma pantalla de acceso Romo, desplegable **Solo dueños · Preparar estado inicial vacío de Romo**. Usa la contraseña habitual ingresada arriba, sin volver a descargar archivos. Muestra dos confirmaciones nativas.

El cliente verifica la contraseña vinculada con Google, consulta el estado independiente (solo lectura), construye **estadoVacioSucursal** solo en memoria, sobrescribe los campos monetarios heredados de Uki a **base: 0 y cajaChica.inicial: 0**, valida el estado, y lo cifra localmente con el mismo AES-GCM/PBKDF2. La contraseña y el estado en claro jamás se envían al backend.

El endpoint `POST /api/romo-inicializar-vacio-qa` exige:
- preview y rama exacta; flag `ROMO_INICIALIZACION_DUENOS_QA_ENABLED` solo en esa rama;
- origen exacto; token Firebase Google firmado y rol `duenos` desde la tabla exclusiva de Romo;
- comprobante cifrado previo de acceso `uki:serena`;
- confirmación explícita, `expectedRevision=0` y sobre AES-GCM de Romo validado;
- lector `romos_app_service` y escritor limitado `romos_clave_alta_qa_20261114`; solo INSERT y SELECT de revision sobre `romo_estado_operativo_v1`.
- INSERT con `ON CONFLICT DO NOTHING RETURNING revision`; si ya se inicializó, error 409, nunca reemplazar datos.

**No se habilitan guardados operativos** `ROMO_ESTADO_CIFRADO_QA_ENABLED`, `ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED`, `ROMO_ESTADO_INICIALIZACION_QA_ENABLED` y `ROMO_OPERATIVO_ENDPOINT_QA` siguen apagados. El botón normal `Abrir sucursal` no inicia caja.

Esta preparación puede crear una sola fila cifrada exclusivamente si la dueña toca el botón y confirma ambas veces. No crea pedidos, ventas, turnos ni cierres.

## Comprobación pendiente
Propietaria desde iPhone de forma manual. No ejecutar pruebas automáticas ni registros simulados. Antes de solicitar confirmación comprobar el despliegue preview READY, la rama, los flags, y que el estado siga sin inicializar.
