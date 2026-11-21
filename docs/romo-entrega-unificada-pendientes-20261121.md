# Romo Sushi — entrega unificada pendiente

## Base oficial que debe conservarse
- Panel Romo: commit 646dcf1d2301414206225bf71f4ee2a09340cfb8; despliegue dpl_5mF4bCax3JgunTraRzXuypXmkoL4 (incluye nueva autorización de caja acumulada).
- Carta Romo: commit 36f5bb8907da7b653fe0a73291e8b69ce606cd08; despliegue dpl_FLzK15e5hpMDqPHyTL9nUQ1bRHnA.
- Mi Administración: commit 060355c5af5270a10cd0ea5edf34ee6bcd5089f8; despliegue dpl_JDGSg9JCxrxy2QwG5GP3YqfDypbs.
- Uki oficial: referencia funcional, no fuente de datos comerciales de Romo.

No hay autorización para sobrescribir históricos, inicializar saldos ficticios, recrear productos ni mezclar identidades de locales. Una sola entrega coordinada de los proyectos que realmente cambien; no publicar módulos por separado.

## A. Pendientes detectados en código y configuración
- [ ] Historial/rectificación monetaria y pedido olvidado: confirmar compuertas de producción; las tablas de versiones aún no estaban instaladas en la última inspección de Neon Romo. Revisar migraciones, permisos y conservación de constancias originales antes de habilitar escrituras. Verificar que los ajustes de caja no se dupliquen en el informe de ventas.
- [ ] Mi Administración: un fallo de la consulta adicional de conciliación Romo no debe impedir cargar el resumen original Uki. Proteger las consultas concurrentes cuando cambie la fecha/sucursal. Conciliar negocio, gastos y pagos a repartidores sin duplicación; comprobar informes y exportaciones con cierres de Romo.
- [ ] Actualizaciones compartidas: el mecanismo selectivo existente cubre dos módulos puros. Falta equivalente para las demás funciones que requieran adaptadores; mantener aislados credenciales, datos, marca y catálogo. No confundir sincronización preparada con publicación automática completa.
- [ ] Carta: confirmar que las promociones comerciales publicadas aparezcan con sus fotos y precios en el carrusel, y verificar el nuevo diseño aislado en el teléfono. Revisión de diferencias con Uki en las cuatro áreas comerciales. 

## B. Validaciones manuales agrupadas (no asumir fallo ni éxito sin prueba)
- [x] Crear ingrediente (confirmado por la usuaria).
- [ ] Eliminar ingrediente creado, cambiar recargo/disponibilidad y comprobar reflejo en la carta. Las recetas originales no se eliminan a ciegas.
- [ ] Productos, categorías, promociones: CRUD disponible según tipo, descuentos, foto, medio de pago, publicar/desactivar, categoría y contenido, duplicados (frutilla), recargo y armado vegetariano/sin nori/sin vegetal. Comprobar datos previos y no recrearlos.
- [ ] Banner: título, foto sin deformación, precio, descuento, flechas/deslizar y acceso al armado; negro/rojo/blanco y sin naranja.
- [ ] Pedidos: búsqueda, filtros e historial; timbre obligatorio con WhatsApp antes de cerrar, sin repetir exigencia tras edición; pago completo/mixto, cancelación con motivo, estado entregado/no pagado, modalidad y tránsito entre locales, delivery y repartidores, edición auditada, códigos de cliente.
- [ ] Caja: movimientos por medio (incluidas plataformas y beneficios), propinas, gastos/retiros, deliverys a pagar por repartidor, dos turnos, precierre y cierre definitivo fieles a Uki, fecha/hora, compartir y exportar. Efectivo acumulado: saldo inicial real una sola vez, cierre exacto posterior acreditado una sola vez, historial, conciliación de pendientes.
- [ ] Inventario: acceso trabajador PIN y administración Google, sucursal correcta, crear/editar/eliminar, kilos/gramos/litros, disponibilidad, búsqueda, histórico, PDF/Excel/WhatsApp, facturas y faltantes.
- [ ] Mi Administración: acceso privado, ventas manuales y cierres reales, gastos, proveedores/facturas, utilidades por local y general, propina separada, PDF/Excel/WhatsApp; verificar filtros y consultas históricas.
- [ ] Rectificaciones: motivo, autorización, nueva versión sin destruir cierre original ni duplicar venta/efectivo; consulta histórica y reportes.
- [ ] Carta: retiro/delivery, distancia, recargos, carrito/checkout y pedido recibido con comanda correcta. No introducir pizzas ni repetir pruebas aprobadas salvo regresión necesaria.

## C. Criterio de salida
Comparar contra los commits oficiales vigentes; revisar todos los cambios juntos; compilar candidatos; pruebas manuales agrupadas con la dueña sin inventar ventas ni alterar cierres existentes; publicar solo proyectos modificados con sus dominios vigentes. Confirmar alias y registros de errores; retener las versiones de reversión. Actualizar este documento con el resultado real de cada prueba, sin marcar casos simplemente por compilar.


## Acotación adicional de la dueña — eliminación integral del catálogo
- [ ] Las tres áreas Productos, Ingredientes y Promociones deben ofrecer Editar, Desactivar/Agotado y Eliminar de manera coherente, también para referencias originales. La corrección no se considera terminada solo porque puedan eliminarse borradores.
- [ ] Eliminar una promoción publicada debe retirarla de carta y banner y del listado activo con una sola confirmación visible y verificar ambos resultados. Si falla un paso, informar el estado real, sin repetir automáticamente.
- [ ] En referencias originales, diseñar retiro persistente del catálogo activo con auditoría, preservando las recetas e identificadores históricos y sin volver a publicarlas al recargar el catálogo base. Comprobar dependencias de ingredientes y evitar armados imposibles; no borrar ni alterar pedidos, ventas, cierres, timbres, ni datos Uki.
- [ ] Probar las fichas nuevas y originales en las tres áreas, impedir acciones sin permisos y comprobar carta y banner reales. No eliminar referencias reales como prueba.
- [ ] Mantener en el mismo lote la retención segura de 35 días (timbres 95) y comprobar respaldos permanentes de Mi Administración antes de habilitar cualquier limpieza. No publicar una actualización por cada acotación.

### Avance en rama de integración (sin publicar)
Se implementó el retiro persistente auditado de referencias originales de producto/promoción y de ingredientes, con restauración interna. La gestión filtra fichas retiradas y los datos comerciales las declaran no disponibles. Aún falta distinguir retiro definitivo de agotado en la carta pública, completar la interfaz de restauración, revisar dependencias de recetas y categorías y validar el lote. No ejecutar estas acciones contra datos reales antes de completar las pruebas.
