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


## Conciliación de ventas pagadas: comparación por medios, sin escribir caja
16-11-2026. Código único preparado en `preparacion/uki-romo-sobre-main-20261114`, sin despliegue, sin pruebas de caja, sin movimientos reales.

**Hallazgo:** el panel de Romo ya tenía confirmado el **registro real de pagos mixtos** de productos y delivery por `ukiRomoConfirmarCobroQA()`, `ukiRomoLeerDistribucionQA()` y `uki-romo-cobro-pendiente-qa.mjs`, con CAS Neon y auditoría. No debe duplicarse ni reescribirse ese cobro. Lo pendiente es la **corrección de un pedido que YA estaba pagado**: Uki utiliza `ukiPagoModificado()`, `ukiCobrosRealesMedios()`, `ukiPrepararAjusteCobro()` y la gestión de propinas y timbres, pero Romo todavía carece de conciliación completa antes de modificar la venta.

Se añadió únicamente un **cotejo de solo lectura en el formulario oficial**:
- `public/romo-panel-qa/uki-romo-diferencias-financieras-qa.mjs`: calcula el total registrado vs la propuesta sin mutar el objeto `p` ni `D`, verifica subtotal de productos y reparto, medios individuales/mixtos, propina separada, diferencia global y por medio. **Recibe** los medios oficiales `ROMO_MEDIOS_COBRO_QA` y `ROMO_MEDIOS_DELIVERY_QA` del panel; no mantiene otra lista ni permite apps para delivery.
- `public/romo-panel-qa/index.html`: en la misma pantalla `vNuevo()`, solo si `D.editando` y pedido pagado, aparece «Ver diferencias sin guardar», con desglose por método. `ukiRomoVistaDiferenciasPagoQA()` exige sesión autorizada vigente, turno abierto, base confirmada, ningún cierre y formulario sin cambios durante la lectura. Muestra los resultados solo con `textContent`, sin generar cobros.
- No habilita `ndGuardar` para correcciones de efectivo, transferencia, tarjeta, pagos mixtos, productos, reparto o propinas. El clasificador de `uki-romo-edicion-pagada-qa.mjs` sigue permitiendo **solo** referencias administrativas sin modificar dinero.
- **Exclusiones deliberadas:** cuentas QR, pagos en otra sucursal, pedidos con saldo de ajuste previo, cambios de modalidad o estado a no pagado, registros fuera de rango y cierres. Requieren una conciliación específica para no generar dobles cobros ni cierres incorrectos.
- No se escribe ninguna diferencia como si fuera un pago recibido o devolución realizada. No se actualizan caja, clientes, timbres, pedidos, cierres ni `Mi Administración` por pulsar este botón.

**Siguiente implementación real:** conectar las rectificaciones financieras pagadas con un registro independiente y auditado de `recibido / devolución ya realizada / pendiente por cobrar`, conciliación de cada medio, propinas y caja acumulada con CAS, y la posterior rectificación de cierres (solo con dueños); después validar manualmente desde la carta hasta el cierre. Hasta entonces queda bloqueada la modificación financiera.

**Estado:** solo rama preparación. Mantener Uki oficial, carta aprobada y datos de Romo sin alteraciones.


## Corrección del medio de pago ya recibido — sin duplicar cobros
16-11-2026 — **implementado solo en la rama de preparación, sin publicar ni ejecutar ningún cobro o devolución**.

Se comprobó que `totales()` y los medios de caja oficiales ya leen `medio`, `medioEnvio`, `pagosProductos` y `pagosEnvio` de cada pedido pagado. Por tanto no se crea una caja ni una tabla paralela de ingresos: si se registró por error como «Efectivo» lo que realmente se había recibido por «Débito» o transferencia, la corrección adecuada es rectificar **la clasificación del cobro original**, sin registrar otro cobro.

- `public/romo-panel-qa/uki-romo-diferencias-financieras-qa.mjs` añade `prepararRectificacionMediosRomoQA` en el módulo **ya creado** para comparar diferencias. Reutiliza `clasificarCorreccionPagadaRomoQA`, el comparador de pagos mixtos existente y las listas de medios del panel. Solo admite cambios de medio individual o mixto si **subtotal, delivery, total y propina son idénticos** y no cambian cliente, WhatsApp, fecha, productos, armado, localidad ni otros campos.
- Exige pedido pagado de Romo, turno original abierto y base confirmada, sin QR, premios, cierre, cobro en otra sucursal ni diferencias previas; identifica responsable. Guarda el antes/después en `correccionesTurno` y `historialCambios` del **mismo pedido**, no altera el número, ni genera cobro nuevo, devolución, propina nueva o timbre.
- `public/romo-panel-qa/index.html` añade en la **pantalla oficial de edición de Uki reutilizada** el botón «Corregir medio realmente recibido». Muestra los importes anteriores y propuestos por medio, exige confirmación humana de que ese fue el medio **que efectivamente cobró el negocio**, y aplica únicamente mediante `ukiRomoGuardarOperacionQA` y su revisión CAS cifrada Neon. Ante falla indica revisar Caja y el pedido antes de repetir.
- `Ver diferencias sin guardar` permanece como consulta sin movimiento. El botón principal `Guardar cambios` continúa bloqueando importes/prod/propinas que requieran conciliación; la nueva corrección está claramente limitada a **reclasificar cómo se cobró dinero que YA se recibió**.
- Se comprobó **sintaxis estática** del módulo y del nuevo controlador, un único botón/handler, validación de medio oficial, cotejo de venta intacta y uso del guardado CAS; no se ejecutaron casos comerciales porque la dueña pidió pruebas manuales.

**Aún pendiente:** devolución de importes, cobros adicionales, reducción de cantidades de pedidos pagados, cambio de propina con caja, cuadratura de efectivo físico y rectificaciones posteriores al cierre; deben exigir evidencia del movimiento ya realizado, autorización, diario de conciliación y revisión final antes de activar. No anunciar paridad completa de Caja ni publicar sin probar manualmente.


## Cierre bloqueado ante diferencias y propina manual con CAS
16-11-2026 — todo preparado **solo en la rama de integración Romo**, sin operaciones comerciales de prueba, sin cobrar, sin modificar Uki oficial ni actualizar registros de negocio.

**Cierre definitivo:**
- `public/romo-panel-qa/uki-romo-cierre-definitivo-qa.mjs` ahora verifica, además de timbres y pendientes WhatsApp, que **ningún pedido de ese turno** tenga `ajusteCobroPendiente` distinto de null. Si lo hay, impide el cierre antes de escribirlo; seleccionar «Acepto diferencia de efectivo» **no omite** esta condición. Un importe a devolver/recibir requiere confirmación y conciliación propia.
- `public/romo-panel-qa/index.html` muestra el número de pedidos por conciliar, sus folios y deshabilita el botón de cierre mientras existan. `ukiRomoCerrarTurnoQA()` repite el bloqueo antes de consultar la bandeja de pedidos. El bloqueo determinante está en la función pura del cierre.
- **No se alteran los importes**, el número de pedidos, el historial ni las reglas de la caja oficial de Uki.

**Propinas manuales:**
- Se comprobó que el formulario oficial de Uki `vRegistros()` incluye «Propinas (aparte de ventas)» con **número de pedido, concepto, importe y medio**. No se rehizo ese diseño. En `ukiRomoCajaConsultaHTMLQA('movimientos')`, se recupera la **misma tarjeta** de `vRegistros()` (índice 5, igual que en el selector oficial `vMovimientos()`).
- Para Romo, `addPropina()` dirige al controlador propio `ukiRomoAgregarPropinaManualQA()` antes de la vía local de Uki; para Uki se conserva su funcionamiento exacto. Romo no permite `quitarPropina` directo sin auditoría.
- `public/romo-panel-qa/uki-romo-propina-manual-qa.mjs` prepara una **copia** del estado Romo. Exige cuenta dueños con sesión Neon, identificación inequívoca del pedido (Carta o Interno), pago confirmado, turno original abierto/base declarada, no QR, no cierre, no premio/cancelación y **ninguna propina ya registrada** para ese pedido. Solo admite los medios oficiales permitidos, importe real de 1 a 10.000.000, concepto, responsable y confirmación expresa de que YA se recibió el dinero.
- El guardado solo se hace por `ukiRomoGuardarOperacionQA` (CAS cifrado); incorpora una fila `origen:'manual'` en `S.propinas` después de la confirmación, **no modifica ventas, productos, delivery, fidelidad ni timbres**. El importe queda aparte de las ventas para el reporte del turno. No se ejecutó ningún registro de propina.
- Se comprobó la **sintaxis** de los módulos de cierre/propinas y del script clásico del panel, más los bloqueos de duplicados y las rutas de CAS. No se han realizado pruebas comerciales, que permanecen manuales.

**Aún falta para paridad completa:** conciliación de cobros adicionales, devolución real y ajuste de propinas de pedidos pagados con diferencia, incluida autorización dueños postcierre e integración de cierre definitivo con Mi Administración. Mantenerlos **bloqueados** hasta completarlos.


## Conciliación auditada de diferencias pendientes por medio — continuidad 16-11-2026

**Realizado únicamente en rama de preparación Romo; sin publicar, sin pagos de prueba ni cambios de registros comerciales.**

- Se reutiliza el mecanismo de Uki ajusteCobroPendiente dentro de la ficha existente de Pedidos Romo. No se crea otra pantalla, caja, pedido, cobro ni timbre.
- El módulo public/romo-panel-qa/uki-romo-conciliacion-real-qa.mjs revisa que el pedido sea pagado y propio de Romo, con turno y base abiertos y sin cierre, QR, premio, cancelación o cobros en otro local. Comprueba productos, delivery, propina separada, medios individuales/mixtos, saldo pendiente y dinero anterior real por medio.
- Para cada medio identifica el importe concreto ya devuelto o ya recibido. Exige confirmación humana separada de cada movimiento, responsable y fecha.
- La ficha en public/romo-panel-qa/index.html muestra la diferencia y utiliza la sesión existente de Romo, revisión CAS cifrada de Neon y validación de la copia aislada. Solo tras confirmación del servidor se elimina la diferencia pendiente. Guarda importes, medios, responsable, antes/después e historial sin recortar registros anteriores.
- El cierre definitivo sigue bloqueando pedidos con ajusteCobroPendiente. La lectura de Caja vuelve a calcular la distribución del mismo pedido tras el guardado, sin registrar otra venta.

**Límite esencial:** se puede conciliar solamente un ajusteCobroPendiente legítimo YA existente. La edición financiera de pedidos pagados aún NO crea automáticamente ese ajuste en Romo y sigue bloqueada; tampoco está homologada la modificación de propinas, el efecto en caja acumulada, las rectificaciones postcierre y Mi Administración. Antes de habilitarlo falta conectar esa creación desde el formulario de Uki, mantener timbres e historial, revisar el efecto contable y hacer pruebas MANUALES con pedido real controlado.

**No despliegue:** no alterar Uki main, producción, datos reales ni banderas comerciales. Conservar la única publicación conjunta de carta y panel tras aprobación manual.


### Creación del ajuste pendiente desde corrección de precio (subconjunto seguro)

- En el mismo archivo existente de comparación public/romo-panel-qa/uki-romo-diferencias-financieras-qa.mjs se incorporó prepararDiferenciaPrecioPagadoRomoQA, usando el clasificador y comparador oficial reutilizados. Solo permite corregir **precios unitarios de artículos existentes**, sin agregar/quitar productos, cambiar cantidades, armado, cliente, WhatsApp, medio, delivery, QR, timbres, importe de propina ni pagos en otra sucursal.
- El cambio exige que el pedido siga pagado, con turno y base real abiertos, sin cierre ni ajuste previo, identificando quién corrigió. Los pagos mixtos deben recalcularse exactamente por los mismos medios originales; no se registran cobros adicionales antes de que el dinero exista.
- El mismo formulario de edición muestra «Guardar corrección de precio pendiente». Tras confirmación manual y CAS Neon Romo, conserva el mismo folio e historial, actualiza la venta corregida y establece ajusteCobroPendiente con la clasificación de dinero cobrado originalmente. El cierre permanece bloqueado mientras la diferencia no se regularice.
- La ficha de pedido ofrece después la conciliación de dinero ya movido por medio; al confirmarse en Neon se elimina solo el ajuste pendiente y queda rastro de antes/después, responsable e importes. No crea timbres, pedidos ni una segunda venta.
- Se comprobó exclusivamente sintaxis de los módulos y del script clásico HTML, referencias y conexiones del mismo formulario, **sin ejecutar pruebas de operaciones comerciales, cambios Neon ni despliegue**.

**Aún NO abarcado:** cambio de cantidad, agregado/retiro de productos pagados, cambio de modalidad, descuento por pieza, devolución de propina registrada, retribución de fidelidad, correcciones posteriores a un cierre, caja acumulada y cierre definitivo sincronizado a Mi Administración. Estos requieren revisión aparte del código oficial y prueba manual real con la propietaria. No dar por finalizada la paridad de Caja hasta entonces.


## Continuidad: corrección segura de propinas existentes y bloqueo de cierres
16-11-2026. **Solo GitHub, rama preparacion/uki-romo-sobre-main-20261114. No publicado, no usado con dinero real ni probado comercialmente.**

**Alcance estrictamente existente en Uki**
- Se inspeccionó el formulario de propinas opcionales de pedidos, la tarjeta «Propinas (aparte de ventas)» y la corrección oficial de pedidos pagados. Se mantuvieron ambos formularios; no se creó otra caja ni una pantalla comercial.
- En public/romo-panel-qa/uki-romo-propina-manual-qa.mjs se agregaron preparadores puros sobre una COPIA: rectificar la única propina de origen «pedido» desde el formulario del pedido pagado, y rectificar una única propina de origen «manual» desde la misma tarjeta de Caja. Se prohíben duplicados, pedidos de prueba, cancelados, QR, cobros en otra sucursal, ajustes financieros abiertos, turnos cerrados o sin base confirmada.
- Las rectificaciones guardan el ID y la fecha original de la propina; exigen motivo, responsable, importe, medio autorizado y confirmación humana de que ya se recibió o devolvió el efectivo/dinero, o se verificó la clasificación original. Un cambio de medio y monto en la misma operación queda bloqueado.
- Las correcciones registran la diferencia y las fotos antes/después tanto en el historial del pedido como en el registro de la propina, sin tocar las ventas de productos, delivery, timbres o fidelización. Para origen «pedido» actualiza también propina y total del MISMO pedido; para origen «manual» NO toca los importes del pedido.
- public/romo-panel-qa/index.html conecta los dos controladores únicamente al mismo guardado CAS cifrado Neon Romo, con revalidación de sesión, pedido y propina. El botón de corrección manual usa la misma tarjeta de 4 campos; el de propina del pedido aparece solo si el pedido ya tiene propina. Ninguna acción mueve dinero desde el sistema.
- public/romo-panel-qa/uki-romo-cierre-definitivo-qa.mjs impide cerrar si una propina del turno está duplicada, no corresponde a un pedido pagado vigente, pertenece a otra caja o difiere del importe/medio del pedido. Se mantiene el cierre bloqueado si hay ajustesCobroPendiente.

**Faltantes que NO se declaran terminados**
- Comprobar manualmente con la dueña el manejo físico del efectivo de propinas y cómo cuadra el arqueo; el cierre actual registra propinas como concepto separado de venta y no se ha redefinido la fórmula original de efectivo esperado.
- Rectificación financiera POSTERIOR al cierre: la aclaración administrativa «cierre_aclarado» ya existe y sigue intacta, pero no constituye un nuevo cierre monetario corregido. No actualizar cifras de cierres anteriores sin versionado, auditoría y conciliación.
- El libro de Caja acumulada tiene esquema y lectura aislados, sin inicialización ni autorización de escrituras. Mi Administración dispone de preconciliación y registro de cierre único por source_key, pero la importación no se activa desde esta integración. No sumar propinas como venta ni duplicar un cierre.
- La publicación de carta y panel continúa unificada, con revisión manual de punta a punta. NO cambiar Uki main ni activar nuevos endpoints/banderas.

**Comprobación de esta etapa:** lectura de fuentes y sintaxis estática del script del panel y módulos de propina/cierre; no se ejecutaron pruebas de pagos/cobros, no se escribieron registros de Neon y no se desplegó una versión comercial.


## Revisión del historial postcierre y pendientes reales antes de publicación
16-11-2026 — rama de preparación exclusiva Romo, sin despliegue comercial ni escrituras en Neon.

**Avance concreto:** en public/romo-panel-qa/index.html, el Historial existente de cierres Romo distingue ahora las **aclaraciones** del cierre (ya disponibles, solo notas) de los **ajustes monetarios posteriores** (pedidos olvidados o corregidos). La consulta muestra únicamente registros que ya existieran, asociados al mismo turno/fecha; no crea una nueva operación, no recalcula cifras del cierre original, no actualiza el PDF previamente guardado, no toca Caja acumulada ni importa otra venta. Queda señalado cuando exista referencia a rectificación sin conciliación; se revisaron las anclas del formulario y la sintaxis del script en el mismo panel.

**La implementación sigue incompleta en cinco bloques:**
1. Rectificaciones con dinero postcierre y versiones de comprobante realmente conciliadas — solo aclaración y advertencia histórica preparadas.
2. Caja acumulada — esquema y lectura protegidos, sin inicialización ni transferencias reales ni aprobación del saldo de origen; analizar propinas, base y reparto.
3. Mi Administración — lectura y preconciliación preparadas; conectar importación idempotente de cierre con validación de origen/versión, sin sumar dos veces ventas, y definir cómo reportar las rectificaciones.
4. Carta correcta/panel — fuente de catálogo definitiva, publicación en Root Directory correcto, recepción y paridad pendiente (incluidos inventario, timbres, clientes, QR y sucursales).
5. Verificación comercial manual de la ruta completa con la propietaria, después publicación conjunta de carta y panel Romo sin modificar Uki oficial.

No inventar porcentaje global ni fecha de entrega: hay módulos codificados pero no validados punta a punta. Requiere revisión integral antes de declararlos terminados o activar banderas públicas.


## Bloque 1 · Rectificación monetaria posterior al cierre (preparación segura)
16-11-2026. Rama exclusiva Romo, NO publicada, sin ajustes reales de dinero ni pruebas comerciales. **NO está terminado el bloque hasta emitir una constancia versionada y conciliada.**

**Base exacta de Uki:** firebase/uki-sushi-local.html distingue cierre_aclarado (anotación sin tocar dinero), pedido_corregido posterior al cierre (historial; cierre original intacto) y pedido_olvidado (informe rectificado con original archivado). Las notas no son dinero recibido o devuelto.

**Preparado en esta continuidad:**
- public/romo-panel-qa/uki-romo-aclaraciones-cierre-qa.mjs prepara sobre una COPIA una solicitud de rectificacion_monetaria_pendiente vinculada al cierre original. Exige cierre único real, pedido pagado incluido en su fotografía, importe y medio coherentes, motivo, responsable y fecha posterior al cierre; rechaza QR, otros locales, prueba, diferencia abierta, rectificación previa sin conciliar y devolución superior a productos cobrados por ese medio.
- Conserva la referencia original romo:serena|turno y el antes/después PROVISIONAL del total y medios como versión propuesta 2. Graba expresamente dineroRegistrado:false, esSoloPropuesta:true, requiereConstanciaVersionada:true.
- public/romo-panel-qa/index.html usa el Historial existente de Caja, con sesión de dueños, guardado CAS en Neon Romo, confirmación que NO mueve dinero, y lectura comparativa de importe original y propuesto. No crea otra pantalla ni otra venta.
- El cierre original, su recibo y PDF anterior, los pedidos, propinas, timbres, repartidores y Caja acumulada quedan inalterados. Mi Administración sigue sin importar estos ajustes. La fuente actual de cierre no permite sustituir una constancia original por otra.

**Pendiente para completar este bloque:**
1. Conciliación del movimiento real en el turno en que ocurrió el pago/devolución y aprobación de dueños, sin reabrir la caja antigua.
2. Constancia inmutable y versionada de la diferencia, vinculada al original en Neon con clave idempotente y operación atómica CAS; la vista previa NO es una constancia.
3. Generación y exportación de cierre rectificado una vez por versión, conservando original; Mi Administración debe importar solo el ajuste confirmado, no sumar nuevamente la venta original.
4. Revisión exclusivamente MANUAL desde iPhone de pagos mixtos, duplicados, efectivo acumulado, autorizaciones y fecha operativa; no ejecutar migración SQL ni activar escritura pública antes de aprobar.

**Estado real:** propuesta auditable guardada en GitHub; sin publicación, sin recibo financiero confirmado ni dinero movido.

## Bloque 1 · Avance nuevo programación de recibo v2, cierre y arqueo (16-11-2026)

**Rama:** preparacion/uki-romo-sobre-main-20261114. Estado NO PUBLICADO, NO validado comercialmente. Fuente ampliada: docs/ROMO_BLOQUE_1_RECTIFICACIONES_V2_20261116.md.

- Se desarrolló la confirmación de una rectificación v2 de una venta ya pagada desde el Historial Romo, con responsable, motivo y referencia de dinero que realmente se recibió/devolvió. La propuesta no contabiliza dinero hasta confirmarse.
- La confirmación utiliza un endpoint privado, Google dueño, guardado atómico de sobre cifrado CAS y constancia v2 en nueva tabla separada. Referencia el original, mantiene SHA/versión y rechaza duplicación. Las banderas de lectura y escritura de rectificaciones siguen APAGADAS.
- La migración SQL migrations/2026-11-16-romo-rectificacion-postcierre-v2-qa.sql SOLO está en GitHub: verificación SELECT en Neon real confirmó que la tabla romo_rectificaciones_cierre_v2 NO existe. No ejecutar hasta revisión y autorización.
- El Historial consulta recibo v2 real para imprimir PDF; no usa montos provisionales. El informe v2 conserva la venta original y muestra el ajuste separado.
- El movimiento pertenece al turno ACTUAL con base y apertura confirmadas, no al turno original. Caja, cierre, CSV, PDF y WhatsApp muestran neto v2 separado del ingreso por sushi; el efectivo esperado incorpora la diferencia de efectivo realmente confirmada.
- Seguridad: el cierre del turno actual consulta las constancias v2 de Neon y rechaza importes inexistentes, duplicados o que no cuadren con lo declarado. La compatibilidad con cierres originales sin ajustes v2 se conserva.
- Revisadas sintaxis JS del panel, módulos y API. Sin pruebas comerciales ni cobros ficticios. Vercel producción de Uki sigue en main 3274dbc1b66b676663b74d74ae40f84d251b3ee9.

**NO declarar bloque 1 terminado todavía:** falta habilitar/validar migración bajo control, comprobar manualmente con dinero real y usuario dueño, resolver nuevas versiones v3+, pedidos olvidados del cierre y conciliaciones de delivery/otros locales. Mi Administración importará deltas por separado en bloque 3, no se habilitó. Mantener la sola publicación conjunta de Romo y no tocar Uki.
## Bloque 1 · Pedido olvidado de turno cerrado replicado desde Uki (preparación)

16-11-2026. En la rama exclusiva de preparación de Romo, SIN publicar, SIN pruebas comerciales, SIN migraciones ni nuevos movimientos de dinero.

- Se reabrió el código exacto del formulario y del informe de pedidos olvidados de Uki oficial (firebase/uki-sushi-local.html, funciones ukiAjustePedidoOlvidado, ukiVAgregarPedidoOlvidado, ukiOlvidosCierre y ukiCierreInformeVigente).
- En public/romo-panel-qa/uki-romo-pedido-olvidado-qa.mjs se replicó el desglose aprobado: turno y fecha/hora original, código carta opcional, cliente, detalle, retiro/delivery/consumo, subtotal, envío, dinero recibido en Romo, delivery cobrado en Romo, medio, dinero recibido en otro local, repartidor realizó reparto, confirmación de pago completo, responsable y motivo.
- Se calculan y validan separadamente productos y delivery cobrados en cada local. El reparto realizado queda marcado para conciliar, NUNCA como pagado al repartidor. Se rechazan montos inconsistentes, fechas fuera del turno, código carta repetido, reintento exacto, y solicitudes simultáneas con una rectificación financiera del mismo cierre.
- En public/romo-panel-qa/index.html se conectó el formulario completo directamente dentro del Historial de cierres existente y el guardado CAS cifrado de Neon Romo. No se crea otro pedido en S.pedidos, no se reabre Caja, ni se altera venta, cierre definitivo original, PDF, efectivo contado, propinas o Mi Administración.
- Diferencia transitoria necesaria: el ajuste permanece con tipo pedido_olvidado_romo_pendiente y estado pendiente_conciliacion, no usa aun el tipo financiero confirmado pedido_olvidado de Uki. Esto evita que la función heredada ukiCierreInformeVigente sume una venta antes de existir constancia y reconciliación Romo. El Historial muestra vista previa separando original, total omitido, cobro local, cobro externo y reparto pendiente; la vista NO constituye versión v2/v3 ni sustituye comprobantes.
- También se agregó un bloqueo recíproco en public/romo-panel-qa/uki-romo-aclaraciones-cierre-qa.mjs: una rectificación monetaria no puede abrirse sobre un cierre con pedido olvidado sin conciliar.

**FALTA para dar este caso por terminado:** confirmar con constancia versionada e idempotente en Neon el pedido omitido (incluido cobro de otro local), preparar el informe rectificado definitivo, vincularlo al turno real del movimiento sin duplicar ventas ni repartos y verificarlo MANUALMENTE con la dueña. La versión v2 anterior solo soporta diferencia sobre venta ya registrada y NO debe reutilizarse para pedido omitido.

El resto de los bloques y la publicación conjunta siguen como antes. No declaramos terminado el bloque 1 ni modificamos la versión main de Uki.

## Continuidad 16-11-2026: conciliación histórica versionada de pedidos olvidados

**Código guardado únicamente en la rama de preparación; no se publica ni se aplica una migración SQL ni se registra dinero real.** Esta sección actualiza las descripciones anteriores de "pendiente sin confirmación" para el nuevo avance, sin declararlo aprobado.

- Se creó `public/romo-panel-qa/uki-romo-confirmar-olvido-qa.mjs`, que prepara versiones consecutivas v2–v32 de **pedidos olvidados cuyo dinero YA se había cobrado históricamente**. Verifica pago por Romo y por otro local, subdivisión productos/delivery, medio local, fecha/hora del cierre original, autorización de dueños, folio de comprobante de cada local y cantidades. La operación no reabre la Caja antigua ni suma a la Caja actual; el reparto realizado queda separado, **no pagado**.
- `lib/romo-olvidos-constancias-qa.mjs` y `api/romo-pedidos-olvidados-qa.js` se añadieron para confirmar y leer constancias versionadas, con identidad Google de dueños, cifra AES-GCM CAS, validaciones y enlace al recibo precedente. Banderas `ROMO_OLVIDOS_LECTURA_QA_ENABLED` y `ROMO_OLVIDOS_ESCRITURA_QA_ENABLED` no están activadas.
- `migrations/2026-11-16-romo-pedidos-olvidados-versiones-qa.sql` define tabla y función transaccional con versión única por cierre, hash del original y anterior, revisión CAS y deduplicación. **Solo archivo preparado, no ejecutado** en Neon. También se impide una segunda secuencia incompatible de corrección monetaria v2.
- El Historial Romo muestra propuestas pendientes y versiones confirmadas, permite consulta del recibo auténtico en Neon para imprimir/Guardar PDF y ofrece la siguiente versión solo después de verificar la anterior. Los informes CSV, PDF y WhatsApp incluyen por separado la venta histórica rectificada y el cobro de otro local; la venta del cierre FÍSICO original permanece intacta.
- Hallazgo de seguridad solucionado: el formulario legado `ukiAjustePedidoOlvidado()` de Uki podía eludir el CAS de Romo y dejar una confirmación aparente en memoria. En Romo se bloqueó esa ruta y se retiró su formulario del historial compacto; la única entrada es **Caja > Historial de Romo**, mediante Neon cifrado.
- La comparación de código y la comprobación de sintaxis JS/HTML no equivalen a aceptación comercial. Falta aplicar migraciones **solo tras revisión autorizada**, examinar en entorno aislado la conciliación de otros locales/repartidores, y comprobar manualmente en iPhone la confirmación idempotente v2/v3, los recibos y la exportación. Mi Administración aún no importa deltas históricos; continúa como bloque 3.

## Continuación: reportes históricos de pedidos olvidados revisados en la rama Romo
16-11-2026. Rama exclusiva Romo, sin publicar ni mover dinero.
- Se revisó public/romo-panel-qa/uki-romo-exportar-cierres-qa.mjs sobre la versión vigente: ya mostraba cierre histórico original y ventas rectificadas confirmadas, sin sustituir el cierre físico.
- Se fortaleció la validación de CADA versión: identifica referencia original|vN, secuencia de versiones, dinero local y externo, y exige que los importes de productos y delivery coincidan por local. Una inconsistencia bloquea exportar.
- Se añadió a WhatsApp el desglose de productos y delivery cobrados en Romo y en otros locales, además de la venta histórica rectificada informativa, reparto por conciliar y versión vigente.
- El CSV (para Excel) ahora incorpora columnas independientes para productos/delivery de Romo y de otros locales, conservando las columnas originales del turno sin reemplazarlas.
- El PDF imprimible del Historial agrega una tabla separada de pedidos olvidados confirmados, por turno y versión; el cierre físico y los importes originales siguen intactos.
- ACLARACIÓN: los reportes consolidados leen la instantánea cifrada de Historial con marca de versión confirmada, no hacen una nueva verificación de recibos Neon durante cada exportación. Las constancias individuales sí se consultan desde Historial y deben verificarse antes de tratar la conciliación como comprobada.
- Se comprobó sintaxis estática de las funciones de exportación; NO se realizaron pruebas comerciales, no se ejecutaron migraciones SQL ni se activaron APIs. La conciliación con Mi Administración sigue pendiente del bloque 3.

**Pendientes antes de considerar bloque 1 cerrado:** revisar migraciones y permisos de constancia de olvidos v2-v32 de manera aislada, validar manualmente un pedido pagado realmente omitido en el entorno autorizado, verificar referencias externas y delivery, y comprobar la lectura del recibo desde Neon. Prohibido publicar solo este submódulo.
## Barrido final de bloque 1 · constancias, deduplicación y reportes históricos
16-11-2026. Solo rama de preparación Romo; no publicado, sin operaciones comerciales. Continuidad después de la revisión de CSV/PDF/WhatsApp.

- Se detectó y corrigió una incompatibilidad preventiva: un cierre ordinario Romo sin rectificaciones no debe requerir que exista ya la nueva tabla opcional romo_rectificaciones_cierre_v2. El cierre ahora sigue permitiendo el caso sin ajustes y exige tabla/constancia cuando realmente se declara ajuste v2. Código: lib/romo-cierre-constancia-qa.mjs.
- Se reforzó la deduplicación de pedidos olvidados en backend: clave_olvido ahora es huella SHA-256 del mismo detalle histórico normalizado que usa el panel para rechazar pedidos repetidos. Esto protege contra registrar el mismo cobro con otra solicitudId, sin publicar nombres de clientes ni productos en la tabla financiera. El hash se calcula en el navegador seguro ANTES de enviar el resumen; el servidor y SQL exigen 64 caracteres hexadecimales.
- La API de constancias de pedidos olvidados devuelve el identificador por versión y lo coteja contra el comprobante de la cadena. Se conservan referencias original, v2, v3, etc., medios y saldos por local.
- Antes de compartir el cierre por WhatsApp o exportar CSV/PDF, si incluye pedidos olvidados confirmados, el panel vuelve a CONSULTAR sus constancias encadenadas en Neon. Comprueba correspondencia de cada versión, folio, monto local/externo y venta histórica; si está apagada la consulta, falta un recibo o cambia revisión, no exporta ni comparte. Cierres sin olvidos históricos no exigen ese endpoint opcional.
- Reportes histórico rectificados: conservan venta original y resultado original, agregan explícitamente cantidad de pedidos y resultado de la versión rectificada como importes SOLO INFORMATIVOS, sumados solo al histórico original. Los cobros de otros locales no se tratan como nueva venta Romo y el reparto queda por conciliar. Todo continúa fuera de Mi Administración.

Sin cambios en main Uki ni despliegue Vercel. Las migraciones SQL siguen sin ejecutarse. Quedan pendientes habilitación autorizada de entorno, verificación SQL en rama aislada, conciliaciones mixtas más amplias y pruebas manuales por dueña. No declarar bloque 1 aprobado ni cierre real emitido.