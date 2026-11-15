# Auditoría de paridad funcional — Uki oficial v8.16 vs. Romo La Serena

Fecha: 14-11-2026. Alcance: inspección directa del código oficial de Uki, de la rama Romo y lectura del estado de Neon, **sin pruebas automáticas, escrituras comerciales, creación de pedidos, ni modificación de cajas**.

## 1. Fuentes de referencia

- **Panel oficial aprobado de Uki**: `firebase/uki-sushi-local.html` de `main`, blob `578a595f5fe1bc72a753ddc2520f0246ec297315`, y sus 13 módulos `firebase/uki-*.js`.
- **Réplica Romo integrada**: `public/romo-panel-qa/index.html` de `preparacion/uki-romo-sobre-main-20261114`, blob `68cb4051777a62a8c1b874540a0e17b7a8373096`, sus módulos `public/romo-panel-qa/`, endpoints `api/romo-*.js`, librerías `lib/romo-*.mjs`.
- **Carta pública Romo**: repositorio `diannaleandra-art/romos-sushi-qa.`, rama `integracion/romo-ultima-carta-pedidos-20261114`, proyecto Vercel separado.
- **Bases separadas**: Neon `romos_sushi` para Romo; Neon de finanzas Uki y rama QA financiera para análisis de cierres.
- El fichero `public/index.html` del repositorio principal es el acceso de inventario del trabajador, **no** el panel oficial completo. No confundir.

## 2. Comparación estructural reproducible

- 320 declaraciones de funciones del panel oficial están presentes en la réplica Romo.
- 296 funciones tienen su cuerpo textual idéntico en la comparación por límites de función; 24 fueron modificadas o rodeadas por conexiones Romo.
- Los **13 módulos complementarios** del panel oficial se encuentran en Romo: 7 tienen blobs idénticos; 6 contienen adaptaciones.
- Módulos idénticos: `uki-tarjeta-cliente.js`, `uki-cierre-detallado.js`, `uki-inventario-exportar.js`, `uki-inventario-historial-admin.js`, `uki-factura-inventario-admin-panel.js`, `uki-caja-acumulada-exportar.js`, `uki-control-turnos.js`.
- Módulos adaptados: `uki-inventario-admin-embebido.js`, `uki-disponibilidad-admin.js`, `uki-carta-precios-admin.js`, `uki-armado-ingredientes-admin.js`, `uki-caja-acumulada-admin.js`, `uki-carta-remotas-panel.js`.
- **Presencia de código no acredita igualdad operativa**, porque existen desvíos de navegación, guardado y autorización.

## 3. Matriz completa por áreas de la versión oficial

| Área oficial | Estado en Romo | Evidencia / pendiente |
|---|---|---|
| Selector de tres locales, claves y privacidad por sucursal | Parcial | Selector y acceso de Romo en réplica; todavía ruta de integración distinta de la operación oficial Uki. |
| Pedidos desde carta, con modalidades retiro/delivery/consumo | Parcial | Carta publicada, recepción de solicitudes Neon y pantalla de ingreso; pendiente unificar íntegramente el flujo oficial. |
| Pedidos de WhatsApp, armado automático de mensaje y borradores | **No equivalente** | `cambiarModoNuevo` obliga a «manual» en Romo; `ndGuardar` reemplaza el guardado común. |
| Lista de pedidos, filtros, búsqueda, estados, historial y edición | **No equivalente** | `vPedidos` devuelve `ukiRomoPedidosPendientesHTMLQA` y sustituye el listado oficial. Historial y edición avanzada requieren el mismo comportamiento y CAS. |
| Mesas y consumo en local | Parcial | El campo y modalidad figuran en el modelo; falta verificar el procedimiento de mesas/dispositivos del panel oficial, no solo la etiqueta. |
| Clientes, código y búsqueda; timbres, acumulación y envío WhatsApp | **No equivalente** | `vClientes` devuelve `ukiRomoTimbresPanelQA`, pantalla simplificada, no toda la ficha oficial. |
| Cobro de pedidos, pagos mixtos, Edenred, delivery pagado aparte, propinas | Parcial | Hay cobro aislado y desglose; el ingreso manual Romo bloquea múltiples operaciones del `ndGuardar` oficial. Propinas adicionales no están homologadas en el cobro Romo. |
| Delivery por ruta y tarifas de Uki | Aprobado visualmente; ingreso parcial | Usuaria confirmó en carta cálculo por calles; envío de km/tarifa y su lectura se añadieron a integración. Falta confirmar ruta completa de pedido a caja. |
| Caja: Resumen | Parcial | `vCaja` devuelve `ukiRomoCajaConsultaHTMLQA`, no la vista oficial. |
| Caja: Movimientos — gastos, apps, delivery manual, repartidor, propinas, retiros, caja chica | **No equivalente** | El panel oficial tiene **siete tipos** de movimientos; Romo usa botones y guardados específicos que no exponen todo el flujo oficial. |
| Caja: Precierre del trabajador | Parcial | Existe con fotografía/diferencias y exportación; el guardado aún depende de sesión de dueños, no de acceso independiente del trabajador. |
| Caja: Cierre definitivo | Parcial | Protocolo CAS/constancia separado; falta recorrido manual real y paridad de cierres/rectificaciones/compartir. |
| Caja: Historial y descarga PDF/Excel | **No equivalente** | Funciones heredadas presentes pero la caja Romo sustituye el conjunto oficial de pestañas; falta habilitar sobre estado persistido y revisado. |
| Caja: Reportes semanales y por fecha | **No equivalente** | `vReportes` está copiado, pero `vCaja` Romo no lo presenta. |
| Caja: Acumulada en efectivo | **No equivalente** | El módulo `uki-caja-acumulada-admin.js` rechaza expresamente consultas Romo a la API Uki; falta servicio Romo equivalente. |
| Inventario administración por sucursal (CRUD, mínimos, faltantes, historial) | Parcial avanzado | Inventario Romo aislado, lista importada de nombres y unidades sin existencias; módulo Romo propio. Falta validar manualmente equivalencia de todas las operaciones con la versión oficial. |
| Inventario trabajador PIN de 6 dígitos, conteo, entradas, PDF/Excel/WhatsApp | Disponible; sujeto a comprobación manual integral | PIN propio Romo configurado; no autoriza caja ni cierres. |
| Carta: categorías CRUD, precios, fotos, promociones de producto y descuentos | **No equivalente** | `uki-carta-precios-admin.js` rechaza explícitamente Romo; el banner publicitario es distinto del CRUD del catálogo. |
| Carta: ingredientes y armado, extras, disponibilidad/agotado | **No equivalente** | `uki-armado-ingredientes-admin.js` y `uki-disponibilidad-admin.js` bloquean edición Romo en las API Uki; se necesitan endpoints/estado Romo compatibles. |
| Promociones del banner desde panel | Implementado independiente | Sección `Promos` para fotografías/textos, alojada en Neon Romo; no modifica precios ni categorías ni sustituye promociones de producto. |
| Mi Administración: consulta de cierres Romo | Solo lectura | Se añadió sección privada informativa; consulta Neon de cierres confirmados. |
| Mi Administración: incorporación idempotente de cierres a ventas y reportes generales | **Pendiente** | En rama financiera QA existe tabla de cierres `fin_romo_cierres_live_v1`; en Neon de finanzas privadas usado comercialmente la tabla **no existe** al 14-11-2026. No sumar nada hasta validar cierre real y unicidad de `source_key`. |
| Gastos/facturas por proveedor, utilidades generales | **Pendiente para Romo** | Funciones de Administración Uki existen, pero no se verificó atribución independiente automática a Romo. |
| Exportaciones y compartir cierre por WhatsApp | Parcial | Funciones y módulos oficiales están copiados, pero la exposición y persistencia de la ruta Romo no está homologada. |
| Manejo de errores, auditoría, desbloqueo de pedido desde dueños | **Pendiente de paridad real** | Las acciones deben registrar identidad y constancia en Neon Romo sin eludir revisiones CAS. |

## 4. Bloqueos de código exactos a resolver

1. `vCaja` devuelve inmediatamente `ukiRomoCajaConsultaHTMLQA()` para Romo. El menú oficial de Caja tiene **7 pestañas** (`resumen`, `movimientos`, `precierre`, `cierre`, `historial`, `semana`, `acumulada`); Romo no usa ese menú completo.
2. `vPedidos` devuelve `ukiRomoPedidosPendientesHTMLQA()`: evita parte del historial, filtros, gestión avanzada y componentes del procedimiento oficial.
3. `vClientes` devuelve `ukiRomoTimbresPanelQA()`: no muestra la misma ficha completa de clientes y timbres.
4. `ir` restringe navegación Romo a `pedidos`, `nuevo`, `caja`, `clientes`, `inventario`, `promos`, y `render` además filtra la navegación oficial.
5. `cambiarModoNuevo` impide modalidades de ingreso de pedidos diferentes de `manual` en Romo.
6. `ndGuardar` usa ingreso especializado y limita edición/mixtos/timbres en Romo, en lugar de preservar todas las funciones del flujo Uki.
7. `guardarEnLocalStorage` retorna `Promise.resolve(true)` de inmediato para Romo: la porción posterior de autoguardado es **inalcanzable**. Es deliberadamente un control de aislamiento, pero hace inseguro habilitar funciones de Uki sin reescribir sus operaciones para guardar y esperar el CAS Neon Romo.
8. `uki-carta-precios-admin.js`, `uki-armado-ingredientes-admin.js`, `uki-disponibilidad-admin.js`, `uki-caja-acumulada-admin.js` y `uki-carta-remotas-panel.js` tienen bloqueos Romo explícitos, necesarios para no modificar datos Uki, pero que aún no poseen sus equivalentes completos en Romo.
9. El PIN existente de inventario Romo **no** concede permiso financiero; no reutilizarlo para precierres de Caja sin diseñar una autorización acotada y auditada.
10. El registro financiero Romo aún no se incorpora al libro comercial; tampoco hay cierres confirmados que permitan verificar una importación real.

## 5. Evidencia de estados (solo lectura)

Al consultar Neon Romo el 14-11-2026:
- Solicitudes pendientes de carta: **1**.
- Solicitudes aceptadas de carta: **0**.
- Constancias de cierres definitivos Romo: **0**.
- PIN de inventario configurado: **1**.
- Documento de estado de inventario: **1**.
- Revisión del estado operativo cifrado Romo: **2**.
- Cierres registrados en la rama financiera QA: **0**.
- Tabla `fin_romo_cierres_live_v1` en rama de finanzas privadas comerciales: **ausente**.

Las cifras pueden variar luego de nuevas operaciones manuales. No se han creado pedidos ni cierres desde esta auditoría.

## 6. Orden para alcanzar paridad real sin rehacer Uki

**Bloque 1 — guardado y permisos:** adaptar la operación común del panel oficial a una capa por sucursal, usando la misma lógica de negocio y serialización, pero CAS cifrado Neon propio de Romo. Cada acción debe esperar confirmación del servidor; errores no pueden aparentar éxito. Conservar Uki tal como está. Unificar flujos de nuevo pedido, edición, estado y timbres.

**Bloque 2 — pantallas oficiales:** reemplazar las derivaciones simplificadas de `vPedidos`, `vClientes` y `vCaja` por los mismos procedimientos oficiales, adaptando exclusivamente entradas/salidas y permisos Romo. Validar los 7 tabs de Caja y 7 tipos de movimientos, además de pedidos de mesas, WhatsApp y mixtos. No activar botones si no guardan en Neon.

**Bloque 3 — carta y administración de catálogo:** implementar para Romo los endpoints propios de categorías CRUD, precios/descuentos, disponibilidad, fotos e ingredientes sin conectar accidentalmente las APIs Uki. Mantener diseño, banner y delivery aprobados.

**Bloque 4 — trabajador, cierre y finanzas:** usar acceso limitado a la operación del precierre (no PIN inventario para caja), conservar el flujo oficial de cierre, preparar tabla y servicio de importación idempotente `source_key` en la rama financiera que usa Mi Administración, y contar solo cierres definitivos reconciliados, jamás solicitudes pendientes ni precierres.

**Bloque 5 — validación:** una prueba **manual** de punta a punta de pedido real por cada modalidad necesaria; revisar pagos, timbres, delivery, precierre, cierre y único registro financiero, con revisiones y copias de seguridad. Sin tests que generen movimientos comerciales automáticamente.

**Reglas inamovibles:** un solo panel, tres sucursales (Uki Regimiento Arica, Uki La Serena y Romo La Serena), mismas funciones; catálogo/imagen/precios/registros/caja independientes; ningún cambio a Uki oficial, ningún nuevo diseño ni despliegue por pantalla, y ninguna declaración de paridad completa antes de la comprobación manual.
