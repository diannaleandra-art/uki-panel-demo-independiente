# Puente de catálogo e inventario Romo — 11 nov 2026 (sólo QA)

Esta rama nace de main actualizado del panel compartido y NO reemplaza la rama anterior ni publica la carta.

## Comprobación read-only de Neon
- Proyecto: romos-sushi-la-serena; base: romos_sushi (independiente de Uki).
- Tablas existentes: romo_catalogo_v1, romo_clave_compartida_v1, romo_estado_operativo_v1, romo_personal_acceso_v1, romo_turnos_v1.
- Conteos verificados 11-11-2026: catálogo=0, personal=0, claves=0, estado operativo=0. NO insertar datos de muestra ni dar permisos automáticos.

## Implementado en esta rama
- Adaptador de catálogo QA: productos/promociones/ingredientes, precios explícitos, disponibilidad, borradores y composición.
- Validación estricta para excluir pizzas y códigos de Uki. El ajuste +$500 de piezas NO se inventa ni se aplica dos veces: se comprobará con la carta Romo aprobada.
- Lectura y operación CAS de catálogo en código. El endpoint API sólo permite GET, requiere token Google firmado, rol activo en base Romo, origen exacto, base independiente y bandera QA explícita; responde 503 por defecto y siempre en producción.
- Modelo de diferencias de inventario (llegó - hay) y reposición por mínimos, sin alterar caja, consumos ni inventario Uki.
- El guardado CAS queda preparado como función NO expuesta; no se escribió en Neon.

## Pendiente antes de activar a clientes
1. Contrastar carta Romo y fotos originales, acordar precios finales/promociones y migrar catálogo privado tras autorización.
2. Integrar el formulario de Carta y precios del MISMO panel para usar scope romo:serena. No duplicar panel ni contraseñas.
3. Preparar persistencia real de inventario y permisos del personal por sucursal, con pruebas desde dos iPhone.
4. Integrar pedidos/caja/cierres/timbres con almacenamiento Romo y autorización dueños, sin tocar las dos sucursales Uki.
5. Pruebas integrales y autorización específica antes de producción.

Esta rama no altera env vars, dominios, datos reales, código de sucursales Uki ni producción.

## Proyección de Romo en las mismas vistas del panel (11-11-2026)

- lib/romo-panel-proyeccion-qa.mjs convierte catálogo y inventario de Romo a elementos de lectura del panel.
- Productos, promociones, ingredientes, disponibilidad, cantidades recibidas y faltantes conservan identificador romo:serena.
- La proyección pública oculta promociones y productos sin publicar; listaParaRevision no habilita ventas.
- Fotos faltantes son detectadas como pendientes; no se inventan fotos ni precios.
- Carta antigua Romo usa Supabase para romos_products, mientras el panel nuevo utiliza la base Neon romos_sushi.
- El conector Supabase rechazó la consulta de lectura: autenticación fallida del rol de solo lectura.
- Neon tenía cero registros en romo_catalogo_v1 en la última revisión. No se importaron datos automáticamente.
- Sin modificaciones a la carta pública, sin SQL ejecutado, sin permisos nuevos y sin tocar producción.

## Vista de catálogo integrada en el mismo panel (QA)
- Se añadió firebase/uki-romo-carta-panel-qa.js al HTML del panel compartido; sólo se muestra cuando la sucursal seleccionada es Romo.
- Mostrar secciones Carta y precios, Promociones, Ingredientes, Inventario (este último pendiente) reutilizando clases visuales del panel.
- El botón de consulta tiene ENDPOINT vacío por seguridad. No intenta leer Neon/Uki hasta autorización y credenciales privadas válidas.
- La futura respuesta autorizada se muestra por DOM textContent, sin inyectar HTML de productos; rechaza datos de otra sucursal.
- No incluye POST, cambios en caja, guardados, ventas ni habilitación de checkout.

## Continuación — editor de borradores en el panel único (11 nov 2026)
- La misma pantalla de selección contiene Romo La Serena y su bloque privado «Carta y precios» de pruebas.
- El bloque llama a `/api/romo-catalogo-qa` desde el mismo dominio preview. La API sólo acepta la rama exacta QA, con dos banderas privadas APAGADAS por defecto: `ROMO_CATALOGO_QA_ENABLED` (lectura) y `ROMO_CATALOGO_QA_WRITE_ENABLED` (borradores).
- Requiere Google Firebase real, UID con rol `duenos` activo en Neon Romo para POST, y cuenta permitida por correo validado en servidor. Requiere `ROMO_PRIVATE_DATABASE_URL` de Romo, host verificado y origen de preview exacto. La API se niega a funcionar en producción.
- Permite preparar altas y ediciones de BORRADORES de productos, promociones y ingredientes dentro del panel, con cantidad de rolls/piezas, salsas, korokes y precio. No publica productos, no sube fotos ni habilita pedidos.
- Conflictos CAS: cambios desde dos dispositivos con revisión vieja devuelven 409, no se sobrescribe silenciosamente.
- La tabla Neon `romo_catalogo_v1` sigue vacía (0 filas), lo mismo permisos y claves. No se hicieron migraciones ni se copiaron datos comerciales.
- El catálogo anterior `romos_products` está en Supabase; la lectura con conector fue rechazada por autenticación del usuario read-only. No se alteraron sus productos.
- La versión privada antigua de Romo tiene **7 imágenes embebidas en su HTML**; no están verificadas individualmente ni relacionadas por SKU con la tabla nueva. Ninguna se da por publicada.
- El aumento previamente acordado de $500 en promociones de piezas se debe aplicar UNA sola vez tras comprobar la carta original, nunca a ciegas.
- La edición de esta fase es preparación QA; la pantalla operativa completa idéntica a Uki, la sincronización con la carta comercial y el inventario real siguen pendientes.
- CI de la rama: 32 pruebas correctas en ejecución `43116042620` (sin red ni datos reales).
- No se tocaron compras, caja, cierres, timbres ni las dos sucursales de Uki. No se activaron secrets, endpoints, env vars ni ventas.

## Conector de lectura de la carta antigua (solo QA)

- `/api/romo-catalogo-anterior-qa` está desarrollado como lectura segura de `romos_products` (Supabase), sin datos de clientes ni pedidos.
- Requiere rol dueños verificado en Neon Romo, Google firmado, clave publishable, entorno preview y banderas separadas. TODAS DESACTIVADAS actualmente.
- Devuelve candidatos para revisión con su precio de origen exacto; NO suma +$500, NO aprueba composición, NO asocia fotos, NO copia filas, NO publica ni vende.
- No fue posible leer registros reales de Supabase en este turno por error de autenticación del conector. Se conserva 0 filas en el catálogo Neon Romo.
- Antes de alta: comparar precio de origen con lista aprobada y decidir si la corrección +500 ya fue aplicada, revisar salsas/korokes por promoción y asociar una de las fotos antiguas por SKU.

## Revisión en la pantalla Carta y precios
- Botón «Revisar productos de la carta anterior» dentro de la vista Romo del mismo panel.
- Solo carga una vista de precios y estado de los productos existentes cuando la sesión de dueños está autorizada y la API QA tiene conexión real.
- No añade +$500, no migra, no publica, no entra en caja. Todo queda pendiente de comparación de la carta definitiva.
- Galería de 4 fotos originales para seleccionar manualmente por promoción con fotoId validado, sin asignación automática.

## Corrección de límite Vercel Hobby (QA)
La versión de pruebas excedía las 12 funciones del plan Hobby: 13 archivos `api/*.js`, dos nuevos para Romo. Se consolidó la lectura del catálogo anterior como modo `GET /api/romo-catalogo-qa?origen=anterior` dentro del endpoint único de catálogo Romo; se elimina `api/romo-catalogo-anterior-qa.js` solamente de esta rama. Quedan 12 funciones. No se adquiere Pro, no se toca producción, no se configura ningún secreto nuevo ni se habilita ninguna escritura.

## Lista de revisión comercial recuperada (NO migrada ni publicada)

Se localizaron valores indicados como acordados en la conversación de noviembre de 2026 (correspondientes a la corrección de «piezas»): carta regular 24 $8.000; 36 $12.000; 48 $16.000; 60 $19.000; 72 $21.000; 84 $24.000; 96 $26.000. El aumento de $500 ya está incluido en esa revisión: NO sumarlo otra vez.

También figuran promociones históricas específicas, sujetas a vigencia antes de ofrecerlas: 24 + 2 korokes $7.000, 60 + 3 korokes $16.000 y 72 piezas $18.000. No confundir con la carta regular.

Las imágenes antiguas de menú de julio muestran precios distintos (24 $7.500, 36 $11.500, 48 $14.500, 60 $17.500, 72 $19.500, 84 $22.500, 96 $24.500). No extrapolar cambios ni reemplazar montos aprobados usando esa imagen histórica. Se necesita cotejar con datos comerciales actuales antes de migración. Vista únicamente de revisión privada, sin crear productos en Neon ni habilitar ventas.
