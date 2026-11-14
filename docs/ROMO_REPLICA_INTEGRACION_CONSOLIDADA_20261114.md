# Consolidación de código Romo ⇄ Uki (14 de noviembre de 2026)

Objetivo único: **mismo panel y carta de Uki, tercera sucursal Romo La Serena (Balmaceda 1612)**; misma navegación y comportamiento, pero marca, precios, pedidos, caja, inventario y cierres exclusivos por sucursal. No construir interfaz alterna.

## Trabajo realizado en esta etapa
Se recuperaron **15 módulos funcionales anteriores** de la rama `qa/integracion-panel-unico-romo-serena-20261112` al directorio del panel actual `public/romo-panel-qa/`, sin modificar su código operativo salvo sustituir el antiguo origen remoto de recepción por el endpoint relativo `/api/romo-solicitudes-carta-qa`. Un índice `uki-romo-replica-integrada-qa.mjs` expone las funciones comunes de Uki para su conexión sin crear otro panel.

Módulos recuperados: turnos y cierre definitivo; caja e historial; folios; solicitudes desde carta; pedidos y guardado atómico; cobro mixto; edición, cancelación y entrega; movimientos y caja; timbres; resumen financiero; control unificado. Todas las banderas antiguas permanecen desactivadas. No se montó una pantalla paralela ni se modificó el HTML de Uki o Romo.

## Trabajo todavía indispensable (no sustituible con botones)
- Unificar el adaptador de estado y claves ya aprobado (Google + Neon `romo:serena`, revisión actual 2) con los módulos recuperados. No sobrescribir snapshots ni reinicializar.
- Revisar cada punto de mutación de `firebase/uki-sushi-local.html` para que Romo use CAS cifrado y confirmación de guardado; cualquier operación no enlazada debe quedar bloqueada en la réplica hasta asegurar persistencia.
- En la API de Romo de la carta, habilitar solicitudes solo con permisos y alcance exactos; la versión antigua se mantiene cerrada y su dominio/branch no es válido para el despliegue actual. No aceptar pedidos públicos incompletos.
- En la carta de Romo (proyecto separado) corregir el endpoint de solicitudes, disponibilidad/delivery, Instagram/fotos y QR, manteniendo la estética negra y roja definida.
- Completar timbres y cierre con registro idempotente de dueños; sin doble contabilización en Mi Administración. Inventario con ID SKU propio por sucursal.
- Prueba manual **única integral** en dos dispositivos: abrir carta → enviar pedido → aceptar → timbre → cobrar → entregar → cerrar → verificar historial, stock y Mi Administración.
- Mantener `main` y las dos sucursales Uki de producción inalteradas, sin habilitar ahora ventas al público.

## Estado confirmado
Romo inició con revisión 1 cifrada; el pedido interno #1 PRUEBA – NO PREPARAR se guardó y recuperó en revisión 2. Los importes $18.000/$20.000 en pantalla son valores heredados no validados, nunca deben asumirse base real. La pantalla de Romo ya los identifica como pendientes de confirmación.

No se aplican pruebas automáticas ni nuevos movimientos de prueba en la base. Esta consolidación de fuentes es **código recuperado, no funcionalidades operativas nuevas**, hasta enlazarlo con la persistencia y ejecutar la comprobación integral autorizada.
