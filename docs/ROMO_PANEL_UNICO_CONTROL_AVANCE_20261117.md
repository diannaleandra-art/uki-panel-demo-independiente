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
