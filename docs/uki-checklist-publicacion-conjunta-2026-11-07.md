# Uki Sushi — estado corregido sin repetir trabajo (7 noviembre 2026)

**Regla:** No volver a crear funciones que ya existen, no repetir pruebas aprobadas, no modificar caja, cierres, pagos, QR ni la carta publicada. Este documento distingue IMPLEMENTADO de PUBLICADO y de VALIDADO. Ningún cambio aquí despliega código.

## 1. Ya hechos: NO registrarlos de nuevo como pendientes de desarrollo

- **Recepción de solicitudes desde carta digital en Pedidos → Pendientes**. La bandeja y su API ya existen y se publicaron. Una incidencia de visibilidad/registro está en revisión; corregir esa incidencia no significa rehacer la integración.
- **Pegar WhatsApp y aceptar/revisar/rechazar solicitudes** usando el formulario habitual, conservando medio de pago mixto, cobros entre locales, reparto, propinas y caja. La interfaz de rechazo con MOTIVO ANTES DE RECHAZAR, rechazo condicionado a elección y detalle del motivo quedó en `main` del panel. No crear otro formulario.
- **Inventario del trabajador**: enlace/PIN restringido, conteos/entradas, administración dentro del panel actual e historial. QA ya realizó el 6/11 una revisión de Regimiento Arica por Dayana (Pollo: faltan 3 unidades) y comprobó WhatsApp/historial. No volver a pedir una «primera prueba» de QA. Las revisiones en producción son otra cuestión: no prometer registros reales no comprobados.
- **Separación por sucursal**, administrativo con acceso habitual y acceso del trabajador solo para inventario. No agregar nueva pantalla de login al agendador ni otro sistema.
- **Disponible/Agotado manual en carta/panel** de ambas sucursales, independiente del inventario. Ya se publicó/validó. No rehacer.
- **Caja acumulada en efectivo**, cierres, precierres, pagos mixtos por producto/delivery, cobros externos, gastos, turnos, reportes y timbres: conservar lo aprobado. No confundir mejoras de apariencia con inexistencia de la función.
- **Carta por sucursal, WhatsApp y QR impreso**: operativo y NO sustituir enlaces/QR.
- **Delivery >9 km: pedido completo «Delivery por confirmar»** y **Envoltura mixta**: la dueña confirmó expresamente que ambas funciones YA ESTÁN, terminadas y funcionando. Darlas por COMPLETADAS. NO volver a proponerlas, desarrollarlas, probarlas como pendientes ni tocarlas en la siguiente publicación.
- **Administración de Carta y precios**, archivos y accesos del panel: ya hay código incorporado; la activación de NUEVOS ingredientes del armado es una funcionalidad específica, no rehacer todos los precios.

## 2. Trabajo realmente pendiente de cerrar

1. **Protección anti-duplicados simultáneos ENTRE DOS DISPOSITIVOS**, no solo comprobaciones en memoria. El desarrollo parcial de la rama `feature/uki-evitar-duplicados-carta-manual-2026-11-07` detecta duplicados por folio/local, pero faltan transacción central, recuperabilidad ante fallos y pruebas de carrera. Corregir false positives de folios cortos reutilizados. Documento `docs/uki-auditoria-duplicados-2026-11-07.md`.
2. **Incidencia concreta de carta → panel**: hubo solicitudes en la bandeja (p. ej., #735 y #477 pendientes en Regimiento Arica; #524 y #247 rechazadas según último examen), pero la usuaria no visualizó un pedido. Diagnosticar sincronización, filtros y dispositivo, sin volver a crear recepción.
3. **Editor de ingredientes del armado**: preparado en panel/API/carta con recargos y sucursales; falta activar/publicar paquete compatible (no programar desde cero). Ramas `feature/uki-ingredientes-armado-integracion-completa-2026-11-07` y `feature/uki-ingredientes-armado-carta-2026-11-07`.
4. **Mejora visual**: distinguir Inventario actual, Revisiones de trabajadores e Historial. Presentación preparada en pruebas; su puesta al día es de UX, no de funcionalidad central.
5. **Consolidación sin perder cambios**: comprobar qué commits y funciones ya están en la versión pública, integrar las ramas que divergen de `main`, validar solo los NUEVOS cambios y publicar UNA versión compatible cuando la usuaria lo autorice. No repetir pruebas ya superadas.
6. **Pruebas puntuales pendientes solo si corresponden**: navegabilidad final de nuevas pantallas de ingredientes en iPhone y validación de recargos por sucursal; funcionamiento de anti-duplicados simultáneos y recuperación ante fallos. No volver a hacer la QA de inventario ya aprobada.

## 3. Diferencia crucial de estados

- **Hecho**: código/función desarrollada, aunque no esté publicada.
- **Publicado**: versión servida en la URL actual.
- **Probado**: escenario concreto validado; una prueba de QA no acredita un movimiento en producción.
- **Pendiente**: mejora que no está implementada o activada, o un error actual localizado.

Vercel impidió un despliegue anterior con HTTP 402 por límite diario; esto es un evento histórico, **NO afirmar que sigue bloqueado sin comprobación nueva**. No contratar servicios ni subir de plan.

**Instrucciones finales:** preservar panel del agendador, inventario restringido del trabajador, dos sucursales, WhatsApp, caja/ventas y QR. Priorizar la protección anti-duplicados y la incidencia de visibilidad. No fusionar ramas ni publicar por escribir este documento.

## Revisión de publicación y límite (7 noviembre 2026)

- **Panel vigente GitHub Pages:** la rama `main` (commit `01aada25eceac20301c1a8f5c0c33a9756c4ed95`) tiene `pages build and deployment` **aprobado** y comprobación HTTP conjunta **aprobada**. La mejora de motivo antes de rechazar ya forma parte del `main` publicado; **NO publicar de nuevo por separado**.
- **Editor de ingredientes:** GitHub Actions QA aprobó en rama `feature/uki-ingredientes-armado-integracion-completa-2026-11-07` (commit `65a6dfcbf56147c36b41c6233869ec646c6adc21`), pero la rama diverge de `main` y no incluye todas las funciones posteriores. **NO desplegar a producción sin integración**.
- **Intento de versión de pruebas Vercel:** solicitud explícita de despliegue `staging` a proyecto `uki-sushi-panel`, equipo `diannaleandra-7046`, desde la rama de ingredientes. **Rechazada por Vercel HTTP 402** con `api-deployments-free-per-day`, límite diario alcanzado y indicación de reintento después de 1 día. **No se creó un despliegue**. No modificar plan ni contratar.
- **Otros componentes en prueba:** prevención de duplicados entre dispositivos todavía no integrada completamente con Firebase, reservas inciertas y conciliación; no afirmar lista para producción.
- **Publicaciones nuevas en este intento: ninguna.** Se conservan caja, cierres, timbres, QR y carta pública sin cambios. Comprobar cuota y compatibilidad antes del próximo intento; no gastar despliegues por cada ajuste.
