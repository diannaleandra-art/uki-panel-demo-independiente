# Uki Sushi · Lote pendiente de carta: ingredientes + promociones por sucursal

Estado: **preparación de pruebas**. Ninguna integración a `main`, despliegue de Vercel, migración Neon o publicación de la carta pública está autorizada por este documento.

## Alcance preciso

- Reaprovechar `firebase/uki-armado-ingredientes-admin.js` para Agregar ingrediente al armado: vegetal, proteína, envoltura, incluido / recargo y sucursal independiente.
- Reaprovechar `firebase/uki-carta-precios-admin.js` para promociones con rolls, piezas por roll, salsas, korokes, precio, medios de pago y foto de iPhone.
- Crear/editar/retirar/restaurar promoción sin borrar pedidos históricos; las promociones nuevas nacen como **borrador no visible**, y solamente pueden publicarse con foto.
- En la carta: integraciones YA PREPARADAS en `diannaleandra-art/uki-sushi-respaldo`, PR #33 (ingredientes), #34 (lote carta) y #35 (promociones dinámicas), todos **borrador de QA**; no mezclar con el `main` desactualizado de carta.

## Reutilización segura del panel actual

Esta rama nace del `main` que ya contiene las correcciones de pedidos, timbres, cancelaciones, cierres, sincronización y cartas aceptadas/canceladas (PR #45). **No reemplazar** `firebase/uki-sushi-local.html` ni incorporar la rama antigua del PR #35 completa.

Se recuperan únicamente archivos de catálogo, fotos, precios e ingredientes, más la migración SQL aditiva, desde `feature/uki-carta-ordenada-y-reconciliacion-20261108`.

**Cortacircuito:** la API y la pantalla de promociones usan `UKI_PROMOS_VISIBILIDAD_ENABLED`, que NO se configura ni se activa en esta preparación. Con bandera desactivada, el servidor no consulta las tablas de promociones todavía ausentes de producción, no admite su creación, mantiene el listado de carta anterior y conserva el retiro/restauración existente. La parte nueva del formulario permanece oculta mientras la API no declare habilitación.

## Situación observada antes de cualquier escritura

- Neon producción, proyecto `tiny-grass-92161762`, rama `br-quiet-tree-b5m84jln`: la tabla `uki_armado_ingredientes_v1` existe y contiene un ingrediente creado en Arica, **Frutilla**, vegetal, disponible, `$0` de recargo. **No se modificó.**
- Neon producción: `uki_carta_promos_custom_v1` y `uki_carta_visibilidad_v1` **no existen**. El SQL para crearlas está incluido como archivo, **no ejecutado**.
- Vercel: la conexión disponible devolvió 403/404 al inspeccionar proyectos/despliegues; **no es válido afirmar READY ni crear un despliegue de producción sin acceso verificable**.
- La carta pública y QR de clientes siguen con su versión existente.

## Secuencia restante, coordinada y reversible

1. Ejecutar pruebas automáticas de esta rama y de las ramas específicas de carta; en un entorno QA aislado verificar fotos, precios de ambos locales, un vegetal incluido y otro con recargo y que los QR/WhatsApp conservan los totales.
2. Conseguir autorización efectiva de Vercel para el proyecto de carta y backend. No crear servicios pagados.
3. Con autorización **expresa de cambios de producción**, revisar/aplicar **únicamente** migración SQL aditiva (sin tocar pedidos, cierres, timbres ni stock), y verificar desde base que no hay filas de promociones iniciales.
4. Desplegar backend compatible primero con bandera **apagada**; comprobar que el catálogo anterior y fotos sigan funcionando.
5. Coordinar la versión probada de carta desde el commit operativo, sin mover los códigos QR; habilitar nuevos datos y comprobar carrito, recargos, medios de pago y WhatsApp.
6. Habilitar la API de promociones y terminar activación del panel desde el mismo portal; probar Arica y Serena desde iPhone (y deshabilitar bandera ante incidente).
7. Registrar versiones de retorno y confirmar que nunca se crea un pedido duplicado ni se mueve caja.

No tocar los otros PR de QA (dos agendadores, centro de dueños, inventario separado), ni inventar nuevas promociones. Los ingredientes y promociones deben gestionarse desde la sección existente **Carta y precios**, no desde una pantalla nueva.

## Compatibilidad QR de las promociones · avance de QA del 9 de noviembre

- Rama de carta coordinada: `diannaleandra-art/uki-sushi-respaldo`, PR **#36**, rama `qa/uki-promociones-vegetales-qr-compatible-20261109`, basada sobre la rama ya preparada del PR #35.
- **22/22 pruebas de carta, armado, ingredientes y QR aprobadas** en GitHub Actions `42637919636`.
- El modelo del QR toma las promociones dinámicas solo desde la **misma sucursal** y con ambas banderas activas. Valida SKU, armado, piezas 10/12, salsas, precio y visibilidad; rechaza promo inexistente u oculta. Durante el cálculo no hay consultas asíncronas que puedan mezclar el estado de ambas sucursales, y el catálogo temporal se restaura en `finally`.
- Validado sintéticamente un pedido de 200 piezas y **20 pedidos simultáneos** entre sucursales sin modificación de pedidos reales, timbres ni caja. También se comprobó que con las banderas apagadas el QR antiguo no consulta las nuevas tablas.
- **No se publicó** ninguna actualización de carta, API, panel o Neon por estas pruebas.
- **Vercel sigue bloqueado para inspección desde la conexión disponible** (GET de deployment devolvió 404); no se puede afirmar que haya Preview accesible o compatible ni avanzar a producción.
- **Orden de activación requerido**: permisos verificables + QA Safari → migración aditiva autorizada → backend y QR publicados con banderas apagadas → carta y panel compatible → comprobar ambos locales y fotos → activar banderas de forma coordinada y comprobar de nuevo. La activación por partes podría mostrar en carta una promoción que aún no pueda validar el servidor QR.

## QA de despliegue y vista iPhone (9 de noviembre, confirmado)

- **Preview de Vercel** del panel PR #46 creado en el proyecto existente `uki-sushi-panel`, ID `dpl_A3wC4gK4QKFqdFoQLZZdhftMHQGa`, commit exacto `0674868ad8770afb80b3e148733e0721b8c0a7c0`. Estado `READY`, **target de preview** (sin producción), URL `https://uki-sushi-panel-ntqdse5qp-diannaleandra-7046.vercel.app`. El proyecto tiene protección de acceso SSO y **no se ha realizado prueba de edición autenticada con datos reales**.
- **Carta PR #36, emulación Safari/iPhone** con WebKit en GitHub Actions `42640938451`, conclusión `success`; se cargó una copia local estática de la carta desde GitHub con API ficticia interceptada, sin ninguna conexión a pedidos o caja real. Verificados: sucursal Arica con promoción QA de $55.000 y vegetal incluido $0; sucursal Serena con promoción QA de $57.000 y otro vegetal +$450; al cambiar, la promoción del otro local desaparece, y el precio/ingrediente se actualiza. Se guardaron capturas de las dos sucursales en el artefacto `uki-qa-iphone-webkit-carta` (retención 3 días).
- **Carta/QR**: siguen pasando las 22 pruebas del flujo de promociones por sucursal, compatibilidad QR e ingredientes tras corregir el refresco al cambiar visibilidad/composición sin cambio de precio.
- **Limitación real**: la conexión Vercel únicamente permite inspeccionar y crear preview del proyecto `uki-sushi-panel`; los proyectos `uki-sushi-pedidos` e `uki-sushi-inventario` aparecen en el listado general, pero las consultas específicas de deployment/proyecto continúan devolviendo error o listas vacías. No se ha verificado un preview del servidor real de carta/ingredientes ni de la versión real desplegada de la carta.
- Esta prueba de WebKit **no equivale a usar Safari en un iPhone físico**. Es un ensayo del motor y del tamaño de pantalla con respuestas ficticias; falta la comprobación autenticada de todo el sistema y **autorización posterior para publicar producción**.
- **No ejecutar** las migraciones SQL, no activar banderas ni fusionar a ramas de producción hasta completar los accesos y el ensayo conjunto real. Se mantienen intactos los QR impresos, los locales y las cajas.

## Promociones del mes: estados, eliminación y restauración (QA)

- Estado real de promociones nuevas: **Borrador** (nunca publicada), **Publicada** (visible para clientes) o **Retirada** (ya estuvo publicada, ahora oculta). Se distingue mediante `published_at`, guardado al publicar por primera vez y conservado para siempre al retirar o volver a publicar; se añadió columna opcional a la migración SQL **no ejecutada**.
- El editor de `Carta y precios` identifica las promociones con etiqueta legible y muestra **Editar promoción y su armado**, **Eliminar promoción de la carta**, **Publicar promoción** para borradores y **Volver a publicar promoción** para retiradas.
- La retirada es **inmediata a petición del operador**, por sucursal, desde una acción autenticada; usa `UPDATE visible=false`, nunca `DELETE`, no altera pedidos ni cierres, y puede recuperarse. La primera publicación exige foto real guardada; el servidor verifica versión y sucursal.
- El frontend de carta/QR preparado previamente solo incorpora promociones `visible=true` y disponibles, de la sucursal exacta. No se activa nada hasta completar verificación conjunta.
- Vista privada de ejemplo `public/vista-previa-carta-precios.html`: muestra los tres estados y permite cambiar Publicada ↔ Retirada, o Borrador → Publicada en la simulación, con edición ilustrativa y **sin acceso a Neon, Firebase ni API**. Es una representación visual, no el panel operativo.
- Pruebas QA de estado, distinción histórica, migración aditiva y no eliminación física superadas en flujo de regresión del panel. **Sin cambios de producción ni pagos.**
