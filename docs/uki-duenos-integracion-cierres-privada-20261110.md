# Activación de cierres definitivos en Mi Administración Uki · 10 noviembre 2026

**Estado:** Código preparado, pruebas automáticas aprobadas. Producción **NO ACTIVADA** por límite diario de despliegues de Vercel (HTTP 402 api-deployments-free-per-day). No publicar parcial.

## Componentes listos
- API privada de finanzas y lectura de cierres, Google + PIN: `api/mi-administracion-live.js`.
- Puente de ingreso exclusivo para cierres confirmados: `api/uki-duenos-cierres-live.js`.
- Vista de dueños móvil: `public/mi-administracion-duenos.html` con dependencias `public/mi-administracion-*.js` y listado unificado en `public/uki-duenos-ventas-unificadas-qa.mjs`.
- Rama backend `qa/uki-duenos-puente-privado-live-20261110`, CI **42880082700** completada correctamente en commit `12ad15b43bd3ebbc00315122dba67d39e18e96de`; luego se ajustaron textos de portada; confirmar nuevo HEAD y revalidar.
- Rama de panel operativo `qa/uki-duenos-operativo-20261110` basada exactamente en `main` SHA `33ac817b3ecc5e4c39d7965517c9f60dacd54dfb`, CI **42881131103** aprobada en commit `512996902717e404a3754abd89ed71ca91cb1c3d`.
- Cambios operativos limitados a `firebase/uki-sushi-local.html` (importación y callback de Firebase sincronizado) y el nuevo `firebase/uki-duenos-cierre-publicador-live.mjs`. **No altera `function cerrar()`.**

## Base de datos aislada de finanzas
- Neon project: `tiny-grass-92161762`, rama privada `br-plain-mode-b539rxh1` creada desde la rama de pruebas financieras existente.
- Tabla **nueva**, `public.fin_uki_cierres_live_v1`, vacía inicialmente y con clave única `(branch, source_key)`; recibe solo fechas, montos, medios de pago y totales anónimos del cierre.
- La rama privada heredó 3 registros manuales y un PIN configurado desde QA. **NO asumir que esos 3 registros representan ventas reales**: la vista advierte que deben verificarse. No sumarlos automáticamente a los cierres.
- La BD operativa de pedidos `br-quiet-tree-b5m84jln` no fue modificada por esta integración.
- Vercel `uki-sushi-inventario` ya tiene en **Producción** la variable sensible `UKI_FIN_PRIVATE_DATABASE_URL` y `UKI_FIN_PRIVATE_ENABLED=true`, `UKI_FIN_AUTO_LIVE_ENABLED=true`. Nunca imprimir el valor sensible. Por sí solas las variables no activan el código viejo.
- El acceso Google usa el listado de correos permitidos de inventario y la lectura financiera exige además una sesión de 30 minutos obtenida con PIN privado.

## Orden de despliegue autorizado
1. **Preflight**: confirmar que el proyecto Vercel y URL oficial `uki-sushi-inventario.vercel.app` apuntan al commit de producción esperado; que los checks de la rama backend y operativa están todos `success`; rama GitHub `main` sin cambios inesperados. No sobreescribir ninguna rama.
2. **Servidor primero**: crear despliegue `target=production` del commit HEAD verificado de `qa/uki-duenos-puente-privado-live-20261110` al proyecto Vercel `prj_HwY2PzvAxlwAvpVNZcNI6lsOXbzr`, equipo `team_hRe5qbUuFISgh9lq489RMw4m`. Esperar `READY`, comprobar alias oficial. No sustituir por preview.
3. **HTTP sin sesiones**: `GET /mi-administracion-duenos.html` HTTP 200, `GET /api/mi-administracion-live` y `GET /api/uki-duenos-cierres-live` deben rechazar al visitante sin credenciales. No intentar pedir PIN ni tokens por chat.
4. **Panel operativo segundo**: integrar **solo los dos archivos modificados** desde `qa/uki-duenos-operativo-20261110` en la rama que alimenta GitHub Pages. Verificar que `main` continúe basado en `33ac817b3ecc5e4c39d7965517c9f60dacd54dfb`, o revisar diffs antes de combinar. El push a main **podría disparar un despliegue automático de Vercel**: si ocurre, inspeccionar inmediatamente el alias para no revertir el backend de dueños. Nunca usar `force` sobre main.
5. **Verificación operativa sin ventas falsas**: en el panel del local, esperar `Nube: sincronizado`; los cierres finales ya existentes desde el 10/11 se reenvían idempotentemente. La API crea una única fila por cierre/sucursal y rechaza versiones distintas con error 409. Las fallas de enlace no reabren la caja; se reintenta al próximo respaldo.
6. **Vista de dueños**: acceder con Google + PIN de 6 dígitos a `https://uki-sushi-inventario.vercel.app/mi-administracion-duenos.html`, revisar tarjetas de Regimiento Arica y La Serena, botón Todas las ventas, medios de pago, cierres y ventas manuales. Si Firebase bloquea el dominio para Google, verificar lista de dominios autorizados en Firebase antes de pedir al usuario cambios. No exponer secretos.
7. **Conciliación**: comparar el primer cierre definitivo nuevo contra su total en caja y `fin_uki_cierres_live_v1`; verificar que no se cree `fin_movimientos` ni se dupliquen ventas manuales. No cambiar pagos, productos, timbres ni cierres de prueba.

## Bloqueo actual
- Intento directo a producción del backend falló con Vercel 402 `api-deployments-free-per-day` el 10/11/2026.
- El despliegue anterior `uki-sushi-inventario.vercel.app` seguía `READY` en SHA `2f4aee3d033f0f4a93d97859fcdd7febbb72eff7`. Sus endpoints de dueños todavía devuelven 404 porque el nuevo código no está publicado.
- **No editar el panel público de los locales mientras el servidor nuevo no esté en READY.**

## En caso de problemas
Revertir solo el hook de envío financiero en GitHub Pages; los cierres operativos siguen en Firebase cifrado, y los resúmenes duplicados del puente no se contabilizan. Mantener el registro y revisar conciliación antes de reintentar.
