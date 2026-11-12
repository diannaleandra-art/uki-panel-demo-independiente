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
