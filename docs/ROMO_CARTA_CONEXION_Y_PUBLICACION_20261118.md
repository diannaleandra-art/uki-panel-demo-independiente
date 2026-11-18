# Romo La Serena · Carta aprobada → Panel · preparación de publicación
**Fecha:** 18 de noviembre de 2026. **Estado:** QA privado, sin pedidos ni cobros comerciales.

## Ya verificado
- La carta Romo se visualizó en Safari desde el Preview `release/romos-carta-v816`: portada aprobada, carrito, 4 korokes por $2.500 (valor de referencia) y formulario de retiro. No se transmitió ningún pedido.
- Los **40 productos** aprobados se derivan de `romos-sushi-qa./replica-uki/carta/lib/romo-catalogo-aprobado-qa.mjs`. No sustituirlos por `romo_catalogo_v1`, que actualmente contiene siete productos auxiliares.
- Neon Romo es el proyecto `round-cell-98681740`, base `romos_sushi`; la rama principal tiene `romo_carta_ediciones_v1` y auditoría sin revisión inicial.
- En la rama QA `br-gentle-wave-be71bcpa` se instalaron el 18-11 las dos tablas de ediciones y auditoría, vacías y con permisos para `romos_app_service`; sin copia de datos, sin cambios en Caja ni ventas. **No confundir ambas ramas de Neon.**
- El editor seguro ya está integrado en **Inventario → Carta y precios** del panel aislado de Romo. Está oculto hasta que `GET /api/romo-carta-ediciones-seguras-qa` confirme Google/rol de dueños. No duplicarlo en Promos.
- La primera revisión usa el botón existente **Confirmar versión inicial de la carta** y el `POST action=initialize, expectedRevision=0` auditado. Debe ejecutarlo la dueña en una sesión autorizada tras verificar los productos, nunca por una consulta automática.
- El feed público de cambios exige ahora `revision >= 1`; la revisión cero no es prueba de precios confirmados.

## Conexión pendiente y orden seguro
1. **Revisar destino de base del panel:** confirmar si `ROMO_PRIVATE_DATABASE_URL` del Preview apunta a Neon principal o a la rama QA. No reemplazar esa URL a ciegas: el mismo servicio gestiona el estado operativo, Caja y solicitudes. La tabla QA recién instalada no significa que la API actual la utilice.
2. **Configurar lectura de carta entre proyectos:** acceso Vercel al proyecto `romos-sushi-carta-qa` sigue sin estar disponible para la conexión de herramientas, aunque está visible para la dueña en su dashboard. Revisar los orígenes estables de Preview, la protección entre proyectos y estas banderas separadas en el entorno de pruebas:
   - Carta: `ROMO_CATALOGO_APROBADO_QA_ENABLED` y `ROMO_CARTA_PUENTE_CAMBIOS_QA_ENABLED`.
   - Panel: `ROMO_CARTA_EDICIONES_QA_ENABLED` y `ROMO_CARTA_CAMBIOS_PUBLICOS_QA_ENABLED`.
   - Configuración cruzada: `ROMO_PANEL_ALLOWED_ORIGIN`, `ROMO_CARTA_CATALOGO_QA_ORIGIN`, `ROMO_CARTA_PUBLIC_ORIGIN_QA`, `ROMO_PANEL_CAMBIOS_PUBLICOS_ORIGIN_QA`, según el proyecto dueño de cada API.
   - No registrar secretos, URLs con credenciales o valores de tokens en GitHub ni en capturas.
3. **Permitir inicialización manual de dueños** únicamente con `ROMO_CARTA_EDICIONES_ESCRITURA_QA_ENABLED` limitado al Preview aprobado; comprobar primero acceso Google, los 40 productos, hash y esquema de la rama seleccionada. Dejar desactivado al terminar.
4. **Verificar el feed completo:** origen autorizado → 40 productos → revisión 1 → hash coincidente → precio/stock por producto. Si cualquier comprobación falla, mantener la vista privada y no usar precios como comerciales.
5. **Recepción y aceptación:** sólo después de la carta validada, revisar `ROMO_RECEPCION_CARTA_QA_ENABLED` en carta y `ROMO_SOLICITUDES_PUBLICO_QA_ENABLED`, `ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED`, cotizador, identidad e idempotencia en panel. Realizar **un pedido de retiro controlado** con la dueña; el pedido pendiente no se suma a ventas sin pago.
6. **Publicación:** agrupar cambios, ejecutar CI y prueba manual, publicar en Preview, y promover a comercial sólo con autorización final. No modificar `main` de Uki ni reutilizar `Redeploy` de una versión anterior.

## Lo que NO está autorizado
- No inicializar la revisión de precios por SQL directo ni en nombre de la dueña.
- No habilitar `POST` comercial, pagos, caja o la carta pública de clientes ahora.
- No usar la rama QA de Neon como sustituto de la base operativa sin revisar su aislamiento y permisos.
- No recrear la carta ni duplicar el editor existente.


## Avance de conexión y pruebas del 18-11-2026 (continuación)
- Se verificó por herramienta conectada Vercel que `romos-sushi-panel` es accesible en el equipo `diannaleandra-7046`, pero `romos-sushi-carta-qa` (ID previamente confirmado por la dueña: `prj_z0MXks08m8xDbRIPHJ2DyaxYfnuY`) devuelve 404 incluso por ID, nombre, equipo y slug. **No inventar acceso**; se requiere ampliar o renovar la autorización del proyecto en el conector de Vercel o configuración manual sin compartir secretos.
- Se configuraron en el proyecto Vercel `romos-sushi-panel` dos variables **exclusivas de Preview y rama `qa/romos-panel-v816`**: `ROMO_CARTA_EDICIONES_QA_ENABLED=true` (solamente GET autenticado; bandera de escritura sigue ausente) y `ROMO_CARTA_CATALOGO_QA_ORIGIN` apuntando al alias de la rama de carta mostrado en la captura de Vercel. **Los despliegues actuales no incorporan variables nuevas hasta volver a desplegar.** No se modificaron variables de producción.
- En repo `diannaleandra-art/romos-sushi-qa.`, rama `release/romos-carta-v816`, commit `4fc077552cb4e210b70d526c13accf9b4b006124`: API de GET de cambios admite el alias fijo y la URL `Visit` inmutable únicamente si coincide con `VERCEL_URL` del mismo proyecto QA, y nunca desde producción, otro proyecto u origen ajeno. No se abre POST ni ventas.
- Se activó CI de esa rama en el commit `fdbf21212912f594f244589ac3bece09776f7584` y se diferenciaron pruebas comerciales históricas de WhatsApp de pruebas QA actuales. Resultado real: **63 pruebas aprobadas, cero fallos**, ejecución GitHub Actions `44236463811`. No se desplegó esta revisión en Vercel.
- Las tablas de Neon QA de edición/auditoría siguen sin revisión inicial. En el panel no se habilitó `ROMO_CARTA_EDICIONES_ESCRITURA_QA_ENABLED`, `ROMO_CARTA_CAMBIOS_PUBLICOS_QA_ENABLED`, recepción de pedidos, cobros, caja ni permisos comerciales.
- **Orden correcto al recuperar acceso a carta QA:** verificar rama y origen, configurar únicamente lectura del catálogo aprobado y puente de GET, publicar un Preview de ambos componentes para comprobar Google/Neon. Posteriormente dueña confirma los 40 productos mediante editor autorizado y revisión CAS+auditoría; cerrar permiso de inicialización y validar feed `revision>=1`. Por último probar recepción/idempotencia y un pedido de retiro controlado, sin ingresar ventas por solicitudes pendientes.
- La versión actual de carta Preview mostrada manualmente en iPhone `5deb3db` y los últimos cambios `ab533223`, `4fc07755` y `fdbf2121` en GitHub no son todos el mismo despliegue. **No anunciar que están publicados antes de comprobar Preview.** Mantener Uki oficial `main` y Romo producción sin cambios.



## Nuevo acceso Vercel y conexión protegida (18-11-2026)
- Reautorización explícita por la dueña de ChatGPT Vercel MCP para el proyecto `romos-sushi-carta-qa`. ID real confirmado vía API Vercel: `prj_zOMXksO8m8xDbRIPHJ2DyaxYfnuY` (la fuente anterior confundía letra O con cero). Se corrigieron controles QA en GitHub commit `f3b7d164f4d62062b94b189b599ee446f2362484`; CI de carta pasó.
- En `romos-sushi-carta-qa`, rama `release/romos-carta-v816`, están configuradas, SOLO para Preview: `ROMO_CARTA_ISOLATED_PROJECT=romos-sushi-carta-qa`, `ROMO_CATALOGO_APROBADO_QA_ENABLED=true`, `ROMO_PANEL_ALLOWED_ORIGIN`, `ROMO_CARTA_PUENTE_CAMBIOS_QA_ENABLED=true`, `ROMO_CARTA_PUBLIC_ORIGIN_QA`, `ROMO_PANEL_CAMBIOS_PUBLICOS_ORIGIN_QA`. No se habilitó ninguna recepción ni escritura comercial.
- En `romos-sushi-panel`, rama `qa/romos-panel-v816`, se agregó `ROMO_CARTA_CAMBIOS_PUBLICOS_QA_ENABLED=true` (solo GET de catálogo validado), conservando la bandera de lectura de ediciones ya establecida y dejando sin establecer la bandera de escritura.
- Despliegues Preview verificados READY: carta `dpl_4ZhG1VfWc3waYG8SPZDurhLWm5pf`, commit `f3b7d164...`; panel `dpl_BKQYvUaXqTXbDmBvJgNgCwSeB76v`, commit `4a530fe7...`. No fueron producción.
- Probe del GET `/api/romo-cambios-carta-qa` a través de Vercel devuelve 503: el panel protegido no confirma respuesta. Ambos proyectos reportan `ssoProtection.enabled=true` y `deploymentType=all`. La llamada entre proyectos no atraviesa Vercel Authentication sin Trusted Sources; esto es independiente de Neon o del diseño.
- Preparación sin autorización ampliada: commit carta `c7b2a9a8a5ccbe85735ee55a01c64d4d1ae4a9d5` y commit panel `f1a4c1201e1b2858539433f75b87e1638c2b8e5b` incorporan el token OIDC efímero de `@vercel/oidc@4.0.9` solo en GET servidor-a-servidor de Preview. Las pruebas automáticas de ambos repositorios pasaron. **Estos dos commits NO están aún desplegados.**
- **Paso pendiente de autorización específica de dueños para cambiar controles de acceso:** crear en Deployment Protection → Trusted Sources dos permisos de origen identificados exactamente por proyecto, SOLO Preview→Preview: (a) panel Romo llama carta QA; (b) carta QA llama panel Romo. Deben preservarse las reglas existentes de Trusted Sources; no desactivar Vercel Authentication, no usar claves estáticas ni compartir tokens.
- Después de dicha autorización y de guardar reglas sin sobrescribir otras existentes: una sola publicación QA de ambos HEAD; verificar GET de base 40 productos y estado de revisión inicial (debe seguir bloqueado antes de revisión 1); habilitar inicialización temporal únicamente para acción manual autenticada de dueños cuando revisen catálogo y base; apagar permiso al finalizar; validar CAS, auditoría, feed e idempotencia antes de un pedido de retiro controlado.
