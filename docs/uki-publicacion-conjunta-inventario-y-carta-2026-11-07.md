# Uki Sushi — preparación para la publicación conjunta
Fecha de preparación: 2026-11-07 · Proyecto: panel operativo y carta pública

## Estado de las versiones
- **NO PUBLICAR SIN AUTORIZACIÓN EXPRESA DE LA DUEÑA.**
- Carta pública: https://uki-sushi-pedidos.vercel.app/
  - Versión actualmente en producción para recuperación: `c1a58e368d7969fe13c627a258e877a827037c92`
- Inventario/API en producción: https://uki-sushi-inventario.vercel.app/
  - Versión actualmente en producción para recuperación: `b9d16a5ccb349af62524bb6845283e1d5c0daeab`
- Panel vigente: https://diannaleandra-art.github.io/uki-panel-demo-independiente/firebase/uki-sushi-local.html
- Rama de cambios de inventario/API: `feature/uki-disponibilidad-manual-live-2026-11-06`
- Rama de cambios de carta: `feature/uki-disponibilidad-manual-carta-2026-11-06`

## Preparaciones verificadas (solo ramas de trabajo)
- Inventario trabajador: lista corta de 12, búsqueda, pendientes/contados, entradas y conteos independientes, advertencia de revisión parcial, día, fecha y hora de Chile **sin segundos**.
- Panel: Carta y precios; Disponible/Agotado manual; Inventario; Revisiones y compras. Insumos de inventario no se agregan a carta.
- Inventario administrativo: lista compacta, mínimos, históricos con sucursal, trabajador y registro de Chile, PDF, CSV compatible con Excel, compartir en WhatsApp.
- Carta: edición por sucursal de precios; nuevas pizzas únicamente Regimiento Arica y nuevas entradas simples. Cambios de precios reflejados en carrito, WhatsApp y validador QR (según pruebas automáticas).
- Base **de producción**: `public.uki_carta_productos_custom_v1` creada; en revisión de este documento contenía **0 productos**. Creación de tabla ya autorizada; no se publicaron estas funciones.
- Conteos históricos de inventario: **0 revisiones** al verificar. No inventar historial.
- Controles: no automatizar Disponible/Agotado por stock; no tocar caja/cierres/pedidos, ni el enlace de QR impreso, ni los accesos actuales.

## Últimas pruebas aprobadas
- CI rama panel/API: comprobaciones de código, inventario, disponibilidad y reportes; también pruebas sintéticas de aislamiento por sucursal y edición de precios que preserva el agotado manual.
- CI rama carta: modelo real de productos, precio y ticket WhatsApp, restauración de catálogo al cambiar sucursal, protección de precios del QR, comprobación HTTP de QA y de producción de solo lectura.
- El entorno de demostración visual contiene datos simulados: **NO valida la sesión administrativa Google ni escribe en producción**.

## Bloqueos restantes antes de autorización para publicar
1. Comprobar **con sesión Google administrativa real** lectura/escritura controlada en ambiente aislado; no reemplazar por un simulacro que se anuncie como prueba real.
2. Verificar desde iPhone la navegación del panel completo: nuevas pestañas, vista compacta, botón Editar, inventario histórico y exportación a Archivos/WhatsApp.
3. En QA, con datos ficticios y aislados, verificar alta y edición de una pizza, cambio de precio, agotado/disponible manual y pago calculado en QR (sin mandar pedidos reales).
4. Antes de despliegue, comprobar que backend y carta de pruebas correspondan a sus SHAs aprobados. No fusionar ramas ni hacer deploy con tests rojos.
5. Aprobar explícitamente publicación de la integración completa.

## Secuencia segura de publicación (solo después de autorizar)
1. Confirmar respaldos del estado actual y verificar sucursales, correos autorizados y dominios, sin revelar credenciales.
2. Migración de BD aditiva **ya aplicada**: no repetir cambios de stock/caja ni insertar datos ficticios.
3. Desplegar primero backend que lee la nueva tabla, luego carta cliente, respetando los QR actuales.
4. Revisar en ambas sucursales: pedido simple, toppings, pagos, disponibilidad, un pedido QR de prueba controlado, inventario, historial, Excel/PDF y WhatsApp.
5. Si existe incidencia, restaurar las versiones indicadas arriba, verificando resultado. Jamás borrar registros o tablas para revertir.

## Comunicación a equipos
No usar enlaces de demostración como si fueran el sistema real; no introducir productos de prueba en caja. La trabajadora registra conteo al final del turno; administradora consulta resultados y modifica agotado/disponible manualmente.

## Verificación Google interactiva — pendiente de dominio Firebase (2026-11-07)
- Pantalla de QA lista y comprobada HTTP 200: https://uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app/verificar-administracion.html
- Nueva API de verificación es **solo lectura y solo QA**: `/api/uki-admin-verificacion-qa`. Sin token Google devuelve 403; en producción la API no está habilitada.
- La pantalla permite al usuario iniciar Google, comprobar su autorización, crear y cambiar un producto de prueba SOLO EN QA, cambiar disponibilidad de ese producto, abrir revisión del historial QA, descargar CSV/PDF y compartir mediante WhatsApp.
- **Bloqueo comprobado:** consulta pública del proyecto Firebase `uki-panel-f4909` confirma que el hostname de QA **NO** figura entre sus dominios autorizados (Firebase: dominio de pruebas Google autorizado=false). Google puede rechazar el inicio de sesión mientras siga así.
- Requiere acción explícita del titular en Firebase Console → Authentication → Settings → Authorized domains → Add domain: `uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app`. No pedir credenciales ni modificar este control sin autorización. Conviene retirar el dominio temporal tras completar pruebas.
- Ningún inicio Google real ni edición autenticada fue ejecutado desde esta sesión; solo se verificaron HTTPS y bloqueos de acceso. **No anunciar QA Google como aprobada hasta ver el resultado desde una sesión legítima.**


## Estado real de publicación — 2026-11-07
- **Autorización explícita de la dueña para publicar toda la integración recibida.**
- **HECHO / producción:** Vercel inventario/backend https://uki-sushi-inventario.vercel.app/ actualizado a deployment `dpl_3dHLgpTsiAK1xNUWZFE1EQt9BSKv`, código `41bbe4a27d2b9e32c22e2fc4c14ffc14dff719ae`, target production, READY, alias oficial confirmado.
- Verificación HTTP desde GitHub Actions ejecución `42338934740` éxito: disponibilidad y precios GET 200 por sucursal, worker 200 sin segundos, APIs administrativas rechazaron token ausente (403), QA desactivado en producción (404).
- Antes de publicar, backend viejo era `b9d16a5ccb349af62524bb6845283e1d5c0daeab`; conservar como rollback si fuera necesario.
- **BLOQUEADO / carta de clientes:** Vercel `create_deployment` devolvió **HTTP 402** `api-deployments-free-per-day` (más de 100 API deployments), `retryAfter=86400`. No editar cuotas ni comprar plan. Intento `request_promote` a deployment previo `dpl_B4gAZvGdESGCdeBLYeMSs5qNzm8e` devolvió 404 del endpoint y **NO promovió**.
- Menú público oficial https://uki-sushi-pedidos.vercel.app/ conserva deployment `dpl_Htt7EbKrCS6u6oLPFQocAHT1vGge`, código `c1a58e368d7969fe13c627a258e877a827037c92`, READY. **NO publicadas** las mejoras de precios del cliente.
- Rama funcional de menú con 61 pruebas aprobadas: `feature/uki-disponibilidad-manual-carta-2026-11-06` código `b5878861114e93c3b5b137827440945311e298aa`; código desplegado antes como PREVIEW `a874cf4900d163a1487637ef1fcc411c58a56653` es funcionalmente igual (diferencias entre ambos solo un archivo de test, no la aplicación).
- **NO publicadas** nuevas tres pantallas de admin en GitHub Pages panel principal: `firebase/uki-carta-precios-admin.js`, `firebase/uki-inventario-exportar.js`, `firebase/uki-inventario-historial-admin.js`; HTML actual conserva sha blob `cd636c5643db7d7f60d39011d517d3363f8486fd`, sin incluir esos scripts. No activar editor de precios hasta que carta de cliente esté publicada y verificada.
- Estado Neon producción al terminar: `uki_carta_productos_custom_v1` 0 productos, `uki_inventario_revisiones_live` 0 revisiones, `uki_inventario_extras_live` 0; no se crearon datos reales en pruebas.
- **Próximo intento cuando Vercel acepte nuevos despliegues:** publicar rama funcional menú con `target:production` en proyecto `prj_YtLrxiVyanvxOQamP1xgw4gkJktH`; asegurar alias `uki-sushi-pedidos.vercel.app`; prueba HTTP y pedido QR sin generar pedidos reales. Luego incorporar los tres archivos JS de admin al `main` de `uki-panel-demo-independiente` y las tres referencias de script en HTML, preservando todos los scripts de pedidos y caja actuales. Validar panel con Safari del iPhone.
- No afirmar que ya se publicó la integración completa; desplegado **solo backend/worker**.


## Correcciones detectadas durante el día — en rama de carta, NO publicadas (2026-11-07)
1. **Delivery por calles >9 km:** no bloquear el checkout; mantener todos los productos, datos del cliente, dirección, ubicación y observaciones; preparar mensaje completo para WhatsApp marcado **DELIVERY POR CONFIRMAR** sin inventar precio del reparto. El botón previo de consulta parcial pasa a «Continuar con mi pedido completo». También admite ruta no calculada con tarifa por confirmar; sigue impidiendo enviar una ruta pendiente sin revisar.
2. **Envoltura Mixta en sushi clásico, premium, promos y handroll:** seleccionar **dos envolturas distintas sin recargo** entre Tempura, Panko, Ciboulette, Sésamo, Merkén y Nori. **Pepino excluido**, no se pueden repetir ni cobrar recargo. Si se marca Sin nori, Nori también se excluye. Mostrar composición en carrito, detalle de cocina, WhatsApp y QR.
3. Código guardado **solo en** `diannaleandra-art/uki-sushi-respaldo`, rama `feature/uki-disponibilidad-manual-carta-2026-11-06`, commit `b43dfedbd9808e8aef564c8926b165ed592660c5`.
4. CI de carta `42340654636`: **65 pruebas aprobadas, 0 fallas**, incluyendo dos cambios anteriores y cuatro verificaciones nuevas (mixta, cocina, delivery superior a 9 km y checkout).
5. **Producción sin cambios por estas correcciones:** carta de clientes sigue deployment `dpl_Htt7EbKrCS6u6oLPFQocAHT1vGge`, commit `c1a58e368d7969fe13c627a258e877a827037c92`. Se incluirán en la publicación agrupada pendiente. No publicar individualmente mientras la dueña continúa reportando ajustes.
