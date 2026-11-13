# Integración Romo La Serena · Carta en la MISMA lista de Uki (QA, 13-11-2026)

Se conserva el selector único del panel y la misma plantilla original de «Carta y precios» y «Disponible / Agotado», sin formularios nuevos.

## Conexión de lectura
- `firebase/uki-romo-consulta-qa.mjs` usa la lectura privada existente `api/romo-estado-operativo-qa.js?area=catalog`, con JWT Firebase Google firmado y rol Romo verificado en la base **independiente**. No toma el catálogo Uki como alternativa ni mezcla precios.
- Si la plantilla original tiene `#ukiPriceList` y `#ukiPromosListaResumen`, los rellena con los productos, promociones y precios de Romo; no muestra un segundo bloque de catálogo. Si falta esa plantilla (test DOM mínimo), conserva el lector anterior para compatibilidad.
- Reutiliza búsqueda, categoría y estado de disponibilidad. Permite filtrar categorías «Piezas de sushi Romo» y «Promociones Romo». La lista de disponibilidad distingue productos, promociones e ingredientes.
- Respeta `visible=false` como **No publicado** y `available=false` como **Agotado**. Ninguna de esas banderas se altera. Muestra recetas/piezas y salsas sin habilitar su edición.
- Únicamente se habilitan botones para **Actualizar catálogo** y filtros de **consulta**. Los controles originales de crear/editar/quitar/fotos y las acciones de venta siguen desactivados en la rama Romo.
- Falla cerrado ante identidad ajena, contenido pizza, SKU de Uki, API desconectada, firma no autorizada o respuesta que indique ventas activadas. No se escribe Neon ni se modifican los datos de Uki.
- `ROMO_PANEL_LECTURA_SOLA_ENABLED` aún no se activa en producción: requiere publicación y aprobación diferenciada; mientras tanto se mostrará «Lectura de Romo pendiente de activación segura».
- Romo todavía no puede recibir ventas: faltan endpoints de bandeja, roles, persistencia completa y E2E dos teléfonos.

## Pruebas
`tests/uki-romo-catalogo-en-editor-qa.test.mjs` verifica el catálogo aprobado (7 productos, 3 promociones, 40 ingredientes), filtros dentro de la plantilla, separación de datos, promociones no publicadas, bloqueo de botones de edición, consulta sin POST y compatibilidad con el montaje de inventario.

Ninguna publicación productiva ni activación de caja / cartas se realiza en este paso.
