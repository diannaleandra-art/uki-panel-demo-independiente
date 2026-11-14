# Romo en el panel único de Uki — integración en preparación
Fecha: 14-11-2026

**Rama NO operativa y no publicada.** Derivada de `qa/uki-panel-unico-romo-serena-20261111` sin tocar `main` ni la rama QA original.

## Lo que sí incorpora
- Reutiliza el archivo existente `firebase/uki-sushi-local.html` del panel Uki con la tercera opción Romo La Serena (Balmaceda 1612).
- El selector de sucursales Uki y sus dos rutas originales se mantienen.
- Al elegir Romo, la contraseña sigue siendo una de las existentes de Uki, no otra.
- El adaptador `firebase/uki-romo-operativo-qa.mjs` prepara lectura/guardado mediante sobre cifrado `uki-v813-browser`; sólo se permite a `romo:serena`.
- `firebase/uki-romo-integracion-panel-qa.mjs` une el estado y la pantalla del panel con `lib/romo-panel-unico-sesion-qa.mjs`. Las funciones originales de inventario, pedidos y caja no se sustituyen.
- El destino para Romo es exclusivamente Neon Romo a través de una API con control de revisión; no se escribe en Firebase de Uki ni en el localStorage de sucursal `desconocida`.

## Seguridad y estado actual
- La URL del backend `ROMO_OPERATIVO_ENDPOINT_QA` está **vacía**, y la bóveda de `romos_sushi` no se ha habilitado: la pantalla operativa de Romo continúa bloqueada. Sin datos reales ni simulaciones que se confundan con ventas.
## Comprobaciones de código y permisos — realizadas sin modificar datos
- La referencia a los 16 scripts de `firebase/uki-sushi-local.html` y las importaciones locales del puente corresponde a archivos existentes en esta rama.
- El servicio `romos_app_service` tiene **SELECT, INSERT y UPDATE** sobre `romo_estado_operativo_v1`; no tiene DELETE. No se otorgaron ni cambiaron permisos.
- En `romo_personal_acceso_v1` y `romo_clave_compartida_v1` tiene sólo SELECT. Por eso no puede inscribir la contraseña compartida ni modificar roles por accidente.
- En `romo_catalogo_v1` tiene sólo SELECT. El editor de carta no puede guardar cambios todavía.
- En `romo_inventario_v1` tiene SELECT/INSERT/UPDATE/DELETE, pero no está conectado al panel y no se hizo ninguna escritura.
- Estas son comprobaciones estáticas y consultas de sólo lectura. **No se realizaron las pruebas manuales en iPhone** que exige la propietaria.

- El backend de preparación permanece en la rama Romo `preparacion/integracion-panel-unico-romo-20261114`:
  `replica-uki/panel/api/romo-estado-cifrado-panel-qa.js` y `replica-uki/panel/lib/romo-estado-cifrado-persistencia-qa.mjs`.
- Requiere verificar la sesión Firebase Google en servidor, la fila de dueños/agendador en Neon Romo y la clave Uki mediante verificadores cifrados de `romo_clave_compartida_v1`, aún vacía.
- La tabla `romo_estado_operativo_v1` también está vacía; no se han generado pedidos, cajas ni cierres.
- Debe comprobarse que los módulos de inventario, carta, caja y timbres que hoy usan Uki estén ruteados exclusivamente a Romo antes de permitir operaciones. Un adaptador de estado cifrado NO significa integración completa ni paridad confirmada.

## Próximos pasos antes de publicación
1. Revisar permisos/grants de Neon de la tabla Romo y las variables del backend separado, sin activarlas todavía.
2. Preparar mecanismo seguro para inscribir los verificadores de la misma clave existente sin enviarla a ChatGPT.
3. Completar el ruteo aislado de cada función (carta, inventario, pedidos, caja y cierres), sin escribir en tablas/colecciones Uki.
4. Realizar exclusivamente **pruebas manuales** en el iPhone con acceso de dueños; sin pedidos falsos ni ventas reales.
5. Con resultados aprobados y autorización explícita, decidir una sola publicación consolidada. No cambiar el QR, los accesos ni el panel operativo de Uki hasta entonces.

No se ejecutaron tests automáticos, migraciones, escrituras SQL ni despliegues mediante este cambio.
