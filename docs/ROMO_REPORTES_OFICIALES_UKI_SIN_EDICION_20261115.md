# Romo · recuperación de la pantalla oficial de reportes Uki

Fecha: 15-11-2026. Cambio exclusivamente en la rama Preview Romo.

## Comparación con la fuente oficial
La función `vReportes()` está **textualmente idéntica** en `firebase/uki-sushi-local.html` de `main` (Uki oficial) y en el panel replicado `public/romo-panel-qa/index.html`. Incluye consulta por **día, semana y mes**, medios de pago, propinas, ventas por día y detalle de cierres.

Romo la había sustituido en Caja por una pantalla reducida de resumen semanal. Ahora la pestaña `Caja > Reportes` vuelve a llamar directamente la misma función **oficial de Uki**, sin añadir funciones nuevas y sin modificar el cálculo para Uki. Se mantienen los botones de exportación semanal CSV/PDF Romo ya existentes.

## Seguridad de Romo
Los controles `ukiVRectificarCierre()` y `ukiAccionesHistorial()` del informe heredado pueden depender del almacenamiento Uki y no están confirmados como escritura CAS Neon en Romo. Para **Romo solamente**, en este informe se sustituyen por un aviso informativo hasta homologar sus operaciones. Los informes y los ajustes históricos quedan visibles en modo consulta. Las funciones de las dos sucursales Uki siguen idénticas.

No se crean pedidos ni movimientos, no se habilitan funciones nuevas, no se despliega producción. Los resultados operativos requieren recorrido manual en iPhone y cierre real validado.
