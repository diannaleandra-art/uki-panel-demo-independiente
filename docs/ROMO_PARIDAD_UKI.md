# Romo Sushi — paridad funcional obligatoria con Uki (QA)

**Fecha de revisión:** 2026-11-18. **Estado:** NO APROBADO COMO COPIA EXACTA.

## Contrato de alcance
Romo Sushi debe utilizar las mismas funciones, pasos, pestañas y comprobaciones que el panel aprobado de Uki, con únicamente marca, colores, carta comercial y almacenamiento/usuarios por sucursal independientes. No alterar Uki, sus pedidos, caja, cierres o tarjetas. No anunciar ni operar Romo con público antes de verificar la paridad.

## Fuente de verdad
- La referencia funcional es el panel de Uki ya aprobado, no una reconstrucción desde conversaciones.
- El archivo actual de Romo `public/romo-panel-qa/index.html` contiene buena parte de la interfaz de Uki, pero tiene desvíos condicionales de Romo.
- Proyecto QA Romo: `romos-sushi-panel`, rama `qa/romos-panel-v816`.
- Base aislada Romo: `romos_sushi`, sucursal `romo:serena`; no trasladar datos de Uki.

## Estado del cotejo (evidencia en código)
| Área | Estado | Evidencia y acción exigida |
|---|---|---|
| Formulario Nuevo: subtotal y propina | Presente | `vNuevo` y `ukiPropinaUI`; comprobar equivalencia visual |
| Pago completo, mixtos y otro local | Ocultación CSS CORREGIDA en QA | Antes: `body.romo-operativo-preparacion #ukiPagoPedidoSoloUki{display:none!important}`. Ahora visible; test `tests/romo-paridad-visual-uki.test.mjs`. Falta ensayo integrado en iPhone de una operación auténtica |
| Guardado atómico pago pendiente/confirmado | Pruebas de código aprobadas, no producción | `ukiRomoGuardarPedidoPendienteQA` y `ukiRomoAceptarSolicitudCartaQA` mantienen CAS Neon independiente; evitar duplicados y cobros ficticios |
| Pedidos y estados | Pendiente de paridad íntegra | `vPedidos` en Romo retorna `ukiRomoPedidosPendientesHTMLQA()` en vez del flujo de Uki. Comparar cada control, cancelación, edición y timbres |
| Caja (resumen, movimientos, precierre, cierre, historial, reportes, acumulada) | Pendiente de paridad íntegra | `vCaja` deriva a `ukiRomoCajaPestanasQA()`, no directamente al flujo de Uki. Auditar operaciones y equivalencias de cada pestaña, sin unir bases de datos |
| Modos de ingreso de pedido | Restricción identificada | `cambiarModoNuevo` limita Romo a `manual` y `whatsapp`; revisar todos los modos aprobados de Uki antes de habilitarlos con persistencia segura |
| Inventario y Promociones | Pendiente de auditoría funcional | Accesos visibles, pero necesitan CRUD completo, permisos, carta sincronizada y exports equivalentes |
| Timbres, tarjetas, búsqueda y WhatsApp | Parcial/pendiente | Código especializado `ukiRomoTimbresPanelQA`; confirmar la misma lógica de Uki y prohibir duplicados |
| Mi Administración / dueños | CONSULTA PARCIAL / NO CONTABILIZADA | La pantalla QA `public/mi-administracion-duenos.html` ya contiene una consulta privada de cierres Romo (solo lectura) con Google + PIN, pero estos importes aún NO se incorporan a ventas generales; el panel Romo sigue sin enlace operativo a esa función. No mezclar la base financiera de Uki ni duplicar ventas |
| Turnos del 14 y del 18 de noviembre | Conciliación pendiente | No modificar histórico cifrado automáticamente ni generar cobros en jornada antigua |
| Publicación comercial | NO AUTORIZADA | QA no equivale a cierre funcional; no tocar enlaces públicos de Uki |

## Regla de aprobación
No declarar `copia exacta`, `todas las funciones completas` ni `lista para clientes` hasta cotejar todas las rutas y formularios del panel vigente de Uki con pruebas automáticas por módulo y una sola prueba integrada controlada por el dueño. Las correcciones de Romo se publican juntas, no mediante ciclos de capturas manuales por cada botón.

## Última corrección comprobada
- Se eliminó la regla de CSS que ocultaba el formulario original `Pago completo confirmado`.
- El HTML servido por Vercel QA ya contiene el formulario visible, pagos mixtos y confirmación en el mismo paso.
- No se hicieron cambios en producción Uki ni se modificaron los registros de pedidos/ventas de Romo.

## Auditoría automática de fuente oficial — 18 nov 2026
- Producción Uki VERIFICADA: proyecto Vercel `uki-sushi-inventario`, despliegue en producción del commit `3274dbc1b66b676663b74d74ae40f84d251b3ee9`. Código canónico: `firebase/uki-sushi-local.html`.
- 320 funciones Uki recuperadas; 279 secciones de funciones sin cambios textuales y 41 intervenidas en QA Romo; 112 funciones adicionales Romo.
- Los 13 módulos JavaScript oficiales de Uki están referenciados y sus archivos están presentes en la copia Romo.
- Se retiró una pantalla de pagos alternativa que duplicaba la oficial y se restauró el selector de modalidad de Uki.
- La navegación de Caja Romo ahora emplea encabezado y subpestañas de la interfaz original, pero mantiene los cálculos y datos en Neon Romo.
- Los tests `tests/romo-paridad-origen-oficial-qa.test.mjs`, `tests/romo-pago-directo-qa.test.mjs`, `tests/romo-paridad-visual-uki.test.mjs` y `tests/romo-paridad-cobros-qa.test.mjs` forman parte de `npm run test:release` en rama QA.
- Corrección CI: módulo de cobros espejo `firebase/uki-romo-cobro-pendiente-qa.mjs` sincronizado con `public/romo-panel-qa/uki-romo-cobro-pendiente-qa.mjs` para evitar dos versiones contradictorias.
- **No se ha aprobado paridad funcional completa**: siguen pendientes pruebas de las 41 funciones modificadas, equivalencia real de Pedidos/Caja/Inventario/Promos/Mi Administración y cierre de turno histórico.

Funciones del núcleo Uki cuyo comportamiento se alteró en Romo (requieren revisión de equivalencia o justificación de aislamiento):

`cajaDelDia`, `cambiarCajaTab`, `ir`, `estadoVacioSucursal`, `guardarEnLocalStorage`, `cargarDesdeLocalStorage`, `render`, `pedirPin`, `entrarSuc`, `salirSuc`, `ukiFraseDiaria`, `vInicio`, `vInicioTrabajador`, `ukiExportarPrecierres`, `ukiWhatsAppFicha`, `leerTextoD`, `ukiTimbreTextoPedido`, `ukiAbrirTimbreBorrador`, `vNuevo`, `fichaHistorial`, `vClientes`, `ukiPagoDeliveryDesglose`, `addPropina`, `quitarPropina`, `ukiDetallePago`, `totales`, `vCaja`, `vReportes`, `vRegistros`, `vPedidos`, `ukiQRPermitirCobroDefinitivo`, `ndGuardar`, `ukiAjustePedidoOlvidado`, `ukiVHistorialCorreccionesCierre`, `ukiRegistrarCorreccionCierre`, `vHistorialCompacto`, `vHistorial`, `actualizarPresentacionNube`, `actualizarBloqueo`, `contexto`, `accion`.

## Avance siguiente: inventario y caja sin afectar Uki (18 nov 2026)
- Reparado el JavaScript roto de `public/romo-panel-qa/romo-inventario-exportar.js`: contenía seis apóstrofos que impedían su ejecución en el inventario del trabajador. El trabajador puede generar PDF/Excel/WhatsApp con el nombre de Romo.
- El exportador compartido en Romo QA ahora selecciona el logo textual, encabezado y nombre de archivo de Romo o Uki según `report.branch` sin afectar los originales de producción.
- Historial Romo: `public/romo-panel-qa/uki-inventario-historial-admin.js` ya no redirige el historial al backend Uki. Lee con token autorizado `/api/romo-inventario-qa` y transforma las revisiones del propio registro Neon mediante `romo-inventario-historial-qa.mjs`.
- Las cantidades de revisiones anteriores se reconstruyen SOLO cuando los movimientos posteriores conservan el valor `antes`; si faltan datos, el detalle se bloquea con error explícito. Revisiones antiguas sin nombre guardado se presentan como `Nombre no registrado en esa revisión`.
- Las nuevas revisiones cerradas por personal de Romo conservan el nombre proporcionado y validado del trabajador dentro del historial (sin consultar a Uki).
- En Caja Romo el título `Turno abierto` ahora se muestra únicamente si lo confirma el estado; una fecha operativa antigua produce un aviso de conciliación, sin cambiar la caja ni cerrar automáticamente.
- Los casos se verifican en `tests/romo-inventario-paridad-historial-qa.test.mjs`, incluidos aislamiento Romo, PDF/CSV, reconstrucción, operaciones incompletas y sintaxis del exportador.
- Verificada la puerta QA GitHub: pruebas generales Romo y pruebas base Uki aprobadas; sin publicación comercial y sin escrituras sobre el negocio.

## Continuidad de Pedidos — códigos y reserva manual (18-11-2026)

**Rama exclusiva de preparación** `qa/romos-panel-v816`. Sin despliegue, sin pedido/venta/cierre real y sin cambios a `main` de Uki.

- Se corrigió el guardado manual para que al buscar duplicados considere únicamente `Romo’s Sushi La Serena`, comparando códigos de carta normalizados sin mayúsculas ni espacios. La consulta de Uki continúa aislada.
- En los dos módulos de aceptación (`public/romo-panel-qa/` y `firebase/`) el código `codigo_pedido` de la solicitud Neon debe coincidir con `draft.codigoCarta`, y la solicitud debe pertenecer a `serena`. Si el código ya existe en un pedido Romo, incluso cancelado, se rechaza antes de reservar; no se copia ni modifica la caja.
- En ambos constructores del candidato de pedido se rechaza una referencia de carta repetida incluso cuando tenga otro ID de solicitud. Esto complementa el control ya existente por identificador UUID y folio de turno.
- La recuperación autorizada de reserva vencida de 50 minutos estaba bloqueada por `pedido_interno IS NULL`; Neon define `pedido_interno TEXT NOT NULL DEFAULT ''`. Se ajustó el filtro SQL a `pedido_interno=''` conservando las condiciones: reserva vencida, estado pendiente, sin pedido asociado, autorización de dueños, motivo y registro en bitácora. **No se recuperó ninguna reserva real y no se modificó el temporizador**.
- Se agregaron `tests/romo-aceptacion-codigo-unico-qa.test.mjs` y `tests/romo-reserva-vencida-recuperacion-qa.test.mjs` a `npm run test:release`. GitHub Actions **44444816331** completó con éxito. Son pruebas de código/mocks, **no una prueba real con Google, Safari ni una reserva vencida en Neon**.
- Las rutas QA y la escritura comercial continúan con sus permisos y banderas anteriores; ninguna nueva Preview ni publicación Production fue creada en este bloque.

**Siguientes diferencias funcionales aún abiertas:** recepción/edición/cancelación segura desde la misma interfaz Uki y desde el enlace normal de la carta Romo, cobro/entrega/timbre en caja real, siete pestañas de Caja y sus movimientos, cierre y Mi Administración. El QR de mesas no es requisito en Romo. No declarar paridad operativa ni activar clientes hasta prueba manual controlada y conciliación de Neon Romo.

## Decisión operativa — Romo sin mesas ni QR (18-11-2026)

- La dueña confirma que **Romo no tiene mesas** y que los clientes realizarán sus pedidos con el **enlace normal de la carta**. No crear QR de mesas, cuentas QR ni un flujo paralelo para Romo.
- Esta excepción a la réplica de Uki **elimina el QR de mesas de los requisitos de publicación, de las pruebas comerciales y del listado de pendientes de Romo**. Los QR existentes en Uki se conservan intactos.
- En la pantalla **Pedidos de Romo** se deja de mostrar la tarjeta especial «Pedidos de mesas» y su filtro separado. No se borran pedidos históricos ni se altera la base, los pagos, la carta, el flujo normal de retiro/delivery o el registro existente de consumo en local. No se crearon solicitudes de prueba ni se habilitaron ventas.
- Las demás funciones de Uki acordadas para Romo siguen pendientes de homologación donde corresponda: pedidos, cobros, timbres, caja, inventario, cierres y Mi Administración.

## Conciliación de cierres Romo en Mi Administración — sin duplicar ventas (20-11-2026)

- Comprobación de solo lectura en Neon **QA Romo**: revisión operativa 8, cero solicitudes pendientes, cero constancias de cierre y cero turnos en tablas de constancia. El snapshot operativo está cifrado; la revisión 8 acredita un guardado, **no prueba por sí sola que exista un turno abierto ni un cierre contable**. La solicitud RS-8F7F1DA50BC6 sigue aceptada, sin exponer datos del cliente.
- `lib/romo-finanzas-sync-qa.mjs` ahora realiza una **consulta de ventas manuales Romo del mismo día** antes de cualquier intento de importar cierres. Si detecta una venta manual bajo negocio Romo en la fecha de un cierre, **bloquea preventivamente** el lote para su conciliación: no duplica ingresos, no anula la venta ni inventa equivalencias. Si la consulta financiera falla o resulta incompleta también se detiene.
- Pruebas automáticas agregadas a `test:release`: `tests/romo-finanzas-cierres-sin-duplicar-qa.test.mjs` para no escritura, deduplicación por `source_key`, diferencia de importes, fallo de consulta y ventas manuales coincidentes. GitHub Actions run 44671048793 **success**.
- La ruta de consulta privada `/api/romo-cierres-duenos-consulta-qa` de Mi Administración estaba apuntada a un Preview de `uki-sushi-inventario` con origen y bandera propios: **no cambiarla al dominio Romo sin trasladar y validar Google+PIN**. Actualmente su lectura es separada e informativa, no incluye ventas Romo en totales generales.
- **No se habilitó** la sincronización de escritura `ROMO_FIN_SYNC_QA_ENABLED`, no se alteró la base financiera ni el panel oficial de Uki, y no se desplegó una nueva versión comercial. Próximo bloqueo: confirmar un **cierre verdadero y su constancia Neon** y después probar en backend autenticado el circuito de incorporación contable por clave única, antes de sumar las cifras al panel de dueños.

## Mi Administración — cierres Romo automáticos en Preview privado (20-11-2026)

- Se creó `public/uki-duenos-romo-cierres-conciliados-qa.mjs`, módulo puro de consulta que une **solo en pantalla** las constancias Romo confirmadas y validadas por Google + PIN con los totales de `Mi Administración`. Verifica clave única `romo:serena|turno`, sucursal, fecha, medios y revisión. Nunca escribe en `fin_movimientos`.
- El cálculo **se detiene** si no terminó la consulta de movimientos, si supera el límite de resultados, si falta el negocio Romo, si hay referencia duplicada o si existe una venta manual Romo del mismo día. No se asigna dinero de Romo a Uki.
- El `delivery_por_pagar` de Romo se presenta por separado, como **obligación al repartidor**, sin tratarlo como efectivo pagado ni descontarlo dos veces como gasto. No incluye facturas ni impuestos: el resultado es preliminar de control.
- Se conectó `public/mi-administracion-duenos.html` a la consulta Romo autenticada. Tras PIN/Google recibe las constancias y recalcula la vista; al cerrar la sesión o fallar la consulta limpia los cierres. Conserva acceso remoto validado por el backend financiero existente y no crea otro PIN.
- Los dos archivos fueron copiados **idénticos por SHA** a la rama privada de preparación financiera `preparacion/uki-romo-sobre-main-20261114` y desplegados en **Preview** del proyecto `uki-sushi-inventario`: despliegue `dpl_2oLzZPTA82PctGx7eeP3XKcozWeY`, alias `uki-sushi-inventario-git-preparacion-c0b0e9-diannaleandra-7046.vercel.app`, estado READY.
- La puerta QA ejecutó `tests/romo-duenos-resumen-automatico-qa.test.mjs` y `tests/romo-duenos-resumen-integracion-qa.test.mjs`, run GitHub Actions **44673401523: success**.
- La consulta read-only en Neon Romo QA confirmó revisión operativa **8, cero constancias definitivas y cero solicitudes pendientes**. **Por no existir aún ningún cierre confirmado, no es posible acreditar la sincronización extremo a extremo con un cierre verdadero**. No se generaron cierres ficticios, pagos, ventas, importaciones ni modificaciones financieras.
- La producción oficial `uki-sushi-inventario` conserva commit `3274dbc1b66b676663b74d74ae40f84d251b3ee9`. La rama `main` no fue alterada. La importación persistida a un libro contable está **deshabilitada**; el Preview agrega los montos solo al resumen privado y no crea asientos.

## Acceso Mi Administración Preview — error Load failed corregido (20-11-2026)

- Captura de iPhone mostraba `Load failed` antes de acceder. La versión de preparación de `public/mi-administracion-duenos.html` invocaba `https://uki-sushi-inventario.vercel.app/api/mi-administracion-live` desde el dominio Preview. La API oficial valida `Origin` y únicamente permite `https://diannaleandra-art.github.io` y su mismo dominio, por lo que la llamada cruzada fallaba por CORS.
- Implementado `api/mi-administracion-lectura-qa.js` para el **Preview exacto** `preparacion/uki-romo-sobre-main-20261114` y alias `uki-sushi-inventario-git-preparacion-c0b0e9-diannaleandra-7046.vercel.app`. Solo permite consultas financieras y autenticación/cierre de sesión PIN: transmite Google+PIN al servicio oficial de manera servidor-a-servidor, que sigue verificándolos. Exige host/origen exactos y bandera `ROMO_CIERRES_DUENOS_LECTURA_QA_ENABLED=true`, no expone credenciales y rechaza acciones de escritura.
- `public/mi-administracion-duenos.html` ahora usa la ruta del Preview `/api/mi-administracion-lectura-qa` tanto para las consultas financieras como para los cierres Uki. El propio navegador rechaza opciones que cambian dinero, con enlace separado para realizar operaciones reales en Mi Administración oficial. La consulta Romo conserva su ruta privada y validación de PIN.
- Añadido `tests/romo-mi-administracion-puente-qa.test.mjs` a la puerta QA, incluyendo comprobación de origen y rama, permisos de solo lectura, Google+PIN, bloqueo de mutaciones antes de red y lectura de la interfaz; **GitHub Actions run 44675475888: success**.
- Los archivos de backend y HTML quedaron copiados al Preview de finanzas con los mismos SHA de la rama QA. Vercel `uki-sushi-inventario`: despliegue **dpl_AJq3UTWmAjd9oJjvvz8wYywLX9T2** en estado **READY**, con alias estable de preparación. Producción de Uki no fue desplegada ni modificada.
- La prueba HTTP directa desde este entorno no pudo hacerse (red no accesible); un despliegue READY y pruebas con simulaciones **no equivalen** a iniciar Google y PIN con Safari real. Ese chequeo queda pendiente de una única apertura de la página actualizada; no se pide realizar compras o registrar movimientos.

## Cierre definitivo Romo — habilitación exclusiva de QA (20-11-2026)

- Se comprobó que el endpoint existente `/api/romo-cierre-definitivo-qa` devolvía **503** por bandera `ROMO_CIERRE_QA_ENABLED` sin configurar, no por un error del formulario. La base Neon de prueba seguía en revisión 8 sin cierres.
- Se incorporó `/api/romo-cierre-preparacion-qa` como preflight **GET de solo lectura**: nunca devuelve host, URL, usuario ni claves, y no consulta ventas ni modifica Neon. Ejecuta exactamente la validación de conexión, origen, cuenta de servicio y proyecto de la API de cierre, suponiendo la bandera activa únicamente dentro del diagnóstico.
- Seguridad reforzada en `api/romo-cierre-definitivo-qa.js`: cuando se ejecuta en `qa/romos-panel-v816` exige que la conexión sea la compute Neon de **br-gentle-wave-be71bcpa** (incluido su pooler); **rechaza la principal** `br-patient-thunder-be9tgmro`. La operación requiere propietario Google autorizado, revisión CAS y constancia escrita de forma atómica.
- Pruebas `tests/romo-cierre-preparacion-qa.test.mjs` registradas en `npm run test:release`; GitHub Actions **44680502235: success**. Verifican bloqueo por base principal, origen ajeno, rama main, usuario no autorizado y ausencia de la bandera.
- Se activó **solo** la variable `ROMO_CIERRE_QA_ENABLED=true` en el Preview del proyecto **romos-sushi-panel**, rama `qa/romos-panel-v816`. Sin producción, sin activar la carta pública y sin alterar Uki.
- Vercel Preview desplegado de nuevo con commit `6c87c27e7632377221857f15792b7fd36f071d2e` → `dpl_Ew8fS2W3XyvdtMDCP1XcAXGZarDr`, READY, alias `romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app`.
- Comprobación HTTP real: `GET /api/romo-cierre-preparacion-qa` dio `configuracionSegura:true, habilitado:true, disponible:true`. `GET /api/romo-cierre-definitivo-qa` ahora devuelve **405 Solo cierres explícitos** (antes devolvía 503). Ninguna petición POST de cierre fue ejecutada.
- Lectura Neon QA posterior: **revisión 8, cero cierres, cero solicitudes pendientes**, sin modificaciones contables. **Pendiente ineludible:** la persona responsable debe contar efectivo real, revisar pagos pendientes y confirmar una vez el cierre desde el panel. Solo después se puede verificar una constancia verdadera y su reflejo en Mi Administración. No inventar datos para completar esta prueba.

## Primer cierre real Romo QA y ruta de Mi Administración corregida (20-11-2026)

- El responsable confirmó manualmente el cierre del turno `2026-11-19@1795146049177` en el panel Romo QA. Neon `br-gentle-wave-be71bcpa`, base `romos_sushi`, pasó a revisión **10** y guardó **una** constancia única en `romo_cierres_constancia_v1` con `source_key=romo:serena|2026-11-19@1795146049177`. Fecha de cierre 20/11/2026 (Chile), jornada contable 19/11/2026. Total ventas $0, efectivo contado $0, gastos $0, propinas $0, diferencia $0, pedidos contados en cierre 0. No se ejecutó un cierre ficticio.
- La rama principal de Neon Romo `br-patient-thunder-be9tgmro` conserva **cero** cierres; aislamiento comprobado con consultas de solo lectura.
- Causa real del Preview de Mi Administración sin el nuevo cierre: `ROMO_PRIVATE_DATABASE_URL` y `ROMO_PRIVATE_DATABASE_HOST` en `uki-sushi-inventario` rama `preparacion/uki-romo-sobre-main-20261114` apuntaban a la **rama principal** de Neon Romo (host `ep-damp-sun-beofcvis`), no a QA (`ep-wild-hat-bezucf4v`). Se corrigieron ambas variables **solo en Preview** al connection string de Neon QA con rol existente `romos_app_service`, sin imprimir ni exponer credenciales.
- Preview financiero desplegado nuevamente, commit `57ed98ac61dc5c96e0281e1a661ef5cafba7f6be`, despliegue `dpl_8NHW7vZxNYjzidd1PAPD8fMwAWf3` READY, alias `uki-sushi-inventario-git-preparacion-c0b0e9-diannaleandra-7046.vercel.app`. Smoke-test sin credenciales: página HTTP 200; endpoint privado GET responde 405 (está habilitado, pero exige POST autenticado).
- Pendiente verificación **autenticada** de lectura en Mi Administración: usar Google + PIN ya existentes, período que incluya **19/11/2026**, y botón «Actualizar cierres de Romo». Se espera una fila de cierre confirmada por $0 con revisión Neon 10. El resumen automático depende además de que el negocio Romo figure en el catálogo financiero y no existan ventas manuales potencialmente duplicadas.
- Nunca se alteró la producción de Uki ni la base principal Romo. La vista privada sigue siendo de solo lectura, sin asientos automáticos `fin_movimientos`.

## Verificación de carta y bloqueo de promoción exclusiva de Uki (20-11-2026)

- Auditoría actual de repositorios y Vercel: carta aprobada de Romo en `diannaleandra-art/romos-sushi-qa.`, rama `release/romos-carta-v816`, raíz `replica-uki/carta`; panel Romo QA en este repositorio, rama `qa/romos-panel-v816`; ambas versiones privadas siguen protegidas por Vercel Authentication. **No promover a producción por simple re-deploy**.
- Neon Romo **QA** `br-gentle-wave-be71bcpa`, base `romos_sushi`: `romo_carta_ediciones_v1` tiene **revisión 1**, hash de 64 caracteres y auditoría inicial `catalog:baseline` con motivo de confirmación manual. La principal `br-patient-thunder-be9tgmro` continúa sin revisión de catálogo. No modificar ambas bases simultáneamente.
- GET HTTP privado de `/api/romo-cambios-carta-qa` confirmó `revision:1`, `baseCount:40`, `changes:[]`, modo `qa_solo_lectura_no_habilita_pedidos`. El catálogo se encuentra referenciado; no equivale por sí solo a publicación a clientes.
- Se verificó que el producto `dish:sushi-burger-promo` permanece **por compatibilidad** entre las 40 referencias con el hash ya aprobado; el frontend de Romo lo oculta y su `validateDish` lo rechaza por pertenecer a Uki. Sin embargo el editor antiguo de Romo todavía lo exponía.
- Corregidos **sin modificar hash, precios, carrito ni base de datos**: `public/romo-panel-qa/romo-carta-editor-seguro-qa.js` lo excluye de listados, promociones, conteos por categoría y edición; `lib/romo-carta-ediciones-seguras-qa.mjs` lo presenta con `available:false` y rechaza guardarlo aunque el usuario tenga permisos de dueños. Los otros 39 SKU de venta conservan sus controles existentes. Se añadió `tests/romo-carta-promo-exclusiva-uki-qa.test.mjs` a `test:release`.
- GitHub Actions QA integral **44773946714** y validación de administración **44773946931**, ambas **success**, commit `930b5e3653abc294e64db59b59e0cd07caecff4e`.
- Panel Preview Vercel `romos-sushi-panel` `dpl_4F5AbL9xbezGY8GKHCyLC1GEKZG8`: READY, alias `romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app`; smoke-test directo del JS actualizado HTTP 200 y compuerta de cierre GET respondió `disponible:true`.
- **Conservadas las pruebas reales anteriores:** solicitud de 4 korokes aceptada como pedido por cobrar, cierre de jornada del 19/11/2026 en Neon QA revisión 10 con $0, e inclusión del único cierre por $0 en Mi Administración Preview autenticado (captura de iPhone de la dueña). La integración de resúmenes **no hace asientos financieros** en Uki.
- **No se considera completa la publicación comercial:** falta congelar releases independientes con configuración de **producción propia de Romo** (sin variables QA), confirmar fuente efectiva de precios/stock/promociones y editor completo CRUD, y verificar operaciones restantes de paridad Uki (inventario/PIN, timbres, edición y rectificación, delivery, caja/pagos reales) con pruebas manuales limitadas. La existencia de un catálogo aprobado y un cierre $0 no demuestra todavía ventas reales. No crear pedidos ni cobros ficticios y no tocar `main` de Uki.

## Reenvío simultáneo de solicitudes de la carta — corrección QA (20-11-2026)

- Se confirmó por HTTP que la carta privada Romo `release/romos-carta-v816` devuelve **200** con catálogo de **40 productos**, revisión **1**, 1 cambio (Sushi Burguer solo Uki `available:false`); GET `/api/romo-recepcion-carta-qa` devuelve `enabled:true`, `countsAsSale:false`. GET directo al panel sin cuenta de personal responde **403**, correctamente.
- Identificado el fallo de idempotencia bajo concurrencia en `lib/romo-solicitudes-carta-qa.mjs`: dos solicitudes simultáneas con el **mismo** `request_key` podían leer inicialmente "inexistente"; `ON CONFLICT DO NOTHING` evitaba el segundo INSERT pero devolvía **409** incluso cuando el primer intento ya había quedado como pedido pendiente. Una respuesta de error podía provocar un reintento innecesario del cliente.
- Corregido únicamente en rama QA del panel: si el INSERT no devuelve fila, el servidor relee por `store_id` y `request_key`, y devuelve `repetido:true` **solo si coinciden** código, cliente, mensaje íntegro, importe y SHA256 de la cotización. Si no hay fila o hay diferencia, conserva **409**. Un pedido ya aceptado nunca vuelve a presentarse como `pendiente`.
- Pruebas `tests/romo-solicitudes-reintentos-concurrentes-qa.test.mjs` cubren simultaneidad, duplicado normal, importe incompatible, fila ausente y solicitud previamente aceptada; añadidas a `test:release`. GitHub Actions QA **44775924661** y administración **44775924797**: ambas **success**.
- Desplegado exclusivamente el panel privado Romo QA Vercel con commit `d57b9c02b1c1b059804ee319d539fbf5ae719780`: `dpl_HusYyG1h5gzQx2QG3tYArUiJoHcz` **READY**, alias `romos-sushi-panel-git-qa-romos-panel-v816-diannaleandra-7046.vercel.app`. El receptor de la carta respondió HTTP **200 enabled:true** tras el despliegue. Sin ningún POST real.
- Lectura posterior Neon QA: revisión de Caja **10**, **1 cierre** definitivo, catálogo edición revisión **1**, **3 solicitudes históricas**, **0 pendientes**. No se modificaron pedidos, importes ni bases.
- **Aún no publicar a clientes:** el arranque normal `romo-arranque-protegido-qa.mjs` continúa bloqueado por `permiteCompras:false`; solo la ruta separada `/api/romo-piloto-operativo-qa` tiene puerta de recepción privada protegida por Vercel Authentication. Falta implementar y verificar la habilitación específica de producción Romo y la paridad completa de funciones con Uki, sin mesas QR de Romo. No alterar `main` de Uki ni copiar variables QA a producción.

## Carta sin mesas QR + piloto operativo privado (20-11-2026)

- En `diannaleandra-art/romos-sushi-qa.`, rama `release/romos-carta-v816`, la carta Romo tenía activo el código heredado `iniciarPedidoMesa` dentro de `replica-uki/carta/public/candidata/app.js`. Un enlace `?sucursal=serena&mesa=N` o un hash `#uki-mesa-...` podía disparar la API de mesas de Uki, aunque Romo **no tiene QR de mesa**. Se corrigió al principio del bloque para salir sin leer parámetros ni registrar pedidos cuando `document.body.dataset.marca==='romo'`.
- El pedido normal conserva `checkout.onsubmit`, validación de carrito, llamada `POST /api/romo-recepcion-carta-qa` y paso a WhatsApp **solo tras confirmar recepción**, sin cobros automáticos. No se añadieron funciones ni QR nuevos.
- Agregado `replica-uki/carta/tests/romo-pedidos-sin-qr-mesas-qa.test.mjs`: comprueba con VM que, aunque se entregue una URL QR histórica, no se lee `location.search` ni se llama a `/api/mesa-pedidos-live`; constata que la ruta de pedido normal permanece intacta. CI carta GitHub Actions **44777235250: success**.
- Despliegue manual únicamente a **Preview aislado** de carta en Vercel `romos-sushi-carta-qa`: `dpl_7KeXL6XnuPSxe23BMVuL9WYbAane` READY, commit `6187c2713766772ca8979125563b6dcc1490f365`, alias estable `romos-sushi-carta-qa-git-release-romo-357bb1-diannaleandra-7046.vercel.app`.
- Smoke test HTTP real: `GET /candidata/app.js` 200 con retorno anticipado de QR, `GET /api/romo-recepcion-carta-qa` 200 `enabled:true,countsAsSale:false`; `GET /api/romo-cambios-carta-qa` 200, revisión 1, 40 referencias y Sushi Burguer exclusivo de Uki deshabilitado.
- La ruta privada `GET /api/romo-piloto-operativo-qa` 200 devuelve HTML Romo con `data-romo-piloto=1`, prearranque `romo-arranque-piloto-operativo-qa.mjs` y aviso `Sin cobros automáticos`; el script protegido normal no aparece duplicado. La ruta todavía está bajo SSO Vercel. HTTP + CI no son equivalentes a ejecutar un pedido real en Safari.
- **No abrir producción con este cambio:** la carta normal sigue con `permiteCompras:false` por diseño; falta validación comercial de todas las modalidades y configuración de producción separada de QA. No se tocaron Neon, caja, panel oficial Uki ni dominios públicos.

## Modalidades de pedido y medio Junaeb — QA verificado (20-11-2026)

- En carta Romo `diannaleandra-art/romos-sushi-qa.`, rama `release/romos-carta-v816`, se detectó **Junaeb ofrecido en pago ordinario** (papitas, sushi normal, etc.) porque `paymentOptions()` incluía `junaeb` como opción base y `monthlyPayments()` sin promoción no lo eliminaba. Corregido en `public/candidata/model.mjs` aplicando `.filter(v=>v!=='junaeb'||junaeb)`: Junaeb queda disponible **solo** si se eligió `romo-24-junaeb`, sin mezclar otros productos, como estaba aprobado. El cotizador privado usa el mismo modelo para rechazar pago improcedente.
- Se habilitó exportación interna de `quoteOrder` en `api/romo-cotizacion-servidor-qa.js` únicamente para pruebas automáticas (`module.exports._qa`): **no** se añadió endpoint público ni cambió la API comercial. `tests/romo-pagos-y-modalidades-servidor-qa.test.mjs` coteja retiro, consumo en local normal (sin QR), delivery con recorrido simulado, subtotales, importe final, texto WhatsApp, medio Junaeb y prohibición de pedidos no cotizados, **sin solicitudes POST reales ni escritura en Neon**.
- Las primeras ejecuciones fallaron por dos errores en el fixture de test (falta de `location` en la cotización preparada y uso de import sin el mismo `?v=` del caché de delivery); corregidos para simular exactamente el código que usa la carta. **Ejecución final completa GitHub Actions `44779490031`: success**, commit `32f804bdd3a69a6e7de2d31c03804bcb42df9b4e`.
- Carta privada Vercel redeploy `dpl_F1C7rfSMNrVNXLfjtogzMcDfLaPR` READY, alias `romos-sushi-carta-qa-git-release-romo-357bb1-diannaleandra-7046.vercel.app`. HTTP real: `/candidata/model.mjs` 200 con bloqueo Junaeb; `/api/romo-piloto-operativo-qa` 200 privado; `/api/romo-recepcion-carta-qa` 200 `enabled:true,countsAsSale:false`; `/api/romo-cambios-carta-qa` 200 revisión 1, 40 productos y 1 cambio.
- Las pruebas son simulación lógica y comprobación HTTP de solo lectura, **no equivalen** a pedidos con dinero real ni a autorizar producción. La carta comercial sigue protegida y sin apertura pública; no se modificó el panel Uki ni la caja Romo.
