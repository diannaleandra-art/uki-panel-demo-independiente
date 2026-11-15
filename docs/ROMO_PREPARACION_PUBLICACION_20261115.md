# Preparación de publicación Romo — 15 noviembre 2026

## Cambios preparados

- Integrada la versión publicada `6939115` de Mi Administración: botón de actualizar, total informativo, control de duplicados y propinas conservados. Se conserva también la limpieza de la consulta al bloquear la sesión.
- Historial de edición: muestra delivery e ingredientes antes/después, usando los valores ya guardados; no modifica el pedido.
- Las conexiones operativas usan `lib/romo-entorno-panel.cjs`. Preview sigue restringido a la rama de preparación. Producción exige `main`, `ROMO_PANEL_PRODUCTION_ENABLED=true` y el origen exacto `https://uki-sushi-inventario.vercel.app`.
- Permanecen las banderas individuales de cada servicio, Google, roles, origen permitido, cifrado, revisión CAS y validación de la base Romo. El nuevo interruptor no concede permisos por sí solo.
- Alta inicial de claves e inicialización vacía permanecen exclusivas de Preview: se utiliza el estado existente, sin reinicializarlo.
- Mi Administración conserva por ahora el endpoint de Preview ya publicado. Migrar esa URL al endpoint público únicamente después de verificar su configuración y lectura autenticada; así este paquete no corta la consulta vigente.

## Configuración pendiente antes de activar producción

Inspección de nombres y ámbitos de variables de Vercel, sin leer secretos: producción tiene `ROMO_PRIVATE_DATABASE_URL`, `ROMO_PRIVATE_DATABASE_HOST`, `ROMO_PANEL_ALLOWED_ORIGIN`, `ROMO_DUENOS_GOOGLE_EMAIL` y `ROMO_DUENOS_VINCULO_ENABLED`. La presencia no confirma valores ni permisos efectivos.

Además del nuevo interruptor global, configurar en producción las banderas necesarias para acceso, estado, inventario, solicitudes, cierre, banner y consultas, conservando las autorizaciones actuales por operación:

- `ROMO_ACCESO_CLAVES_QA_ENABLED`, `ROMO_CONEXION_LECTURA_QA_ENABLED`, `ROMO_ESTADO_CIFRADO_QA_ENABLED`.
- `ROMO_PANEL_PILOTO_MANUAL_QA_ENABLED`, `ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED`.
- `ROMO_INVENTARIO_LECTURA_QA_ENABLED`, `ROMO_INVENTARIO_ESCRITURA_QA_ENABLED`, `ROMO_PIN_INVENTARIO_QA_ENABLED`.
- `ROMO_SOLICITUDES_LECTURA_QA_ENABLED`, `ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED`, `ROMO_SOLICITUDES_PUBLICO_QA_ENABLED`, `ROMO_CARTA_ALLOWED_ORIGIN`, `ROMO_SOLICITUDES_RATE_SALT`.
- `ROMO_CIERRE_QA_ENABLED`, `ROMO_CIERRES_DUENOS_LECTURA_QA_ENABLED`, `ROMO_CAJA_ACUMULADA_LECTURA_QA_ENABLED`.
- `ROMO_CATALOGO_LECTURA_QA_ENABLED`, `ROMO_BANNER_ESCRITURA_QA_ENABLED`.

Los nombres QA se conservan por compatibilidad; el entorno de Vercel delimita sus valores. No copiar variables de otras ramas, credenciales de alta privilegiadas, ni activar escritura de caja acumulada o sincronización contable pendiente. No se han cambiado variables en Vercel ni datos comerciales.

## Validación y límites

Revisión del diff y de sintaxis. No se ejecutaron pruebas automáticas ni se crearon pedidos. Sigue pendiente la comprobación manual autenticada: acceso, edición/historial, persistencia tras recarga, pedido/cobro/caja/cierre y consulta de dueños.

Este paquete resuelve la divergencia de Mi Administración y prepara las conexiones para producción; no acredita paridad completa con Uki. Permanecen pendientes el catálogo CRUD sobre la fuente real, las rectificaciones de pedidos pagados y la incorporación contable de cierres. La carta pública es otro proyecto y su conexión no se modifica automáticamente al publicar este repositorio.

La usuaria hará la publicación. No promover la rama entera sin completar la configuración y revisión manual.

## Origen adicional de carta Vercel (15-11-2026)

- Carta Romo ya alojada en Vercel, proyecto `uki-sushi-carta-prueba`. No es necesario trasladar ni rehacer la carta desde Netlify.
- Origen comercial de carta `https://uki-sushi-carta-prueba.vercel.app` preservado tal cual en `ROMO_CARTA_ALLOWED_ORIGIN` del panel Romo, sin modificación.
- Alias estable de carta revisión `https://uki-sushi-carta-prueba-git-preparacio-654ffd-diannaleandra-7046.vercel.app`, commit `0169e255`. Se agregó el valor de esta URL en `ROMO_CARTA_PREVIEW_ALLOWED_ORIGIN` en el Preview de panel únicamente.
- El segundo origen estará autorizado **solo** cuando `ROMO_CARTA_PREVIEW_QA_ENABLED=true` y `VERCEL_ENV=preview`. Esa bandera permanece **ausente/apagada**; la vista previa no permite pedidos todavía.
- Vista previa del panel Vercel con cambio `74d21820`, alias `https://uki-sushi-inventario-git-preparacion-c0b0e9-diannaleandra-7046.vercel.app`, estado READY.
- Para prueba real manual: autorizar el origen temporal del Preview y comprobar en iPhone solicitud pendiente idempotente, aceptación CAS, persistencia, caja, pago y cierre. La carta consulta disponibilidad con GET antes de POST; no convierte solicitudes pendientes en ventas.
- No alterar rama `main`, carta comercial, bases Uki ni habilitar solicitudes de QA sin personal disponible en el panel.
