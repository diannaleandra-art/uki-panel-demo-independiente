# Romo / Uki — equivalencia funcional y brechas pendientes — QA

**Meta:** mismo panel y funciones de Uki; Romo con marca, carta, promociones, caja, inventario y registros propios.

## Confirmado en pruebas
- Acceso Google y estado cifrado Neon de Romo; primer acceso aún requiere confirmación inicial distinta del flujo Uki.
- Turno abierto guardado en snapshot cifrado; pedido de prueba QA-ROMO-001 aceptado como pedido interno #1 por cobrar, Neon revisión 2.
- No se ha demostrado cierre, pago real, integración de finanzas ni un timbre WhatsApp de Romo.

## Diferencias con Uki por resolver
- En Romo, la navegación habilita inicio, pedidos, nuevo, caja e inventario; faltan varias vistas completas de Uki.
- Parte del panel Romo son interfaces QA de consulta y no tienen todavía todas las funciones del panel completo Uki.
- No se han completado pruebas de dos teléfonos reales ni conciliación del panel de dueños.

## Lote automático de correcciones preparadas
- Importar el precio solo de un único producto cuando mensaje, subtotal, delivery y total Neon coinciden exactamente.
- Mantener importación manual en pedidos de múltiples productos, sin inventar promociones ni korokes.
- Permitir corregir precio del producto importado directamente, conservando su nombre y armado.
- Etiquetas de cobro que dicen Uki cambian a Romo solo al entrar a Romo. Uki conserva sus propios textos.
- Ejecutar regresiones en GitHub CI; no activar carta pública ni ordenar otro despliegue hasta agrupar todo.

## Regla de finalización
No llamar a Romo idéntico a Uki hasta verificar navegación, controles, cierres, timbres, inventario, pagos y administración.
La publicación comercial exige nueva autorización.
## Lote QA: cobro de pedido pendiente, sin publicaciones
- Preparado módulo cifrado CAS de cobros pendientes de Romo, con cobro simple y mixto separado entre productos y delivery y confirmación explícita de pago recibido.
- El cobro se refleja en Caja e historial solo tras confirmación de Neon, sin tocar las cajas Uki. Se conservan cliente/timbres existentes y la función de historial auxiliar de pedidos pagados.
- Los pedidos QA-ROMO-001 y cualquier solicitud con código QA-ROMO-* se mantienen BLOQUEADOS para cobros reales, para no convertir pruebas ficticias en ingresos.
- El panel cuenta con formulario plegado de cobro y medios de pago, solo para pedidos reales pendientes; esta preparación no está desplegada.
- No se ha probado una transacción real y no está verificada aún la equivalencia total de Romo con Uki.
