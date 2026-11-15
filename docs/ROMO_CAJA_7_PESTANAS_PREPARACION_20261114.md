# Romo La Serena · Caja en las siete secciones oficiales (fase de preparación)

Rama: `preparacion/uki-romo-sobre-main-20261114`, sin publicación.

Se reutilizó el mismo `CAJA_TABS` de Uki: Resumen, Movimientos, Precierre trabajador, Cierre definitivo, Historial, Reportes y Caja acumulada en efectivo. No se crearon otra caja ni otros datos.

- **Resumen y Movimientos:** se separó la vista existente de Romo; los formularios y procedimientos cifrados/CAS ya preparados se conservan sin reimplementarlos.
- **Precierre:** conecta el formulario existente si hay un turno abierto y base confirmada. No se concede autorización financiera al PIN de inventario.
- **Cierre:** mantiene la apertura/cierre y constancia de Neon Romo ya existentes, con sus controles. Hasta prueba manual no se declara homologado.
- **Historial:** consulta exclusivamente `S.cierres` de Romo, muestra medios, efectivo, gastos y reparto sin editar ni inventar cierres.
- **Reportes:** utiliza la función oficial de resumen semanal sobre los cierres definitivos de Romo exclusivamente, no incluye solicitudes de carta ni precierres.
- **Acumulada:** muestra estado no conciliado, sin cálculo ficticio ni llamada a la API de Uki. Pendiente servicio exclusivo de Romo y reconciliación.
- Cambiar a Acumulada jamás monta el módulo de acumulada de Uki sobre Romo; cambiar pestaña durante una operación de caja queda bloqueado.

**Falta antes de publicar:** verificar manualmente operaciones de caja, turnos y cierre; reconciliar diferencias entre totales del panel y constancias de cierre, homologar exportaciones, acceso trabajador de precierre, acumulada real y conexión a Mi Administración. Sin pruebas automáticas ni movimientos comerciales simulados. La rama principal y las dos sucursales Uki no se modifican.
