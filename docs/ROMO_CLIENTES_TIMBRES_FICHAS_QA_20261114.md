# Recuperación de Clientes y Timbres de Romo sobre el mismo panel Uki

**Estado:** rama de preparación \`preparacion/uki-romo-sobre-main-20261114\`. No publicada ni validada manualmente.

- Se recupera la ficha de cliente utilizando funciones oficiales ya presentes: \`ukiTarjetasAgrupadas\`, \`ventasValidas\` y \`fichaHistorial\`. No se crea otra base de clientes.
- Se muestra búsqueda por nombre, WhatsApp y código; tarjeta de hasta 10 timbres; fechas, compras e historial de la sucursal.
- La edición de nombre, teléfono y código usa los criterios del editor oficial y exige confirmación de la revisión cifrada en Neon Romo, sin tocar pedidos, movimientos ni timbres.
- Los premios ganados se muestran como información pero **no se habilita el canje** hasta enlazar su procedimiento seguro.
- El listado existente de timbres por pedido y apertura/confirmación de WhatsApp se conserva. Abrir WhatsApp no declara un envío realizado.
- Se impide navegar o abandonar la sesión mientras se confirma la edición de un cliente o un timbre.

**Pendientes:** probar manualmente en Safari, conciliar teléfonos y tarjetas antiguas reales, homologar canjes y los flujos completos de pedidos/mesas; no permitir una modificación sin guardado CAS. No se publican rutas ni se ejecutan transacciones de prueba. Uki Regimiento, Uki La Serena y el sitio público Romo permanecen intactos.
