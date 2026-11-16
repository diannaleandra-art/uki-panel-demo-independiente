# Romo — bloque de trabajo consolidado (16-11-2026)

## Aprobaciones y reglas invariables
- OBJETIVO: réplica fiel Uki oficial v8.16 en Romo La Serena. No nuevas funcionalidades comerciales que Uki no tenga. Conservación de pedidos, cierres, timbres y todo el historial.
- Dueña confirmó que Romo todavía NO recibe clientes, y que autoriza pruebas manuales con operaciones reales de Romo. Los registros de prueba reales permanecen en Neon y requieren cancelación/conciliación auditada; no se borran, ni se ponen como ventas automáticas.
- Tras múltiples publicaciones de pequeños cambios, el próximo despliegue se hará **solo con un bloque consolidado y verificado**, no por error aislado. No desplegar ni promover esta rama mientras se consolida.
- Uki oficial main y sus dos sucursales deben permanecer intocados. Jamás promover esta rama directamente en el proyecto Vercel que publica Uki.
- Romo tiene preview conectado a Neon romos_sushi. El despliegue DEFINITIVO necesitará un proyecto Vercel exclusivo de Romo, con configuración propia y autorización de dominio Firebase; las variables Romo verificadas hoy están ligadas exclusivamente a Preview y a su rama, NO a la futura producción.
- Carta pública Romo está en otro proyecto y usa Supabase romos_products, mientras la consulta del panel usa catálogo Neon romo_catalogo_v1. No afirmar que ambos están sincronizados hasta confirmar fuente única/endpoints de escritura.

## Bloque 0 (preparación de pruebas seguras)
- Acceso Google y Neon real ya confirmado manualmente en iPhone (revisión 2) el 16-11.
- Existe pedido de PRUEBA, NO PREPARAR de 14-11 pendiente $1.000, retiro, sin pago. El cambio de UI publicado anteriormente permite la CANCELACIÓN manual con motivo y responsable. No se puede registrar el cobro ni marcarlo entregado.
- Existe jornada guardada 2026-11-14 sin turno de caja abierto; no cambiarla de oficio ni abrir una caja antigua.
- Este bloque agrega una **regularización administrativa puntual sin caja** que se habilita solamente tras cancelar todos los pedidos antiguos no cobrados, no tener cobros, precierres, gasto, caja abierta ni solicitudes de carta pendientes (revisión de bandeja del servidor). Guarda registro de actor, motivo, fecha anterior y nueva con CAS, sin generar cierre ficticio. Además bloquea abrir turnos con 2+ días de atraso. No ha sido validado manualmente ni publicado.

## Matriz de paridad actualizada por áreas
1. **Acceso y datos:** ingreso Romo confirmado, Neon aislado; falta verificar permisos de agendador y trabajadores y preparar producción independiente.
2. **Pedidos manuales y desde carta:** solicitudes, aceptación, rechazo y control de duplicados implementados parcialmente; quedan variantes oficial Uki, mesas, entrega y QR, edición y cancelación a verificar.
3. **Cobros y caja:** cobro mixto, tarifa y medios de cobro con CAS preparados; validar reparto por sucursal, propinas, 7 pestañas y 7 tipos de movimientos, arqueo, cierres reales.
4. **Turnos:** inicio desde Inicio, precierre guardado Neon y dos turnos preparados; falta acceso empleado equivalente al de Uki sin compartir permisos de dueños.
5. **Historial y reportes:** filtros, PDF/CSV, WhatsApp y aclaraciones no monetarias preparados; rectificación financiera tras cierre, pedidos olvidados, conciliación reportes pendiente.
6. **Clientes/timbres:** búsqueda y WhatsApp propios Romo preparados; verificar ficha completa, acumulación, canje, reglas por compra y desbloqueo de dueños.
7. **Inventario:** Romo aislado y PIN inventario propio; validar entradas/salidas, mínimos, faltantes, exportaciones y formulario trabajador frente a Uki.
8. **Carta digital:** dos fuentes de datos y escritura de categorías, productos, precios/descuentos, ingredientes, fotos y disponibilidades NO equivalentes aún; priorizar fuente única.
9. **Mi Administración:** visualización y conciliación previa solo lectura, pero sin importación contable ni facturas/gastos/utilidades consolidados; registrar cierres definitivos por llave única antes de sumar, sin duplicar ventas manuales.
10. **Diseño Romo:** negro, rojo y blanco, sin naranja; revisión final de tamaños y navegación iPhone únicamente después de paridad funcional.

## Estrategia de trabajo — sin publicaciones intermedias
- Primero preparar los módulos faltantes de pedidos, caja, trabajadores, carta y reportes en GitHub en varios commits sin despliegue.
- Verificar comparativamente por lectura de código y controles de entorno, sin fabricar transacciones ni modificar datos financieros.
- Preparar un solo proyecto Vercel de Romo, no confundir con Uki; configurar variables de producción de Romo de forma segura y dominio autorizado Google. Confirmar que el catálogo de clientes sigue aislado.
- Publicar un único lote importante y realizar una serie de pruebas REALES y MANUALES en Romo sin público: cancelación de prueba antigua, revisión de jornada, apertura con efectivo real, recepción de un pedido de carta, timbre WhatsApp, cobro real, entrega, precierre, cierre y descargas. No registrar un pedido, cobro o cierre ficticio automáticamente. Limpiar pendientes únicamente por procesos auditados; las ventas confirmadas permanecerán en la contabilidad.
- Exigir aprobación de la dueña para habilitar cobros/carta a clientes y activar transferencia contable. Hasta entonces avisos «piloto interno» y «sin clientes».

## Bloqueadores a resolver antes del primer cierre real
- Fecha operativa 14-11; falta cancelar pedido de prueba y avanzar fecha con constancia.
- La tasa de entrega del catálogo y las dos fuentes Supabase/Neon están separadas; validar fuente pública.
- Persistencia y permisos de la caja para trabajador, avance/cierre y pagos de reparto.
- Crear enlace de producción ROMO independiente, sin reemplazar Uki, con todos los secrets y banderas apropiados y protección de acceso.
- Prueba MANUAL de una operación comercial real completa, con registro único de cierre y posible importación financiera solo cuando esté conciliada.

Estado: **auditoría y código en preparación, SIN despliegue de este bloque**.

## Continuación del control de Caja y fecha operativa — 16-11-2026

Revisión de código real contra los procedimientos ya preparados, solo en rama `preparacion/uki-romo-sobre-main-20261114`, sin despliegue y sin afectar main Uki.

- Corregida la ruta activa `ukiRomoGuardarMovimientoQA` en `public/romo-panel-qa/index.html`: los movimientos que no son configuración inicial de base requieren `turnoAbierto===true` además de `baseConfirmada===true`. No permitir guardar gastos, retiros, delivery manual o pago a repartidor sin jornada abierta. La base anterior no se puede ajustar después de un cierre definitivo sin abrir el siguiente turno. Commit `6c8f16f324565149be0a35dd54b79e8b6e28519e`.
- Gastos, retiros y entregas manuales nuevos conservan explícitamente `fechaOperativa` del turno para que no migren al día siguiente por el ISO UTC.
- `public/romo-panel-qa/uki-romo-caja-consulta-qa.mjs`: la consulta de caja prioriza fecha operativa, luego `turnoClave` del pedido y, como respaldo, fecha/hora en `America/Santiago`; las propinas vinculadas siguen la jornada del pedido. No reescribe movimientos ni cambia ventas históricas. Commit `d8b7997e1cf212f4e55bd4ebfd1e1192410405d2`.
- Seguimos **sin pruebas manuales** de cobro, apertura, precierre, cierre ni gastos de un turno real. Las correcciones son de código; no equivalen a certificación funcional. Todo debe comprobarse en la revisión presencial de Romo antes de publicar el conjunto.
- Las migraciones de rectificación ya se verificaron en la rama aislada Neon `br-gentle-wave-be71bcpa`; siguen sin instalarse en la base principal ni activar banderas comerciales. No contar esos recibos como operaciones reales.
