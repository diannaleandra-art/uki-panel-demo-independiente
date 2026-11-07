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
