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
