# Romo Sushi La Serena — estado consolidado de integración única
Fecha de revisión: 16 de noviembre de 2026  
**La carta y el panel todavía NO están listos para abrir pedidos públicos.**


## Control de rumbo y no duplicación — revisión directa del 16-11-2026

**Fuente única de decisiones:** este documento para la entrega conjunta y `AUDITORIA_PARIDAD_UKI_OFICIAL_ROMO_20261114.md` para los faltantes técnicos. No abrir nuevos proyectos, cartas, paneles, copias ni documentos de seguimiento. Trabajar solo en las dos ramas de preparación señaladas debajo.

**NO REHACER (existe en código; algunas funciones aún no están desplegadas o probadas):** diseño negro/rojo y armado aprobado de Romo; 40 productos base; fotos y rutas; delivery por calles; prearranque y guardia de precio/stock; cotización del servidor; recepción pendiente con clave idempotente; inventario y PIN propio Romo; faltantes; controles de pedidos con búsqueda y filtros, timbres y pagos mixtos; siete pestañas visibles de Caja. Verificar y conectar lo existente, no crear sustitutos.

**DIFERENCIA REAL COMPROBADA FRENTE A UKI `main`:**
- `ndGuardar()` en Romo deriva a `ukiRomoGuardarPedidoPendienteQA()` o `ukiRomoAceptarSolicitudCartaQA()`; la primera ruta restringe edición, pagos mixtos y propinas. Ese procedimiento no es el oficial completo de Uki.
- `vPedidos()`, `vClientes()` y `vCaja()` aún derivan a vistas específicas de Romo; estas ya poseen parte del filtrado y controles oficiales, pero no son operativamente equivalentes sin acciones y guardado compartidos con su CAS de Neon.
- `guardarEnLocalStorage()` para Romo devuelve `Promise.resolve(false)`: **este bloqueo ya existe y funciona como protección de separación**. No cambiarlo a éxito ni intentar volver a guardar Romo en el almacenamiento de Uki.
- El editor de Romo ya tiene precios y disponibilidad en revisión auditada, pero no el CRUD completo de productos/categorías/ingredientes/fotos/descuentos de Uki. Las banderas de recepción y edición siguen apagadas y la revisión inicial de catálogo no fue confirmada por la dueña.

**ERROR REAL CORREGIDO AQUÍ:** en el `checkout.onsubmit` de `app.js`, un comentario `//` tras fijar `href='#'` había absorbido `#ready.hidden=false`, el armado de comprobante y el texto de preparación. Se reparó de forma puntual en la rama Romo (commit `03a414ac69f8e6e89e3289d4dc93d7b5dc9b4a4c`) sustituyendo ese comentario por `/*…*/`. No se modificaron precios, imágenes ni reglas.

**SIGUIENTE SECUENCIA SIN CAMBIAR DE OBJETIVO:** 1) adaptar las acciones y validaciones del formulario oficial de pedidos al CAS Romo — edición, aceptación, mixtos, propinas, entrega y reversión sin cobros de prueba —; 2) reutilizar las pantallas oficiales una vez que sus acciones persistan correctamente; 3) cerrar paridad de las 7 pestañas y movimientos de Caja y timbres; 4) completar administración del catálogo e inventario/fotos; 5) Mi Administración con cierres definitivos idempotentes; 6) revisión manual de extremo a extremo; 7) publicación conjunta. Si una acción carece de persistencia confirmada en Neon, permanece desactivada.

**Sin publicación:** no se cambió `main` Uki, no se ejecutaron pedidos/cobros/cierres de prueba, no se activaron banderas de recepción ni se inicializó el catálogo comercial.



## Objetivo acordado
Replicar el sistema oficial aprobado de Uki Sushi (La Serena y Regimiento Arica) en Romo Sushi La Serena: mismos procedimientos, sin pizzas, marca negro/rojo y precios/datos/caja de Romo independientes. No sustituir una función aprobada por otra más simple ni modificar el sistema comercial de Uki. Reunir los cambios para una publicación conjunta, no una publicación por ajuste. Las comprobaciones de pedidos, caja, trabajadores y cobros serán manuales.

## Cambios efectivamente realizados — código de preparación
**Carta Romo** — `diannaleandra-art/romos-sushi-qa.`, rama `preparacion/romo-carta-neon-panel-20261115`:
- Conserva `replica-uki/carta/public/index.html` y los módulos aprobados del armado, carta premium, menú por categoría, delivery por calles y comprobante.
- Identifica las 40 entradas de venta existentes en la carta aprobada, no las 12 de la portada Supabase antigua ni las 7 del catálogo parcial Neon.
- Prepara el catálogo efectivo de 40 SKU, precio/disponibilidad y los controles de carrito (incluidos toppings y salsas extra).
- El `index.html` de la rama ahora apunta a `romo-arranque-protegido-qa.mjs`: si no hay revisión fiable de precios, no abre la carta para vender. Este arranque **no ha sido desplegado ni verificado manualmente**.
- La comprobación del carrito cubre agregar productos y antes de WhatsApp, comprobante y QR. El modelo y el comprobante ya apuntan a la misma versión de precios, con firma «Romo’s Sushi».
- La ruta de recepción `/api/romo-recepcion-carta-qa` y el banner `/api/romo-banner-carta-qa` ya no usan URLs temporales de un preview Uki; ambos siguen desactivados por defecto hasta tener el panel Romo independiente.
- El cotizador `/api/romo-cotizacion-servidor-qa` prepara cotización de clásicos, premium, handroll, mensual, platos, toppings, salsas, recargos, medio de pago y delivery por calles, con desglose de cada línea y secreto exclusivo servidor-servidor. No ha sido ejecutado contra ventas.
- La lógica de cálculo del servidor y los módulos QA requieren validación manual de extremo a extremo, y su habilitación debe ser posterior a los permisos y orígenes estables.

**Panel Romo** — `diannaleandra-art/uki-panel-demo-independiente`, rama `preparacion/uki-romo-sobre-main-20261114`:
- Integrado el editor de Romo dentro de la pestaña «Carta y precios» de Inventario, **no** en una API de Uki. La edición está protegida por Google + rol `duenos` de Neon Romo, bandera QA desactivada y auditoría.
- El editor ofrece búsqueda, precio, disponibilidad y campos compatibles; evita permitir cambios de nombre/categoría/descripcion que todavía no se reflejen correctamente en la carta pública. Falta CRUD completo de categorías y productos, ingredientes y fotos, tal como en Uki.
- Preparada inicialización explícita por la dueña de la revisión comercial 1 de los 40 productos sin cambiar ningún precio; NO se ha ejecutado.
- El receptor de solicitudes `lib/romo-solicitudes-carta-qa.mjs` fue reconstruido desde el archivo original para evitar funciones duplicadas; ahora exige cotizador servidor, firma de revisión, coherencia de importes de la comanda, `request_key` idempotente y una fila de catálogo persistida bloqueada `FOR SHARE` en el INSERT. Rechaza la recepción sin esa fila.
- El estado de recepción público tampoco anuncia que está listo sin revisión comercial persistida; sigue sin activar `ROMO_SOLICITUDES_PUBLICO_QA_ENABLED`.
- CSS negro/rojo únicamente cuando se selecciona Romo; no cambia las sucursales Uki.

## Datos realmente verificados en Neon Romo
Proyecto Neon `romos-sushi-la-serena`, base `romos_sushi`.
- Se CREARON las tablas adicionales `public.romo_carta_ediciones_v1` y `public.romo_carta_ediciones_auditoria_v1` con permisos para el rol exclusivo `romos_app_service`. No se alteró la tabla original `romo_catalogo_v1`, la caja ni los cierres.
- Verificación posterior: **0 ediciones y 0 asientos de auditoría**, sin inicialización comercial. Había **2 solicitudes de carta** en la base, que no fueron creadas ni aceptadas por este trabajo.
- No se grabó una venta, un pago, un cierre, un timbre ni un precio nuevo como parte de esta integración.

## Comparación con Uki oficial: pendientes que siguen siendo reales
La inspección documentada en `AUDITORIA_PARIDAD_UKI_OFICIAL_ROMO_20261114.md` mantiene las siguientes diferencias sin resolver:
- Bandeja/edición avanzada de Pedidos, WhatsApp, búsqueda e historial: Romo sigue desviando parte del procedimiento oficial a vistas especializadas.
- Clientes y timbres: todavía no equivale a la ficha completa Uki.
- Caja: 7 pestañas visibles, pero no está homologado el contenido y guardado de sus 7 tipos de movimientos, pagos mixtos, propinas, caja acumulada, precierre, cierre, rectificaciones y exportaciones.
- Inventario: falta prueba manual completa del PIN de 6 dígitos, historial, existencias, exportación PDF/Excel y separación por local.
- Carta: faltan creación/edición/eliminación de categorías y productos, fotos, ingredientes, promociones y descuentos desde el panel, con reflejo real en carta y armado.
- Mi Administración: importar solo cierres DEFINITIVOS de Romo, una vez por `source_key`; no tratar solicitudes, precierres o movimientos no conciliados como ventas.
- Pedido de mesa por QR: sigue cerrado hasta contar con el mismo proceso de recepción y confirmación segura que el resto.
**Estos apartados NO están terminados por haber creado el puente de catálogo.**

## Infraestructura y publicación
- La producción del proyecto Vercel `uki-sushi-inventario` mantiene el commit oficial `3274dbc1b66b676663b74d74ae40f84d251b3ee9`. No se promovió esta rama a `main`.
- En los proyectos accesibles de Vercel se detectaron cuatro con nombres Uki; todavía no se ha verificado un par de proyectos Romo independientes con origen estable (panel y carta correcta).
- Todas las nuevas banderas de los endpoints Romo siguen APAGADAS por defecto. La rama de carta incluye bloqueo de despliegue Git automático para evitar avances parciales.
- No se ejecutaron pruebas automáticas ni simulaciones de cobros; la revisión fue de código y consultas de solo lectura, salvo la creación no destructiva de las dos tablas exclusivas del editor.

## Lista mínima de salida conjunta (todas deben aprobarse manualmente)
- [ ] Configurar los proyectos y URLs de Romo independientes, secretos servidor-servidor, Google autorizado y las banderas por entorno, sin enlazar la carta a Uki.
- [ ] Revisar el menú aprobado completo (40 entradas y contexto de ingredientes), registrar la revisión comercial inicial por la dueña y confirmar cambios de precio/disponibilidad en carta y panel.
- [ ] Homologar CRUD completo de categorías, productos, ingredientes, promociones, fotos y descuentos, sin perder la función de armado aprobada.
- [ ] Confirmar cada ruta de agregado al carrito, cotización servidor, precios por línea, recepción pendiente, WhatsApp y QR de mesa con revisión vigente y bloqueo de duplicados.
- [ ] Verificar delivery real por calles, tarifas, monto de caja/delivery y aceptación manual del pedido.
- [ ] Comprobar presencialmente pedidos, búsqueda, clientes/timbres, pagos mixtos, propinas, 7 movimientos, precierre, cierre y acumulado, sin confundir estados con ventas.
- [ ] Probar ingreso de trabajadores e inventario, historiales, exportaciones y correcciones autorizadas.
- [ ] Comprobar un cierre definitivo en Mi Administración con registro único, sin afectar Uki.
- [ ] Hacer respaldo y aprobar la **publicación conjunta** una sola vez cuando todos los puntos anteriores funcionen.

**Estado final actual: código de integración avanzado, pero paridad funcional y seguridad comercial NO certificadas. No activar recepción pública hasta completar lo anterior.**


## Avance posterior: stock visible, rutas coincidentes y aislamiento de producción
16 de noviembre de 2026 — **guardado únicamente en las ramas de preparación, sin publicación ni pruebas de operaciones**.

### Carta Romo (repositorio `diannaleandra-art/romos-sushi-qa.`)
- `romo-guardia-catalogo-qa.mjs`: la vista aprobada expone a la interfaz la consulta de disponibilidad por SKU, siempre detrás del prearranque auditado.
- `app.js`: señala «Agotado temporalmente» y desactiva la acción de sumar promociones clásicas/premium, handrolls, mensuales, platos, toppings y salsas adicionales cuando la revisión del panel indique no disponible. También valida agregar un topping asociado a otra promo (ruta que antes omitía la guardia), los aumentos de cantidad desde el carrito y la selección de salsas extras en el armado. Corregida la frase premium «Más Uki» por «Más Romo».
- `romo-inicio-catalogo-qa.mjs`: no abre el armado comercial si no existe revisión 1 o posterior firmada desde el panel de dueños. La revisión 0 de catálogo se puede CONSULTAR desde el editor, pero no vender.
- `api/romo-cotizacion-servidor-qa.js`: usa exactamente las mismas fuentes OSRM y contingencia Valhalla del endpoint oficial `api/route.js`, y redondea los kilómetros a 5 decimales antes de calcular delivery. Si el recorrido no coincide con el valor del navegador, el pedido se rechaza: no cobra otro valor ni cambia el pedido.

### Panel Romo / aislamiento
- `lib/romo-entorno-panel.cjs`: el único guard de producción exclusivo de Romo no permitirá activación con origen `uki-sushi-inventario.vercel.app` ni rama `main`. Requerirá `ROMO_PANEL_ISOLATED_PROJECT=romo-sushi-panel`, origen HTTPS explícito Romo y `ROMO_PANEL_PRODUCTION_ENABLED=true`. **No se activó ninguna bandera**. Otros endpoints nuevos siguen específicamente limitados a Preview: antes de producir se deberá extender el mismo cierre de alcance a TODOS ellos y comprobar la conexión.
- La edición de carta, caja e inventario aún no se ha probado visual o funcionalmente de extremo a extremo. El estado de producción no cambia por estos archivos.

### Limitaciones a resolver antes de dar paridad por terminada
- El stock agotado se indica en la carta nueva cuando carga la revisión; páginas abiertas con revisión anterior quedan protegidas en el envío, pero no se refrescan en vivo sin recarga.
- El sistema de categorías, productos nuevos, ingredientes, fotos, descuentos y promociones con configuración continúa NO equivalente a todo el CRUD de Uki. No fingir que `romo_carta_ediciones_v1` cubra esos cambios; solo precio, disponibilidad y campos compatibles existentes.
- La recepción de nuevas solicitudes está condicionada a un cotizador de servidor y a revisión 1+, aún sin validación manual. Cambios en medios de pago, delivery en efectivo, caja, timbres y cierres siguen sujetos a conciliación real.
- Los módulos de Caja (7 movimientos, precierre/cierre, pagos mixtos, caja acumulada y ajustes) y Mi Administración siguen con los bloqueos descritos en la auditoría oficial; no activarlos artificialmente. Los códigos QA de apoyo no sustituyen las acciones reales de Uki.

**Regla:** sin cambio a `main` Uki, sin producción Romo, sin modificar el inventario/caja/pedidos reales y sin pruebas automáticas. Un solo lanzamiento Romo cuando el conjunto quede verificado manualmente.


## Corrección de imágenes reales de Romo — 16-11-2026
La propietaria comprobó en iPhone que la carta aprobada desplegada el 15-11-2026 mostraba signos de imagen rota «?» dentro de las tarjetas de piezas 24/36/48/60/72/84/etc. y en el retrato grande «Tabla real de rolls Romo’s Sushi, vista completa».

Se inspeccionó el código exacto de la carta en `diannaleandra-art/romos-sushi-qa.`, rama `preparacion/romo-carta-neon-panel-20261115`, no se sustituyó por la antigua:
- **Causa confirmada:** `app.js` usaba rutas relativas `assets/roll-selector.svg` y `assets/rolls-premium-luz.jpg`, que se resolvían desde `/`; los archivos están realmente en `/candidata/assets/`.
- `replica-uki/carta/public/candidata/app.js` ahora utiliza rutas absolutas `/candidata/assets/…` para ícono de selección, foto grande, gohan, burger y foto de promo sushi burger. La foto grande dispone de respaldo de fotografía de palta y se oculta si ni ésta carga. Las fotos dinámicas no dejan iconos rotos.
- `replica-uki/carta/public/index.html` corrigió las **6** rutas de `data-photo` en la galería ampliable, que también apuntaban a la carpeta equivocada, y oculta imágenes fallidas sin borrar secciones ni alterar valores comerciales.
- Se comprobó leyendo el directorio de GitHub que **los 10 nombres de recursos** citados realmente están presentes en `public/candidata/assets/`. No quedaron en `app.js` rutas literales `'assets/…` ni en `index.html` `data-photo="assets/…`.
- Se conservaron el diseño aprobado negro y rojo, la carta de 40 productos, el armado, los precios, el carrito, el cálculo de delivery y el objetivo de un solo lanzamiento. **No se desplegó esta corrección**; debe confirmarse visualmente en la siguiente publicación conjunta y en el iPhone.

Los enlaces de Vercel vistos por la propietaria siguen mostrando la versión de ayer hasta que se publique la actualización; no afirmar que los signos ya desaparecieron en esos enlaces. La aceptación manual de pedidos y los otros pendientes de paridad oficial Uki siguen bajo los mismos bloqueos.


## Integración de faltantes Romo desde su inventario real
16-11-2026. Código consolidado en rama `preparacion/uki-romo-sobre-main-20261114`, no publicado.

Se confirmó desde el código que `public/romo-panel-qa/uki-inventario-admin-embebido.js` YA dispone de la ruta exclusiva `/api/romo-inventario-qa`, identidad Google, revisión y separación `storeId=romo:serena`, y que la vista de historial de inventario Romo utiliza `X.reports`. No crear otro inventario ni importar existencias de Uki.

- `public/romo-panel-qa/uki-carta-precios-admin.js`: corregidas las lecturas inadvertidas de precios/faltantes de Uki desde Romo al entrar en `Revisiones y compras` o cambiar la selección de sucursal. La API Uki sigue permitida SOLO al estar en Uki. El editor de Romo permanece independiente.
- `public/romo-panel-qa/uki-inventario-admin-embebido.js`: expone un snapshot **local, de solo lectura, exclusivamente si el inventario propio Romo está cargado y la sucursal del panel es Romo**. Incluye nombres, unidades, cantidades y mínimos únicamente de esa sucursal. Tras actualizarlo invoca el refresco local del reporte; no hace nuevos POST, cobros, ni escrituras comerciales.
- La sección `Revisiones y compras` ahora reutiliza el cálculo aprobado de faltantes: «Hay / Mínimo / Pedir», búsqueda por nombre, faltantes y artículos justo al mínimo, usando el inventario real de Romo y sus unidades, no los datos Uki. Si Romo aún no está cargado, indica abrir Inventario y actualizar en vez de mostrar datos falsos.
- El estilo de las tarjetas de faltantes de Romo cambia solo allí a negro/rojo y fondo neutro, manteniendo los colores y el procedimiento oficial para Uki sin modificación.
- **No se aplicaron cambios en Neon, pedidos, inventarios ni producción de ninguno de los dos locales.** Es código preparado en GitHub, sin prueba manual todavía. El módulo de reporte no debe anunciarse como certificado hasta abrir Romo en el panel, actualizar inventario y revisar el cálculo con el teléfono.

Resto pendiente: carta completa CRUD, fotos, ingredientes/promociones, roles y operaciones de caja/cierre con fidelidad Uki, pruebas manuales, y publicación conjunta sobre los proyectos Romo propios.


## Cotejo completo de cocina y pedido antes de WhatsApp
16-11-2026 — avance guardado SIN despliegue ni operaciones de prueba.

- `replica-uki/carta/public/candidata/model.mjs` exporta `renderCocinaRomoQA` reutilizando la función de redacción original para cocina. **Sin alterar el precio o el diseño aprobado**.
- `replica-uki/carta/api/romo-cotizacion-servidor-qa.js`: el cotizador privado genera la comanda desde cada producto estructurado, sus rolls, ingredientes, cantidades, topping y extra; luego sustituye **solo el importe por línea** por el cálculo efectivo de revisión auditada. Adapta nombres de productos compatibles, preservando el armado. Devuelve `cocinaLineas` de servidor junto al desglose monetario.
- `lib/romo-cotizacion-servidor-qa.mjs`: comprueba que existe una línea de cocina por producto, con límites de tamaño, antes de aceptar la cotización; admite la respuesta de combos extensos dentro del tamaño autorizado.
- `lib/romo-solicitudes-carta-qa.mjs`: antes de INSERT se contrasta la sección exacta `*COCINA*` del mensaje del cliente con la redacción canónica del cotizador. Solo se permiten observaciones al final; se valida además el tipo de entrega, la URL del punto de reparto si es delivery, el medio de pago y los importes por línea/subtotal/total. Si hay diferencias, el pedido **no se registra como pendiente**.
- `replica-uki/carta/public/candidata/app.js`: elimina el `href` de WhatsApp anticipado en el resumen (ahora `#`). El botón solo navega a WhatsApp después de registrar la solicitud `pendiente` en Neon Romo. Se evita el acceso mediante menú contextual al mensaje de WhatsApp antes de esa confirmación.
- `api/romo-solicitudes-carta-qa.js`: el estado de recepción pública `enabled:true` exige también que el cotizador servidor-servidor esté configurado (origen HTTPS de Romo y secreto), además de las banderas de aceptación y revisión de catálogo.

**Conservación:** `uki-panel-demo-independiente/main` y los locales oficiales Uki no se han modificado. Sin pedidos, precios, caja, timbres, compras, pagos o cierres grabados en este bloque. Las modificaciones solo están en las ramas preparatorias Romo.

**Falta antes de habilitar pedidos reales:** revisar la carga de las 40 entradas, el arranque protegido, la inicialización expresa de catálogo por dueños, las credenciales/roles/orígenes de proyectos Romo independientes y efectuar las pruebas comerciales **manuales** de cada familia de productos y entrega en el iPhone. No publicar únicamente este parche: se mantiene el lanzamiento conjunto.


## Bloque de integridad: revisión inicial del catálogo obligatoria
16-11-2026. En la rama de preparación del panel de Romo, **sin despliegue ni movimientos en Neon**, `lib/romo-carta-ediciones-seguras-qa.mjs` rechaza ahora explícitamente cualquier edición de producto mientras `romo_carta_ediciones_v1` no tenga una revisión inicial confirmada (revisión 1+). La primera revisión únicamente la puede crear la propietaria con el botón de inicialización manual que no cambia precios ni disponibilidad, guardando responsable/motivo y registro en auditoría. `public/romo-panel-qa/romo-carta-editor-seguro-qa.js` deshabilita el botón Guardar durante la revisión 0 y explica la causa. Se conservó el carácter exclusivo de Romo (no escribe en Uki).


## Paridad de Pedidos: edición pendiente sin cobro
16-11-2026 — **implementado en código de preparación, aún sin publicar ni comprobar en iPhone**.

Se detectó un bloqueo concreto: el formulario oficial `editarPedido(id)` ya estaba copiado de Uki, pero `ndGuardar()` en Romo siempre lo enviaba a la vía de **crear pedido nuevo** (`ukiRomoGuardarPedidoPendienteQA`) que rechazaba `D.editando`. Además la bandeja Romo mostraba un editor opcional `window.ukiRomoEditorPedidoQA` sin implementación, por lo que no abría el mismo formulario.

Corrección sin duplicar pantallas:
- `public/romo-panel-qa/index.html`: la misma tarjeta de Pedidos Romo contiene ahora «Editar pedido pendiente», que abre **`editarPedido(id)` del formulario Uki ya existente**; `ndGuardar()` distingue `D.editando` y dirige a `ukiRomoEditarPedidoPendienteQA()` antes de las rutas de aceptación y nuevo pedido.
- `public/romo-panel-qa/uki-romo-edicion-pendiente-qa.mjs`: módulo puro que toma una copia aislada `datosSoloSucursal()`, compara el pedido existente, valida identidad del responsable, modalidad, WhatsApp, productos reales, cantidades e importes; **no usa un pedido nuevo ni altera su ID, turno o solicitud**. Solo permite pendientes no pagados y sin QR, cobros externos, propinas ni cierres; mantiene el estado previo de pago. Rechaza totales incorrectos, códigos cambiados y aplicaciones como medio de pago del delivery.
- Al confirmar manualmente, `ukiRomoGuardarOperacionQA` reutiliza el CAS cifrado Neon Romo. **S.pedidos solo cambia después de confirmación del servidor**. Un fallo deja el formulario sin aparentar éxito.
- Se conserva el historial compatible con `correccionesTurno` del formato oficial y `historialCambios` de la bandeja actual, ambos representan **una misma corrección**, con responsable, fecha, foto antes/después, sin cobro/timbre nuevo.
- Se restringe la edición de pagos ya confirmados, pedidos entregados y turnos cerrados: requieren procedimiento contable específico, no permitir un cambio simple sin conciliación.

**Aún pendiente**: completar y validar manualmente edición de pedidos pagados, correcciones de caja, QR y cuentas de mesa, pagos mixtos y propinas desde el flujo íntegro oficial de Uki. El cambio anterior NO acredita paridad global de Pedidos ni cierre ni ventas. No se activaron endpoints de producción.


## Rectificación administrativa de pedidos pagados, sin alterar caja
16-11-2026. Estado: **solo código de preparación, NO publicado y NO verificado mediante operaciones comerciales.**

Se contrastó directamente la edición oficial de Uki (`ndGuardar`, `ukiPagoModificado`, `ukiCobroPendiente`, `ukiPrepararAjusteCobro`, `ukiFotoCorreccionPedido`) con los cobros de Romo (`ukiRomoConfirmarCobroQA`, `ukiRomoLeerDistribucionQA`, `ukiRomoGuardarOperacionQA`). Uki ajusta, al editar una venta pagada, caja, medios efectivamente recibidos, diferencias pendientes, propinas y tarjeta de timbres. Romo todavía NO replica íntegramente esas transacciones. No es seguro permitir reescritura del total antes de completar esa conciliación y su identidad/persistencia Neon.

Se implementó el siguiente SUBCONJUNTO seguro sin crear otra pantalla:
- `public/romo-panel-qa/index.html`: la ficha de un pedido pagado sin QR ni cierre ofrece «Corregir referencia (sin alterar cobros)» y reutiliza `editarPedido(id)` y `vNuevo()` aprobados de Uki. `ndGuardar()` deriva los pedidos pagados a `ukiRomoCorregirReferenciaPagadaQA()`; requiere sesión válida, revisión Neon sin conflicto, **turno abierto y base confirmada**, responsable y confirmación manual.
- `public/romo-panel-qa/uki-romo-edicion-pagada-qa.mjs`: clasificador puro y preparación de la copia. **Solo** se pueden corregir la referencia de mesa (consumo en local) o kilómetros informativos (delivery). Comprueba que sigan invariables importe total, subtotal, productos, cantidades, armado, cliente, WhatsApp, fecha, código de carta, origen, estado pagado, medios, pagos mixtos, propina, reparto, QR, pagos entre locales y ajustes. Nunca genera ventas, pagos, timbres ni cobros adicionales. Rechaza cancelados, premios, QR, diferencias pendientes o cierre.
- El antes y después quedan en `correccionesTurno` e `historialCambios`, sin modificar ingresos ni cierres. La persistencia queda supeditada a la revisión CAS de `ukiRomoGuardarOperacionQA`; el panel se actualiza únicamente después de la confirmación Neon.
- `vNuevo()` informa de forma explícita al operar sobre una venta pagada qué datos se pueden corregir y que las modificaciones financieras quedan bloqueadas.

**Pendiente real, NO resuelto:** correcciones de precio, cantidad, productos, propinas, pagos mixtos, cambios de cliente y diferencias de caja en pedidos YA PAGADOS. Antes de ofrecerlos en el mismo formulario habrá que usar la conciliación de efectivo/medios oficial de Uki, confirmación real de devolución/cobro, rectificación postcierre con autorización de dueños, historial de fidelización y CAS atómico Neon. No añadir otra caja ni una segunda bandeja. No activar las operaciones hasta la revisión manual de punta a punta.

No hubo cambios en `main` Uki ni en los registros de pagos, carta o caja. No se realizaron pruebas de venta ni una publicación.
