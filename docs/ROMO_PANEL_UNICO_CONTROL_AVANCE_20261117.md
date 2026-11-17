# Panel único Uki + Romo — control real de avance (17-11-2026)

## Objetivo aprobado, sin funciones nuevas
Un mismo panel y procedimiento de acceso para **Uki Regimiento Arica**, **Uki La Serena** y **Romo's Sushi La Serena**. Cada local conserva pedidos, caja, inventario, timbres, carta y datos propios. La versión aprobada de Uki no debe cambiar sus operaciones; Romo debe heredar las mismas funciones, con colores, catálogo y precios propios.

## Fuentes verificadas
- `firebase/uki-sushi-local.html` de `main`: panel oficial Uki v8.16, **sin integración Romo publicada**.
- `firebase/uki-sushi-local.html` de `qa/romos-panel-v816`: **mismo archivo de panel en QA**, con selector de tres sucursales y ruta de consulta Romo.
- `public/romo-panel-qa/index.html` de la misma rama: réplica avanzada de Romo con pantallas y servicios aislados. **No es el resultado final ni se considera integrado operativamente**.
- `api/romo-estado-cifrado-panel-qa.js`: GET de estado cifrado aislado, exige Google y permiso Neon Romo. POST comercial sigue separado bajo banderas adicionales.
- `docs/AUDITORIA_PARIDAD_UKI_OFICIAL_ROMO_20261114.md`: matriz histórica de pendientes funcionales de paridad.

## Cambios confirmados en la rama de pruebas
1. Se mantiene selector de tres sucursales sin añadir Romo a los IDs productivos `SUCURSALES` de Uki.
2. `guardarEnLocalStorage()` **no guarda Romo automáticamente** al cambiar de pantalla. Nunca cae en los respaldos o Firebase de Uki. Los cambios transaccionales requerirán CAS Neon y permisos explícitos.
3. El acceso de Romo en **el mismo panel** dispone de «Ver Romo en modo consulta»: GET autorizado a Neon, descifrado local AES-GCM con clave del panel, verificación de sucursal y resumen de revisión/pedidos/cierres/base de caja/caja chica. No ingresa en `S.suc`, no copia registros a Uki y no envía POST.
4. El módulo operativo `firebase/uki-romo-operativo-qa.mjs` conserva `ROMO_OPERATIVO_ENDPOINT_QA=''`. Por eso **no se han habilitado pedidos, cobros ni cierres** desde el panel unido.
5. El editor de catálogo Romo separa la bandera de consulta `ROMO_CARTA_EDICIONES_QA_ENABLED` de la bandera de escritura `ROMO_CARTA_EDICIONES_ESCRITURA_QA_ENABLED`. El editor oculta controles de cambio en modo lectura.
6. Todas las modificaciones de esta etapa son en `qa/romos-panel-v816` (GitHub), **sin publicación automática de la rama**, sin merge a `main`, sin cambios de variables comerciales ni escrituras Neon.

## Pendientes que impiden darlo por terminado
- Conectar el motor de operaciones Romo al mismo flujo visual/funcional de Uki **sin desactivar** salvaguardas de persistencia ni copiar datos Uki. Mantener CAS, identidad y prueba manual.
- Homologar realmente nuevo pedido, solicitudes carta, WhatsApp, mesas, pagos mixtos, delivery, historial y timbres; los botones de una réplica no prueban esa equivalencia.
- Completar la paridad de las siete pestañas de caja, tipos de movimientos, precierre, cierre, rectificaciones, importación financiera idempotente y Mi Administración.
- Validar inventario de trabajador/admin, categorías CRUD, catálogo, ingredientes, fotos, precios/descuentos y banner en Romo con destinos de guardado propios.
- Verificar que los módulos de consulta se carguen y funcionen con Google/Neon en un **único Preview** del panel compartido; después pruebas manuales de extremo a extremo con la dueña, sin transacciones sintéticas.

## Reglas de publicación
No publicar producción Uki ni Romo desde esta etapa. Agrupar correcciones en GitHub y realizar una única publicación Preview para comprobación manual cuando el bloque esté listo; no reutilizar un redeploy de un commit anterior. Sin prueba operativa no declarar «terminado» ni «idéntico».

## Avance de lectura integrada — 17-11-2026
- En `firebase/uki-sushi-local.html` (misma interfaz QA de tres sucursales) se conectaron **tres pestañas de consulta** para Romo: Pedidos (solicitudes desde carta, no ventas), Inventario, Carta y precios. Todos sus accesos HTTP son `GET` autenticados por Google, con verificación de `storeId=romo:serena`; no exponen `POST`, no copian el JSON a `S` ni guardan en Uki.
- La bandeja de Pedidos usa `/api/romo-solicitudes-carta-qa`, Inventario usa `/api/romo-inventario-qa` y Carta aprobada usa `/api/romo-carta-ediciones-seguras-qa`. Los errores de servicios se muestran como **no disponibles**; nunca se inventan cantidades ni se afirma éxito.
- Se comprobó **sin escritura** en Neon Romo que `romo_catalogo_v1` tiene 7 productos y 2 categorías en su versión 1; `romo_inventario_v1` tiene 38 artículos. El catálogo auxiliar de 7 **no es equivalente** a la carta aprobada de 40 productos.
- Por ello la consulta del panel único exige **los 40 productos confirmados** por el servicio de carta aprobada, `readOnly=true` y permiso de edición desactivado; si no se confirman, presenta el error y no sustituye contenido con los 7 del catálogo auxiliar. No se modificaron precios ni categorías en Neon.
- Se añadió barrera contra respuestas cruzadas cuando se cambia rápidamente de pestaña, y los nombres de productos/artículos se muestran con escape de HTML.
- **Pendiente manual**: comprobar la carga real de cada consulta en una Preview autorizada (sin publicar todavía), verificar la equivalencia de contenido y luego implementar operaciones completas siguiendo la versión oficial Uki.

## Puente de solo lectura del panel único — actualización 17-11-2026

**Operación comercial sigue APAGADA. Ningún despliegue ni cambio de permisos en Vercel o Neon durante este bloque.**

1. La vista de pedidos del panel único ahora distingue los **pedidos efectivamente registrados en el estado cifrado de Romo** de las **solicitudes pendientes de la carta**; no suma solicitudes como ventas. Para pedidos registrados reutiliza las categorías del Uki oficial `UKI_CATEGORIAS_PEDIDOS`, `ukiCoincideCategoriaPedido` y `ukiOrigenPedido`, con búsqueda por nombre, teléfono y códigos. Los datos se descifran solo en memoria y **no se copian a `S` ni a almacenamiento Uki**.
2. La salida de Romo está separada de `guardarEnLocalStorage()` de Uki. Si alguna vez se abre una sesión operativa Romo, se exige cerrar primero correctamente su sesión CAS y no abandonar un formulario con contenido sin confirmación; las sucursales Uki conservan su salida habitual.
3. Se preparó un puente **exclusivamente de lectura GET** entre el Preview del panel `uki-sushi-inventario` y la API del proyecto aislado `romos-sushi-panel`. `lib/romo-origen-seguro-qa.cjs` sólo autoriza un origen exacto `https://uki-sushi-inventario-git-qa-romos-panel-v816-<equipo>.vercel.app`, configurado en **Preview del proyecto Romo** con la variable `ROMO_PANEL_UNIFICADO_LECTURA_ORIGIN`. No acepta otros orígenes, Production, otra rama, ni rutas de escritura POST/PATCH/DELETE o sus preflights.
4. Las API de estado cifrado, solicitudes, inventario y carta aprobada admiten ese GET adicional únicamente con JWT Firebase válido y permisos por rol comprobados en Neon Romo. La cuenta y base siguen siendo de Romo. CORS anuncia **GET,OPTIONS** para ese origen, mientras mantiene los permisos originales del sitio Romo.
5. El navegador usa el backend QA aislado de Romo únicamente cuando el host del panel corresponde a esa rama Preview de Uki; utiliza `credentials:'omit'` para la petición entre dominios y token Google `Authorization`. En la copia Romo conserva rutas locales; no se altera el dominio oficial comercial.

**Configuración aún no realizada**: tras confirmar ambos Preview, registrar una sola vez en Vercel Romo el origen exacto del Preview del panel único; no añadirla hoy sin URL confirmada ni hacer redeploy del commit antiguo. Confirmar manualmente si la protección de despliegues de Vercel permite GET entre sitios con JWT Google; si no, no relajar seguridad por ensayo y error.

**Lo que falta para paridad real**: incorporación de las mismas acciones operativas de pedidos/WhatsApp/mesas, pagos mixtos, timbres, caja y cierres sobre CAS Neon exclusivo, pruebas manuales de un pedido real de Romo y su conciliación, y publicación final del selector sin alterar sesiones/datos locales de los dos Uki. Estas consultas no equivalen a habilitar ventas.

**Verificación realizada**: 14 comprobaciones locales del helper de orígenes (GET y preflight GET permitidos, POST/PATCH/OPTIONS POST y Production rechazados). Se añadieron pruebas estáticas en `tests/romo-panel-unico-origen-lectura.test.mjs`. No se ejecutaron pruebas operativas ni escrituras comerciales. 

## Página de prueba navegable preparada — 17-11-2026

**Nuevo archivo público sin publicar:** `public/romo-panel-qa/panel-unico-consulta-qa.html`. Es la versión de consulta del panel de locales v8.16, derivada de `firebase/uki-sushi-local.html` QA. No sustituye `/romo-panel-qa/index.html`, el redirect `/` ni los enlaces oficiales de Uki.

**Protección real de este Preview:** la página muestra los tres nombres del selector, pero mantiene las dos sucursales Uki bloqueadas en este enlace de pruebas y la apertura operativa Romo desactivada. Explica esa restricción al personal, para impedir que un pedido de prueba se interprete como pedido real. Se quitaron los 17 scripts externos que podían conectar inventario, ventas o nube. Se retiró todo el módulo Firestore de lectura/escritura y el autoguardado; únicamente se carga Firebase Auth para solicitar el token Google ya autorizado. La contraseña descifra el sobre Romo localmente mediante la consulta GET y no se envía al servidor.

**La única conexión en esta página** es lectura autenticada hacia el backend Romo QA: estado cifrado, solicitudes de carta, inventario y carta aprobada de 40 productos. No hay POST de la interfaz. El panel normal de Romo y el oficial de Uki siguen sin cambios. La implementación completa de caja y pedidos Romo **todavía falta** y no debe interpretarse como terminada.

**Pruebas de regresión añadidas:** `tests/panel-unico-qa-pagina-lectura.test.mjs`, junto con pruebas de orígenes GET y aislamiento incorporadas a `npm run test:release` en la rama QA. Las comprobaciones estáticas y sintácticas no sustituyen cargar la página en Safari y consultar Neon con Google y clave.

**Configuración agrupada antes del único Preview:** 1) desplegar `qa/romos-panel-v816` en un Preview aislado de Uki que sirva el nuevo archivo; 2) identificar su origen exacto, y agregarlo como `ROMO_PANEL_UNIFICADO_LECTURA_ORIGIN` **solo en el Preview de `romos-sushi-panel`**; 3) publicar la misma revisión QA del backend Romo (ya contiene las cuatro APIs GET con CORS restrictivo). Si Vercel/Firebase bloquean el origen, diagnosticar sin debilitar reglas ni copiar credenciales; no publicar a Production. Solo una revisión manual de la vista y acceso, y después continuar la homologación de operaciones pendientes.

## Bloque operativo de pedidos/caja preparado en código — 17-11-2026

En la rama `qa/romos-panel-v816` se incorporaron, **sin habilitar escrituras comerciales ni publicar en Vercel**:

- `firebase/uki-romo-transacciones-panel-unico-qa.mjs`: coordinación ÚNICA de tres operaciones del sistema existente: **pedido manual nuevo pendiente sin pago**, **cobro de pedido existente no pagado** (incluidos pagos mixtos validados por el módulo aprobado), **movimientos de caja**. Todas utilizan la misma sesión cifrada, una COPIA del estado y **CAS Neon** por revisión. Ningún cambio se aplica a la pantalla antes de confirmar la escritura. Ante incertidumbre o error de pantalla se bloquea reintento y se exige releer Neon. La constante `ROMO_TRANSACCIONES_PANEL_UNICO_QA_HABILITADAS=false` mantiene el bloque comercial apagado.
- `firebase/uki-romo-pedido-manual-panel-unico-qa.mjs`: candidato de pedido manual **Pendiente, no Pagado**, mismo folio real de turno y validación de caja abierta con base confirmada; no admite código de carta, QR ni cobros mezclados para evitar convertir solicitudes de carta pendientes en ventas duplicadas. No reemplaza el flujo completo de mesa/carta.
- `firebase/uki-romo-integracion-panel-qa.mjs`: enlaza las operaciones al estado y sesión del mismo panel Uki y también el camino de pedido por carta con **reserva + PATCH atómico**. La solicitud de carta NO usa la escritura simple de caja. El controlador exige primero lectura real del turno. Para pagos/operaciones se reutilizan `moverCajaRomoCandidatoQA` y `prepararCobroPendienteRomoQA` de los módulos Romo ya existentes.
- `lib/romo-panel-unico-sesion-qa.mjs`: calcula una huella de los campos financieros del estado confirmado y no permite arrastrar pedidos o caja sin guardar. Para una solicitud aceptada de carta, relee la nueva revisión y el **ciphertext exacto** de Neon, y recién entonces avanza la sesión. Si hay diferencias bloquea nuevas operaciones.
- `firebase/uki-sushi-local.html`: callback de aplicación a pantalla únicamente con revisión Neon confirmada; separa `window.ukiRomoRevisionVistaPanelUnicoQA` de la revisión interna de CAS. Limpia el formulario de pedido solamente después del guardado confirmado. El Uki oficial (`main`) no se modifica. En la vista QA de solo consulta los módulos de escritura siguen ausentes.
- `tests/panel-unico-transacciones-qa.test.mjs`: pruebas unitarias sin compras ni escrituras reales, incorporadas a `npm run test:release`. Se realizaron también verificaciones aisladas con mocks de bloqueo, concurrencia, duplicados, reconciliación de snapshot y folio manual.

**Estado de Neon, verificado únicamente por SELECT el 17-11-2026:** estado cifrado Romo `revision=2`, una fila; `romo_carta_ediciones_v1` **sin fila/revisión 0**; dos solicitudes de carta `pendiente`. Esto significa que **todavía no está habilitada la recepción comercial de carta**, aun si el código de aceptación existe. No se crearon pedidos, abrieron cajas, aceptaron solicitudes ni modificaron cuentas con esta revisión.

**Impedimentos reales que faltan**: confirmar la página Preview operativa del panel conjunto (la página pública `panel-unico-consulta-qa.html` sigue siendo únicamente lectura); verificar por Safari y Google el cifrado, caja, folios, cobros y timbres en un entorno seguro antes de habilitar las banderas; completar los flujos de mesa/QR, cierres e inventario por local, y confirmar que el origen final del panel conjunto permita POST Romo solamente con autorización y aislamiento. La autorización temporal entre proyectos **sigue siendo SOLO GET** y no se debe abrir POST por CORS sin la revisión del diseño final. No realizar merge a `main` ni publicar Production sin pruebas manuales.
