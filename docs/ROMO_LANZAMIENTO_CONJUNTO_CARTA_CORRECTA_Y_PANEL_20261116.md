# Romo Sushi La Serena — fuente única de trabajo para lanzamiento conjunto
Fecha: 2026-11-16. No publicado.

## Versiones verificadas en código
- Panel oficial Uki y ambas sucursales: repo diannaleandra-art/uki-panel-demo-independiente, main 3274dbc1b66b676663b74d74ae40f84d251b3ee9. NO MODIFICAR.
- Panel Romo (preparación): mismo repo, rama preparacion/uki-romo-sobre-main-20261114, commit base de esta integración ee3f473697b97ebad4b7e57aa09b21408372dc24. El preview que abre la propietaria está en otra revisión ya publicada, f812b1b2998f4e3275b8ef72b596ecda889c82bc. NO promover QA a main.
- Carta Romo APROBADA (réplica Uki): repo diannaleandra-art/romos-sushi-qa., rama preparacion/romo-carta-neon-panel-20261115, commit 90b06b3f0ccaff4cf77d9741044c170e68e99e7f. Archivos correctos: replica-uki/carta/public/index.html y replica-uki/carta/public/candidata/{app.js,model.mjs,catalog.mjs,delivery.mjs}. Root Vercel REQUERIDO replica-uki/carta.
- Rama que se había usado por error publicacion/romo-carta-whatsapp-20261114: se restauró su portada antigua public/index.html y se retiraron sus adiciones accidentales con commit 971b995cde346e2cf4682b89c92c2075ae955d7f. Esa portada NO es la carta aprobada.
- El proyecto Vercel de la carta que está actualmente publicado apunta al directorio raíz del repo y muestra esa portada antigua. Un build READY allí no demuestra que se publicó la réplica Uki. Hay que desplegar el directorio correcto en un proyecto aislado y propio de Romo, sin reemplazar producción Uki.

## Flujo definido para pruebas manuales y lanzamiento
1. Carta aprobada conserva armado, catálogo, precios de Romo, horario, mapa/ruta y carrito. La comanda añade Importe línea por producto; la suma del pedido debe ser consistente con la revisión del panel.
2. Carta → POST solicitudes pendientes romo_solicitudes_carta_v1 de Neon Romo, con folio RS- de UUID e idempotencia; NO generar orden adicional en Supabase romos_orders desde esta misma compra.
3. El receptor responde estado pendiente sin WhatsApp enviado, sin cobro ni venta. El empleado acepta manualmente con bloqueo de duplicados y CAS en Neon. Solo después se procesa pago, timbres y entrega en el panel.
4. Delivery requiere distancia por calles y monto definitivo entre CLP 1 y 4000 y cobertura hasta 8 km; tarifa pendiente no se imputa como 0.
5. Caja exige apertura real, conteo, cierre único y constancia. Mi Administración solo contabiliza cierres definitivos reconciliados una vez por source_key; está aún pendiente.
6. Inventario, personal, clientes, timbres, siete tipos de movimiento y rectificaciones postcierre deben compararse con Uki oficial antes del lanzamiento de clientes.

## Fuente efectiva de productos: NO confundir
- La antigua portada public/index.html del repo carta lee 12 registros de Supabase public.romos_products. NO es el menú completo aprobado.
- La carta aprobada replica-uki/carta/public/candidata/catalog.mjs y model.mjs emplea menú propio de productos, rolls, extras y promociones con lógica más completa. El panel, aparte, tiene Neon romo_catalogo_v1; NO es fuente sincronizada de esa carta.
- No se ha modificado ningún precio ni sincronizado las dos bases. La edición del menú desde el panel requiere conectar el origen efectivo y confirmar igualdad antes de habilitar guardados.

## Criterios para una sola publicación importante
- Proyecto Vercel exclusivo de Romo panel y proyecto exclusivo de carta correcta con Root Directory replica-uki/carta (o arquitectura equivalente aislada), hosts estables y Firebase autorizado, sin cambiar rutas oficiales Uki.
- Configurar banderas, orígenes y secretos del servidor solo cuando se verifique el destino propio; por defecto se mantiene recepción pública cerrada.
- Confirmar manualmente desde iPhone: pedido con 2 productos y armado por roll, delivery real, aceptación, cobro en medio real, timbre WhatsApp, entrega, dos precierres, cierre, exportaciones, consulta en Mi Administración, historial e independencia Uki.
- Propietaria autoriza pruebas reales controladas en Romo (todavía sin público); no se generarán pedidos ficticios ni cobros automáticos, y las operaciones reales quedarán auditadas. No usar pagos de terceros.
- Trabajar por bloques y reunirlos en commits sin despliegues intermedios. Una sola publicación conjunta después de completar y validar los bloques.

Estado: IMPLEMENTACIÓN PARCIAL, NO LISTA PARA VENTAS A CLIENTES.

## Verificación directa de ambos catálogos — 16-11-2026
Consultas de solo lectura a Neon proyecto `romos-sushi-la-serena` (BD `romos_sushi`) y Supabase proyecto `romos-sushi` (tabla `public.romos_products`). Sin modificaciones de datos ni publicaciones.

| Promoción | Carta aprobada, `candidata/model.mjs` y Neon Romo | Supabase antiguo |
| --- | ---: | ---: |
| 24 piezas | $8.000 | $7.500 |
| 36 piezas | $12.000 | $11.500 |
| 48 piezas | $16.000 | $14.500 |
| 60 piezas | $19.000 | $17.500 |
| 72 piezas | $21.000 | $19.500 |
| 84 piezas | $24.000 | $22.500 |
| 96 piezas | $26.000 | $24.500 |

- Neon `romo_catalogo_v1`: revisión 1; 7 productos, 2 categorías, 40 ingredientes y 3 promociones. Es el registro actual del panel, no el catálogo completo.
- Supabase `public.romos_products`: 12 registros, 7 promociones y 5 extras; es el origen de la portada antigua y NO debe copiarse sobre la carta aprobada.
- La carta realmente aprobada usa `replica-uki/carta/public/candidata/model.mjs`, `catalog.mjs` y `monthly.mjs`, además de su estructura de armado. Por ello los siete precios iguales de Neon NO prueban que esté sincronizada la carta completa.
- NO modificar precios ni sobrescribir registros. La futura edición desde el panel debe leer y guardar la fuente efectiva de la carta aprobada, con permiso de la dueña, revisión concurrente, historial y verificación manual del resultado público.
- Mantener el bloqueo existente que impide que `uki-carta-precios-admin.js` guarde desde la sucursal Romo contra la API oficial de Uki. No señalar la edición de Romo como completa hasta que el circuito de escritura esté conectado y validado.
- El enlace de recepción en `candidata/app.js` aún apunta al endpoint de un preview de panel Uki/Romo; reemplazarlo por un destino exclusivo de Romo al preparar la publicación conjunta y mantener la recepción pública desactivada mientras tanto.
- Próximo trabajo de implementación: definir un único catálogo efectivo para carta y panel Romo; mapear todas las categorías, promociones, extras, ingredientes y productos SIN recortar ni recrear el menú; conectar guardado autorizado, comprobar que la carta refleja los cambios, y únicamente entonces completar el lote con caja, cierres y Mi Administración.

**Regla de publicación preservada:** esta actualización es exclusivamente documental en la rama de preparación; no se despliega, no toca `main` ni activa ventas.


## Bloque preparado de contrato completo de carta y comparador privado
Fecha 2026-11-16. **Código en ramas de preparación, no desplegado, no probado con operaciones comerciales**.

### Carta aprobada de Romo (repositorio `romos-sushi-qa.`)
- Nuevo contrato solo lectura `replica-uki/carta/lib/romo-catalogo-aprobado-qa.mjs`: obtiene los productos directamente de los módulos aprobados `model.mjs`, `monthly.mjs` y `catalog.mjs`. No se basa en los 12 registros antiguos de Supabase ni en el documento incompleto de 7 productos Neon.
- Conjunto previsto a partir de los módulos de la carta: 7 promos clásicas, 8 premium, 3 elementos del módulo mensual (incluyendo handroll), 12 platos/gohan/burger, 6 toppings y 4 adicionales de salsa: **40 entradas de venta**. Propuesta de clasificación para la futura interfaz: 9 categorías. Las fotos, conteos de rolls, salsas, beneficios y medios de pago ya definidos en la carta permanecen en su módulo original.
- El contrato también enumera vegetales, proteínas, envolturas y salsas con sus contextos. NO fija un único recargo universal: un ingrediente puede tener precios diferentes en clásico, premium, mensual o burger.
- Endpoint `replica-uki/carta/api/romo-catalogo-aprobado-qa.js` GET únicamente; desactivado por defecto. Requiere Preview de la rama correcta, `ROMO_CATALOGO_APROBADO_QA_ENABLED=true` y el origen específico del panel autorizado. No realiza escrituras ni habilita pedidos.

### Panel Romo (repositorio `uki-panel-demo-independiente`)
- Comparador puro `lib/romo-catalogo-paridad-aprobada-qa.mjs`: reconoce como equivalentes verificables solo las siete promociones clásicas `classic:NN` de la carta frente a `romo:piezas:NN` de Neon. NO empareja por similitud de texto el resto de productos y no decide altas, bajas ni precios.
- Endpoint privado `api/romo-catalogo-paridad-qa.js`: exclusivo de dueños autenticados por Google/roles Neon, consulta ambas fuentes, no guarda. Requiere `ROMO_CATALOGO_PARIDAD_QA_ENABLED=true` en Preview y `ROMO_CARTA_CATALOGO_QA_ORIGIN` del proyecto de carta correcto; por defecto no está habilitado.
- Faltan implementación y validación de las escrituras efectivas en la misma fuente que consume la carta, el historial/auditoría de ediciones, la integración del editor completo y la prueba manual de cambios visibles al cliente. **No anunciar el CRUD ni la sincronización como terminados**.
- Nunca activar los endpoints antes de aislar la carta y el panel en proyectos Romo, confirmar los orígenes, permisos y variables, y planificar la publicación conjunta.
- No se alteraron recetas, armado, ventas, pagos, timbres, registros comerciales, datos Uki, ni se aplicaron migraciones en Neon/Supabase.

### Próxima intervención
Una capa única de edición de Romo que, con autorización de dueños y control de revisión concurrente, permita administrar categorías, productos, promociones, extras y precios a partir de la carta aprobada. Confirmar que una edición queda reflejada tanto en carta como en panel; impedir confirmaciones falsas. Completar junto con los pendientes de caja, trabajadores y Mi Administración antes de la publicación conjunta.


## Bloque siguiente: edición segura como cambios sobre la carta aprobada
Fecha 2026-11-16. **PREPARADO EN GITHUB, NO HABILITADO Y SIN PUBLICACIÓN**.

### Archivos agregados en rama `preparacion/uki-romo-sobre-main-20261114`
- `sql/romo_carta_ediciones_seguras_preparacion_20261116.sql`: migración todavía **NO ejecutada**, crea un único documento independiente de cambios sobre la carta y una bitácora de auditoría; NO reemplaza `romo_catalogo_v1`, no toca pedidos/caja ni datos Uki.
- `lib/romo-carta-ediciones-seguras-qa.mjs`: calcula huella de la carta completa aprobada, exige 40+ entradas de venta, valida categorías/SKU/precio/disponibilidad/nombre/descripción, conserva solo modificaciones del producto elegido. Edición exclusiva de dueños con revisión esperada; primera escritura o actualización CAS y asiento de auditoría unidos en una sentencia SQL, con rechazo de conflictos.
- `api/romo-carta-ediciones-seguras-qa.js`: GET y POST privados con token Google verificado y rol dueño de Neon Romo; consulta únicamente la carta aprobada desde un origen permitido; guardado solo en Neon Romo de su propia base; responde error sin declarar éxito ante fallos. `ROMO_CARTA_EDICIONES_QA_ENABLED` queda APAGADA por defecto y exige Preview de rama Romo.
- `public/romo-panel-qa/romo-carta-editor-seguro-qa.js`: interfaz móvil negra/roja para localizar, filtrar y editar los 40 productos; responsable vía sesión Google, motivo obligatorio, mensaje explícito tras guardar y comprobación manual. **Todavía NO está importada ni montada en el panel oficial**.

### Reglas importantes
1. Ninguna tabla migrada o dato financiero modificado; no hay producto guardado desde este nuevo código, ni venta, QR, timbre o cobro generado. La versión de producción Uki permanece en `main` y no debe recibir este bloque.
2. El catálogo aprobado en código sigue siendo la referencia de precios y recetas; el registro nuevo solo conserva alteraciones acotadas. Se bloquean cambios sobre productos desconocidos o sobre una carta cuyo contenido base cambió.
3. Este bloque **NO constituye aún una conexión funcional de editor a carta pública**. Falta endpoint de lectura pública aislado para Romo, reflejar ediciones en `model.mjs`/`monthly.mjs`/`catalog.mjs` antes de permitir compra, habilitar creación y eliminación de categorías/productos con registro, fotos, ingredientes y promociones completas, y verificar a mano desde iPhone.
4. Debe distinguirse «guardado en Neon Romo con auditoría» de «cambio visible y seguro para clientes». El guardado jamás debe afirmar publicidad o sincronización sin verificación.
5. La migración SQL requiere revisión de respaldo, ejecución autorizada en la única base `romos_sushi`, configuración del servicio del proyecto exclusivo Romo y comprobación manual de lectura/escritura. No ejecutarla por iniciativa del despliegue.
6. La vista del editor NO se monta ni configura en Vercel hasta completar el circuito de lectura pública y acordar la publicación de carta y panel juntos; no gastar publicaciones intermedias.

**Siguiente bloque exacto:** preparar la lectura pública de alteraciones del catálogo desde el entorno exclusivo Romo y la aplicación controlada al modelo de carta (incluyendo salsas y extras sin mutar valores inmutables); luego homologar categorías CRUD, fotos, ingredientes y armado con las funciones oficiales Uki. Después, cobros/caja/cierres/administración y pruebas reales manuales antes de activar clientes.


### Proyección pública de cambios para la carta correcta
- Nuevo `api/romo-carta-cambios-publicos-qa.js` (solo GET, en Preview, inactivo por defecto por `ROMO_CARTA_CAMBIOS_PUBLICOS_QA_ENABLED`). Genera una proyección pública exclusivamente de modificaciones de catálogo, sin exponer el usuario que las guardó ni el motivo de auditoría.
- Consulta la base aprobada y el documento independiente con el mismo hash; se niega a contestar si cambió la carta base o hay inconsistencia. No modifica la carta ni acepta pedidos.
- **Aún no se ha conectado la aplicación de cambios del lado del cliente**: editar en Neon NO equivale a actualizar `candidata/model.mjs`, `monthly.mjs` o `catalog.mjs`. El modelo aprobado conserva campos inmutables (p. ej. salsas adicionales); antes de habilitar cualquier edición habrá que garantizar su aplicación real en el precio, el total de cada producto, carrito, comanda y medios de pago. En caso de fallo de lectura al habilitar clientes, la venta debe bloquearse, no mostrar un precio antiguo como confirmado.
- La capa de Vercel independiente de Romo y las rutas correctas de la carta aún requieren preparación y validación en entorno aislado. Ninguna bandera ni variable nueva se ha activado.


## Integración de catálogo en memoria y puente de lectura — siguiente bloque
Fecha 16-11-2026. **Trabajos técnicos en la rama preparatoria de la carta Romo; SIN despliegue autorizado ni pruebas comerciales.**

En `diannaleandra-art/romos-sushi-qa.` / `preparacion/romo-carta-neon-panel-20261115` se guardó:
1. `replica-uki/carta/lib/romo-catalogo-aprobado-qa.mjs`: sus importaciones de `monthly.mjs` y `catalog.mjs` ahora usan exactamente los mismos sufijos de versión que `model.mjs`. Corrige riesgo de instancias ES independientes entre panel, carrito y promociones.
2. `replica-uki/carta/public/candidata/romo-proyeccion-catalogo-qa.mjs`: prepara una vista de 40 productos con SKU/tipo/identificador/precio base identificables, rechaza cambios duplicados, atributos desconocidos, precios y categorías inválidos; detecta productos no disponibles en un carrito. Conserva instantánea inmutable de la carta base.
3. `replica-uki/carta/public/candidata/romo-aplicar-catalogo-qa.mjs`: adapta precios y nombres/descripciones compatibles a los módulos de la carta, con comprobación previa de las 40 entradas, rollback en caso de error y solo cuando el carrito esté vacío. Bloquea cambios de categoría o textos que la actual interfaz aún no reflejaría. **No está importado por la carta pública.**
4. `replica-uki/carta/public/candidata/model.mjs`: conserva el precio de Soya, Teriyaki, Wasabi y Jengibre, pero deja fijas sus claves y permite ajustar en memoria un importe auditado mediante `Object.seal`. No cambia valor alguno ni el armado.
5. `replica-uki/carta/api/romo-cambios-carta-qa.js`: puente de solo lectura de cambios desde panel Romo con validación de entorno Preview, rama y orígenes; bandera `ROMO_CARTA_PUENTE_CAMBIOS_QA_ENABLED` apagada por defecto. Si el panel no confirma, responde error 503: no utiliza precios de respaldo.
6. `replica-uki/carta/public/candidata/romo-inicio-catalogo-qa.mjs`: prearranque que exige consulta completa y aplica una única revisión en memoria. **Devuelve `permiteCompras:false` y no se monta en `public/index.html`**.

**Regla crítica de seguridad y paridad:** La preparación NO confirma que el carrito actual, las tarjetas de promociones, la comanda o el envío a WhatsApp ya apliquen todas las modificaciones. **No activar ni montar estas piezas todavía**. Pendiente controlar disponibilidad ANTES de agregar al carrito, revalidar revisión/precios al enviar la solicitud, mostrar disponibilidad en el menú, asegurar total de pedido y comanda idénticos y corregir nombre/categoría/ingredientes/fotos/promociones CRUD sin alterar el armado. No aceptar escrituras desde el editor hasta tener la lectura pública confirmada y este circuito verificado manualmente.

**Verificación independiente:** no se crearon las tablas `romo_carta_ediciones_v1` ni `romo_carta_ediciones_auditoria_v1` en Neon Romo. El proyecto Vercel `uki-sushi-inventario` mantiene como producción el commit `3274dbc1`; ningún paso de esta preparación fue promovido desde este chat a producción. El despliegue de otros proveedores no se ha comprobado aquí. No se generaron pedidos, ventas ni pagos de prueba.

**Próximo trabajo exacto:** adaptar la interfaz de la carta aprobada para emplear la vista efectiva en todos los cálculos/visibilidades; fijar revisión y verificarla al confirmar; después probar con la propietaria operaciones manuales reales con Romo todavía no comercialmente activo. Mantener la publicación conjunta como único lanzamiento.


### Corrección comprobada de etiqueta de salsas adicionales
- En el `app.js` aprobado de Romo se encontró un texto de armado `$600 c/u` fijado manualmente, incompatible con `extraSaucePrices` de `model.mjs` (Soya $500, Teriyaki $500, Wasabi $500, Jengibre $400).
- Corregido en `replica-uki/carta/public/candidata/app.js`, rama de preparación `preparacion/romo-carta-neon-panel-20261115`: el texto ahora utiliza `money(extraSaucePrices[extra.name])`, el mismo origen que `quote()`.
- Se preservan todos los importes aprobados, recargos y reglas de armado. **No se ha publicado ni comprobado visualmente desde el iPhone**.
- La preparación del puente carta-panel de esta sesión continúa sin conectar `index.html` a los módulos QA y conserva las banderas de escritura/lectura desactivadas; falta comprobar disponibilidad y revisión al confirmar la orden.
