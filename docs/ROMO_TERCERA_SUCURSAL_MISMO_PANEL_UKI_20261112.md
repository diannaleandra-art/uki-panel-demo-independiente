# Romo La Serena como tercera sucursal del panel ÚNICO Uki — 12 nov 2026

## Decisión de producto
La propietaria corrigió la vista inicial de Romo: NO desea una pantalla nueva o simplificada. Romo debe usar el mismo panel de Uki, con las mismas funciones y el mismo menú, pero marca/colores propios y almacenamiento comercial independiente. Las otras sucursales de Uki no deben cambiar.

### Sucursales del selector único
- Uki Regimiento Arica — existente, intacta.
- Uki La Serena — existente, intacta.
- Romo’s Sushi La Serena — Balmaceda 1612, tercera sucursal.
- NO existe Romo Regimiento Arica aprobada.

### Lo implementado en GitHub QA (NO producción)
Rama: qa/romo-carta-vista-selector-20261112
1. El menú principal de Romo reutiliza el mismo arreglo VISTAS que Uki (Inicio, Pedidos, Nuevo, Timbres, Caja) y las mismas clases visuales. No se creó otro panel.
2. La opción Inventario de Romo reutiliza la **misma función de plantilla** window.ukiInventarioPanelHTML() del panel Uki, con las cuatro áreas exactas de administración: Carta y precios, Disponible / Agotado, Inventario, Revisiones y compras. No existe otro editor nuevo.
3. Los textos visibles se adaptan a Romo La Serena y se ocultan las opciones de pizza. Se aplica paleta blanca/negra/roja **únicamente** cuando el selector abre Romo, sin cambiar la UI de Uki.
4. Toda operación de Romo queda BLOQUEADA en QA. El menú de funciones permite navegar en vista previa, pero Guardar, Actualizar, Crear, subida de fotos y formularios están desactivados. No se llama a window.ukiInventarioMontar() porque el editor Uki activo aún utiliza sus endpoints Neon de Uki, y podría desviar la escritura a Arica.
5. El inventario/ventas/pedidos/timbres/caja/cierres siguen sin conexión real de Romo, se muestran como pendientes. No se inventan cifras ni productos ni se importan los datos de Uki.
6. Se conserva la entrada con la contraseña habitual de Uki. El permiso del catálogo Romo con sesión Google/rol Neon deberá verificarse en servidor antes de habilitar cualquier acción.
7. La carta pública de Romo tiene QR propio y mismo armado que Uki (sin pizzas), pero aún falta conectar sus datos comerciales autorizados.

### Pruebas verificadas
- Ejecución: https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/43283355611
- 27 de 27 pruebas de integración, ingreso y regresión aprobadas.
- Simulación de navegador Chromium tamaño iPhone 390 x 844 aprobada, sin desbordamiento horizontal; comprueba mismo menú y 4 tabs, acciones de Romo bloqueadas, no pizzas, vuelta al selector de Uki.
- Captura en GitHub Actions, artefacto romo-panel-carta-iphone-qa, ejecución 43283355611.
- No es prueba física Safari; no es el despliegue del panel operativo.

### Pendiente técnico imprescindible antes de activar ventas
- Conectar la plantilla compartida de Uki a adaptadores por **storeId**: uki:arica, uki:serena, romo:serena. NO usar la rama fallback de Arica para Romo. Autorización verificada en backend.
- Ligar catálogo Romo existente en Neon, productos, promociones, descuentos, fotos e ingredientes; conservar estructura de armado y precios propios.
- Conectar pedidos/carta/WhatsApp, cobros mixtos, delivery, timbres, caja, inventario, cierres y panel de dueños con datos de Romo separados de Uki.
- Probar entre dos iPhone y completar pruebas de aislamiento y regresión. Solicitar autorización expresa antes de migrar/otorgar permisos de bases, publicar o abrir operaciones.
- Exportes Excel/PDF/WhatsApp de reportes al final según instrucción de la propietaria.

### Estado de despliegue
Vercel genera previews automáticamente de esta rama en el proyecto de inventario, cuyo URL NO sirve el HTML del panel único (404 en la ruta del HTML). El trabajo actual está en la rama GitHub QA y NO se publicó como nuevo panel ni se cambió producción.

## Confirmación de arquitectura — agregamos UN local, no otro panel
- Se incorporó **un registro único `LOCALES_PANEL_QA`** en el mismo código del panel de Uki.
- Identificadores fijos: `uki:arica`, `uki:serena`, `romo:serena`; no existe `romo:arica`.
- El selector visible se deriva de ese registro y conserva las dos sucursales históricas de Uki con sus claves y rutas.
- Romo se registra con estado `preparacion`, su nombre y su dirección Balmaceda 1612. En QA no se habilita escritura, caja, pedidos ni inventario.
- La comprobación de `storeId` rechaza operar Romo usando el estado `S.suc` históricamente reservado para Uki. El acceso de prueba a Romo se maneja por su selector y contraseña habitual.
- El menú y la plantilla administrativa permanecen compartidos. No se creó otro repositorio, panel, contraseña ni base de datos en este paso.
- Siguiente bloque: adaptador de almacenamiento por local con autorización de backend antes de activar operaciones reales. No publicar sin autorización.


## Continuación — conexiones de datos por sucursal en QA (12-11-2026)
Sin crear otro panel ni introducir cuentas comerciales:
- Se agregó lib/uki-local-router-qa.mjs: enrutador basado en los tres storeId; no redirige nunca Romo a Arica o Uki Serena. El modo real permanece desactivado. Pruebas con memoria ficticia y dos teléfonos garantizan aislamiento.
- Se agregó lib/romo-almacenamiento-operativo-panel-qa.mjs: adaptador privado del estado cifrado ya existente en lib/romo-estado-operativo-qa.mjs. Mantiene misma estructura de Uki para pedidos, caja y timbres, y revisión optimista, pero solo sobre public.romo_estado_operativo_v1 en base Romo inyectada en backend.
- Se incorporaron los módulos originales aprobados de edición de catálogo de Romo al MISMO repositorio: lib/romo-categorias-descuentos-qa.mjs, lib/romo-editor-carta-compatibilidad-qa.mjs, lib/romo-editor-carta-repositorio-qa.mjs y lib/romo-panel-carta-interfaz-qa.mjs.
- Se agregó lib/romo-almacenamiento-catalogo-panel-qa.mjs, adaptador para el catálogo Romo con las categorías, promociones, descuentos, protección de versiones y permisos sin usar los endpoints de Uki. No se tocó el editor productivo Uki.
- Pruebas nuevas en tests/uki-local-router-qa.test.mjs, tests/romo-almacenamiento-operativo-panel-qa.test.mjs y tests/romo-almacenamiento-catalogo-panel-qa.test.mjs.
- Batería de regresión de integración: 45 pruebas aprobadas, 0 fallidas (ejecución 43289450472):
  https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/43289450472
- Todos los ensayos de base usan inyección de DB ficticia; no se insertó catálogo, pedido ni venta en Neon real.

### Estado NO habilitado
- Aunque el backend y el enrutador ya pueden hablar entre sí en las pruebas, la conexión de negocio NO está habilitada en el panel usado por el personal.
- Permanecen apagados los botones de guardar/cobrar y los endpoints reales de Romo, por seguridad. El catálogo real Romo no ha sido cargado ni mostrado.
- Requiere validar cuenta Google y permisos Neon romos_app_service / usuarios de cada sucursal antes de activar. No tocar credenciales o roles sin aprobación.
- El inventario propio de Romo y la conexión de fotos/QR, delivery, caja real, timbres y reportes del panel único siguen pendientes de pruebas específicas.
- Exportación PDF, Excel y WhatsApp de reportes: al final.

Se conserva la decisión: un panel Uki, tres locales. Romo La Serena usa la misma interfaz, con solo colores y datos independientes.

## Corrección de integración — motor real de Uki (sin pantallas simuladas)
- Se eliminó `vRomoQA()`, que solo representaba pantallas. Tras el ingreso, Romo selecciona `S.suc = 'Romo’s Sushi La Serena'` y reutiliza el motor original `S.vista`, `VISTAS`, `ir()`, `vInicio`, `vPedidos`, `vNuevo`, `vClientes` (timbres) y `vCaja`.
- Se creó la ruta de almacenamiento LOCAL exclusiva `romo-serena` sin cambiar las de Uki, pero **no se autoriza su guardado operativo** ni se habilita Neon Romo. No usarla como reemplazo del respaldo real.
- El inventario/administración conserva la misma plantilla; no se monta la API del inventario Uki, porque su fallback a Arica provocaría cruces.
- El control de bloqueo se mantiene incluso si la prueba se ejecuta en dominio productivo; la navegación superior permite revisar las vistas reales sin hacer operaciones.
- Los cambios de caja, pedidos, timbres, cierres y ventas siguen bloqueados para Romo hasta completar autenticación, sincronización de Neon propia, manejo de conflictos y la carta pública ya aprobada.
- No se publica este código en el panel operativo ni se modifica ningún dato de las dos sucursales Uki.

## Inventario Romo enlazado al selector único (fase de integración QA)
- Se reutilizan los módulos de inventario Romo ya creados en la rama `qa/romo-catalogo-inventario-sin-publicar-20261111`; no se crea una segunda pantalla ni otro PIN.
- `lib/romo-almacenamiento-inventario-panel-qa.mjs` conecta lectura, agregar, editar, conteos, disponibilidad, reposición y retiro al router de tres sucursales, con `storeId: romo:serena` obligatorio y control de revisiones para dos teléfonos.
- Unidades compatibles con el inventario actual de Uki (`un`, `porciones`, `kg`, `g`, `l`, `ml`) y unidad de la preparación anterior (`unidad`). El reporte no considera la diferencia como venta.
- Se corrigió el fallback del inventario histórico de Uki: si no está seleccionada exactamente una sucursal Uki, su gestor ya no interpreta Romo como Arica ni inicia consultas. Las dos sucursales Uki mantienen rutas y datos anteriores.
- Esta es una conexión interna en la rama de pruebas. **No** está enlazada a los botones reales hasta validar cuenta Google, permisos, datos y sincronización Neon de Romo. No se modificaron existencias de ninguna sucursal ni se publicaron nuevos paneles.

## Tres áreas Romo desde el mismo motor de Uki
- **No se creó otra pantalla ni otra contraseña.** `lib/romo-almacenamiento-unico-panel-qa.mjs` reúne los adaptadores ya construidos de estado operativo (pedidos, caja, timbres, cierres), carta completa (productos, ingredientes, promociones y categorías) e inventario exclusivo de Romo.
- El router del panel rechaza cualquier servicio no contemplado en Romo, no usa los locales Uki como respaldo y aplica roles en cada área.
- La conexión está validada únicamente con base simulada: todavía NO hay permisos de dueña en Neon, ni catálogo Romo cargado, ni URL de operación activa. NO publicar ni habilitar ventas sin los siguientes pasos completos.

## Enlace interno de las tres áreas · preparación adicional (12 nov 2026)
- El catálogo de Romo se cargó **una sola vez** en su base Neon como borrador oculto: 7 productos, 3 promociones, 40 ingredientes y 2 categorías. No se modificaron precios; +$500 ya estaba incluido. Las ventas y cartas públicas siguen cerradas.
- La API operativa existente `api/romo-estado-operativo-qa.js` agrega rutas por `?area=catalog` y `?area=inventory`, sin una función Vercel adicional; utilizan la misma sesión Google verificada, UID/rol privado y `romos_sushi`, nunca la base de Uki.
- Los accesos a esas áreas requieren **dos banderas nuevas** apagadas por defecto: `ROMO_PANEL_AREAS_LIVE_ENABLED` y `ROMO_PANEL_AREAS_WRITE_LIVE_ENABLED`. También permanece obligatoria `ROMO_OPERATIVO_LIVE_ENABLED` y configuración independiente. Ninguna se habilita ni modifica en esta etapa.
- Pruebas QA ejercitan lectura, cambio de precio oculto, conflictos de revisiones, inventario separado y rechazo de identidad ajena. Todo con DB ficticia, nunca pedidos de clientes.
- Pendientes de activación: permisos mínimos del servicio para `romo_catalogo_v1`, dar de alta a la cuenta Google propietaria con token firmado y activar sincronización del panel y carta después de autorización y prueba real. No publicar ni cobrar desde esta rama.

## Consulta autorizada de dueña y datos Romo · 12 nov 2026
- El UID Google de la dueña ya está registrado como rol activo exclusivamente en romo:serena. No se guardó en el código, solo en Neon; la sesión firmada debe validarse en cada solicitud.
- Una única API Romo separa la lectura de catálogo e inventario de la activación de operaciones. GET protegido por ROMO_PANEL_LECTURA_SOLA_ENABLED y por token Google firmado, email verificado, rol en Neon, origen exacto y DB privada; por defecto sigue deshabilitado.
- Se agrega al mismo editor original un botón SOLO LECTURA por área que muestra datos originales (no simulados) cuando se active la lectura. El botón nunca guarda, cobra, manda timbres ni edita existencias.
- Los dos locales Uki conservan todas sus funciones, rutas, datos y menús. No se publica la rama QA ni se activa ROMO_PANEL_LECTURA_SOLA_ENABLED.
- Pendiente de aprobación: habilitar la lectura segura, observar prueba con Google real y conectar POST ediciones/comercial tras regresiones completas y autorización de la propietaria.

## Mismas claves de Uki en dos teléfonos — enlace criptográfico preparado (12 nov 2026)
- La base Romo ya contiene la tabla exclusiva `romo_clave_compartida_v1` con dos slots permitidos (uki:serena, uki:arica). Sigue vacía hasta que la dueña lo haga desde una sesión autorizada.
- Se prepara `api/romo-claves-alta-qa.js`, propietario Google verificado + rol dueños en Neon, origen exacto, y un verificador AES-GCM de la clave que previamente desbloqueó un Uki. Nunca acepta contraseña en texto claro, otro rol, otro local, ni sustitución automática de verificadores.
- Se agrega cliente de enrolamiento `firebase/uki-romo-alta-clave-qa.mjs` APAGADO hasta activación expresamente autorizada; no se incorpora otra pantalla ni se pide clave nueva.
- No se ejecuta GRANT INSERT en Neon, ni se configura `ROMO_ACCESO_CLAVES_ALTA_LIVE_ENABLED` o URL de activación; ninguna clave se transfirió ni se guardaron datos de Uki.
- Regresión con DB ficticia: propietario sí, empleado no, duplicados rechazados, cifrado probado, y cero llamadas de red cuando el flujo está apagado.

## Fuente única de precios para carta pública Romo — API preparada
- `api/romo-carta-publica-qa.js`: endpoint GET/OPTIONS de solo lectura con origen exacto, host DB exclusivo de Romo y flag `ROMO_CARTA_PUBLICA_LIVE_ENABLED` apagado por defecto. No concede acceso a pedidos ni aceptará POST.
- Fuente real: `public.romo_catalogo_v1` mediante `leerCartaPublicaRomoQA`, que devuelve exclusivamente productos, ingredientes y promociones visibles y su descuento calculado, sin cuentas, ventas, inventario ni borradores.
- Si los productos de Romo continúan ocultos en el panel, esta respuesta será una lista vacía. No se deben publicar las fichas ocultas ni sustituirlas por precios inventados.
- Falta conectar la carta `uki-sushi-respaldo/public/romo` al endpoint y adaptar SKU `romo:piezas:24` / `romo:promocion-...` al motor original sin cambiar sus funciones. NO se activaron enlaces de pedidos.
- Ningún cambio de producción, permisos SQL ni variables Vercel en este bloque; QA exclusivamente.

## Solicitudes de carta a bandeja Romo, sin registrar ventas — QA 12 nov
Se prepara la bandeja independiente `public.romo_solicitudes_carta_v1` en SQL **no ejecutado**. El esquema conserva la semántica del endpoint Uki: al pulsar WhatsApp se crea una solicitud `pendiente`, no se confirma que el mensaje haya sido enviado y no se suma a caja, timbres ni cierres. Clave idempotente impide duplicaciones; otro pedido con clave repetida recibe conflicto; se limita volumen por IP con hash salado. `api/romo-solicitudes-carta-qa.js` permanece inactivo sin `ROMO_CARTA_SOLICITUDES_LIVE_ENABLED` y sin permisos SQL, valida origen de carta/Google del panel por separado y no contempla PATCH ni aceptación automática. Faltan: enlace a carta y bandeja real del panel, migración/privilegios mínimos, pruebas con dos equipos, aceptación luego de guardar el pedido cifrado, auditoría de timbres, y autorización final de publicación.

## Bandeja en pantalla Pedidos del panel único — QA sin habilitar
El panel `firebase/uki-sushi-local.html` monta un lector `firebase/uki-romo-solicitudes-panel-qa.mjs` SOLAMENTE cuando está seleccionada Romo y vista Pedidos. Usará la misma sesión Google para leer los tickets de Romo vía API privada, con validación del storeId y presentación por textContent (sin inyección HTML). El botón de lectura permanece desactivado hasta completar migración y publicación; no hay aceptación/rechazo, timbres o caja en este bloque. Las sucursales Uki no cambian.

## Cierre de reintentos de pedidos (QA)
Se corrigió el contrato de idempotencia: la clave de solicitud no puede reutilizarse con diferente código, mensaje, nombre, WhatsApp o monto. Cada reintento idéntico retorna el mismo ticket. Esta verificación ocurre exclusivamente en Romo, sin caja ni timbre.

## Rechazo con motivo y usuario verificado (QA temporal)
Se agregó un flujo de rechazo a la misma bandeja de Romo, sin duplicar pedidos ni caja. Su API PATCH acepta exclusivamente estado `rechazada`, motivo obligatorio y UUID; la sesión Google firmada + rol activo deben autorizar `orders.reject`. La mutación atómica en Neon solo cambia una solicitud todavía `pendiente`; si otro dispositivo ya la procesó, devuelve conflicto y nunca sobrescribe. Se agrega la columna `actualizado_por` para auditoría de quién rechazó. La bandera independiente `ROMO_CARTA_SOLICITUDES_EDIT_LIVE_ENABLED` sigue apagada. La aceptación permanece cerrada hasta confirmar realmente un pedido interno guardado.

## Descubrimiento de seguridad en la migración temporal (12 noviembre 2026)
**Permisos de Neon:** al crear una tabla nueva en la rama de pruebas, el rol `romos_app_service` hereda automáticamente permisos SELECT, INSERT y UPDATE por defecto de su propietario. Se verificó directamente con `pg_class.relacl` y `has_table_privilege`. La migración SQL ahora termina obligatoriamente con `REVOKE ALL PRIVILEGES ON TABLE public.romo_solicitudes_carta_v1 FROM romos_app_service, PUBLIC` antes de cualquier activación. Se ejecutó ese REVOKE solo en la rama Neon temporal y la comprobación dio SELECT=false, INSERT=false, UPDATE=false. Antes de operar pedidos reales debe haber una nueva autorización para conceder los privilegios mínimos, después de verificar roles y reglas de aceptación. La rama `main` de Neon aún no tiene tabla de bandeja.
