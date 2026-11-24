# Finalización bancaria atómica · estado de integración 24/11/2026

**Estado: EXCLUSIVAMENTE QA, sin cierre ni caja comercial conectados.**

Este documento acompaña el proyecto del panel único de Uki Regimiento Arica,
Uki La Serena y Romo Sushi La Serena. Mantener separado el sistema de caja
y las solicitudes de cada sucursal.

## Preparación completada
- Migraciones ejecutadas sólo en Neon QA preexistentes:
  - Uki: br-wild-sky-b5bruake del proyecto tiny-grass-92161762.
  - Romo: br-lingering-scene-berkq3k0 del proyecto round-cell-98681740.
- Tablas nuevas:
  - public.uki_seguimiento_finalizacion_qa_v1
  - public.romo_seguimiento_finalizacion_qa_v1
- Roles restringidos pueden leer, insertar y actualizar esas tablas, no
  eliminar filas ni acceder a la caja comercial.
- lib/seguimiento-finalizacion-atomica-qa.cjs prepara UNA instrucción SQL
  con comparación de identidad fuerte de sucursal y pedido, total, detalle
  estructurado guardado, y confirmación bancaria (estado confirmada,
  monto exacto, persona y fecha). La primera acción registra "pagado";
  "entregado" exige un registro anterior "pagado" y no puede cobrarse otra vez.
- api/seguimiento-finalizar-en-servidor-qa.js exige Google de personal
  autorizado, origen QA, rama y bandera SEGUIMIENTO_CIERRE_ATOMICO_QA_ENABLED.
  Esa bandera **NO DEBE HABILITARSE** hasta conectar la caja real y completar
  pruebas manuales.
- El panel QA de seguimiento tiene un botón simple con el monto del servidor:
  "Confirmar: vi $X abonados", después de comprobar el banco.
- Las sentencias SQL de la nueva operación fueron validadas por EXPLAIN
  (SIN ANALYZE, SIN EJECUTAR) para las tres sucursales.
- Las nuevas tablas se comprobaron vacías tras su preparación; no se
  ingresaron pagos ni transferencias reales.

## Bloqueo crítico de publicación
Romo almacena el estado de caja y pedidos en un snapshot cifrado AES-GCM.
El servidor de Neon NO puede leer el contenido de ese snapshot. Los endpoints
antiguos de guardado aceptan una nueva versión cifrada: comprobar un botón
ANTES del guardado no demuestra qué pedido cambió dentro de la versión.
Uki tiene además sus propias rutas de almacenamiento.

Por tanto, crear una tabla autoritativa en QA por sí solo NO garantiza que
las rutas antiguas de guardado ya no puedan saltarse la comprobación. Para
producción se necesita completar la migración por pedido:
1. Definir un identificador fuerte y verificable por cada pedido de carta,
   WhatsApp o manual, sin mezclar locales. Conservar las comandes existentes.
2. Hacer que las operaciones de "Pagado" y "Entregado" pasen únicamente por
   un endpoint del servidor que verifica el pago y registra el estado, y
   DESACTIVAR o restringir todas las rutas antiguas que puedan cambiar
   esos campos dentro de la caja cifrada.
3. Mantener detalle/observaciones cifrados, pero usar estados de pago y
   entrega estructurados como fuente autoritativa del servidor. Evitar
   contabilizar dos veces en el snapshot/caja y en el registro nuevo.
4. Verificar pagos mixtos, devoluciones, cancelación, entregado sin pago,
   timbres, correcciones post-cierre, y pagos de otro local sin paralizar
   otras órdenes o todo el cierre de caja.
5. Validar las cuentas bancarias de cada sucursal, manualmente verificación
   del abono en Santander u otra cuenta aprobada, permisos de agendadora
   y dueños, Safari iPhone, computador y desconexiones.
6. Publicar el lote conjunto SOLO después de superar validación manual.

Nunca marcar como pagado a partir del botón del cliente "Ya transferí":
ese botón solamente registra aviso y abre una revisión para personal.

El objetivo visible NO cambia: un botón para la agendadora, sin formularios
repetidos ni cuentas nuevas para clientes.
