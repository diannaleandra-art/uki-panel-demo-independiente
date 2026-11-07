# Uki Sushi — Caja acumulada en efectivo
Estado: **requerimiento aprobado para integrar en el panel existente; NO implementado ni publicado**.
Nombre visible aprobado por administradora: **Caja acumulada en efectivo**.
Se incluye en la lista de mejoras para la publicación conjunta posterior a pruebas; no alterar cierres, pedidos, pagos o producción existente.

## Objetivo
Registrar el efectivo que efectivamente queda bajo custodia de cada sucursal, trasladándolo desde cierres anteriores a un saldo acumulado; permitir usar una parte de ese efectivo, retirarlo o transferirlo entre locales con trazabilidad.

## Pantalla en el panel actual
- Sección exacta «Caja acumulada en efectivo» (visible para administradora, acceso de operaciones según permisos existentes; agendador no autorizado para retiros).
- Pestañas/filtro por sucursal: Regimiento Arica y La Serena. Nunca mezclar saldos.
- Resumen por sucursal: saldo inicial reconciliado, acumulado de cierres confirmados, gastos pagados con dinero acumulado, retiros, entradas manuales justificadas, traspasos recibidos/entregados y saldo actual.
- Historial con fecha/hora Chile, usuario, motivo/concepto, monto, sucursal, origen del movimiento e identificador único. Exportación PDF/CSV compatible Excel y compartir WhatsApp cuando exista autorización. En resumen del cierre incluir saldo sin alterar ventas del día.

## Regla financiera importante: SIN DOBLE CONTEO
- Se ingresa por única vez un **saldo inicial real contado** al activar la función; no inventar saldos ni sumar automáticamente cierres antiguos sin conciliación.
- Cada **cierre confirmado**, no un precierre, aporta SOLO el efectivo neto que realmente queda para custodiar al término del turno (ventas cobradas en efectivo de la sucursal, menos las salidas en efectivo ya incluidas en ese cierre y cualquier efectivo no entregado a caja, según las reglas actuales).
- **Un gasto ya descontado del cierre NO vuelve a descontarse de la caja acumulada.**
- Un gasto *posterior* pagado desde el dinero acumulado sí resta una sola vez; conservar como movimiento distinto de cualquier gasto operativo del día.
- Las ventas por transferencia, tarjetas, Edenred, Junaeb y pagos efectuados/cobrados en otros locales no son ingresos de efectivo físico. Delivery a pagar no es efectivo disponible.
- Transferencias de efectivo entre sucursales generan un par enlazado: salida en origen y entrada en destino; monto idéntico, auditables e idempotentes.
- Retiros y gastos se restan solo tras confirmación explícita, nunca por mostrar el formulario.
- Cierre corregido genera un ajuste de diferencia auditable, jamás un segundo abono completo.
- Si el arqueo de efectivo contado difiere del saldo calculado: mostrar «diferencia por revisar»; NO ajustar sin aprobación de administradora.
- Fecha operacional: respetar el día del turno aunque cierre después de medianoche; registrar también fecha/hora real de Chile.

## Operaciones
1. Registrar saldo inicial tras conteo.
2. Recibir efectivo neto de cierre confirmado (una vez por ID cierre).
3. Registrar pago de una compra desde el efectivo acumulado, con concepto y responsable.
4. Registrar retiro con concepto, responsable y destino.
5. Registrar entrada extraordinaria con justificación.
6. Traspasar entre locales, vinculando los dos lados.
7. Consultar historial, filtros, arqueo, movimientos y correcciones con registro de auditoría.

## Controles
- Nunca permitir saldo inicial ficticio ni gastos sin nombre/importe válido.
- No permitir egresos por encima del saldo disponible salvo permiso administrativo especial explícito; no presupuestar este permiso como comportamiento por defecto.
- Persistir cada movimiento en BD con ID y clave única para evitar doble clic/doble cargo.
- Registrar autor, creada_en y nunca editar/borrar movimientos firmes silenciosamente: reversa + nueva entrada auditada.
- Control administrativo para retiros, correcciones, transferencias y cierre; los trabajadores no tendrán acceso a cierres ni al saldo acumulado completo.
- Sin dependencia del stock del inventario ni del Disponible/Agotado de la carta.

## Criterios de aceptación antes de publicar
- Saldo Regimiento Arica y La Serena aislados.
- Cerrar un turno dos veces no duplica efectivo; corregir un cierre mueve solo la diferencia y mantiene auditoría.
- Gastos ya reflejados en un cierre no se descuentan por segunda vez.
- Ventas por otros medios y pagos cruzados no alteran caja acumulada en efectivo.
- Pago desde acumulado y retiro restan una sola vez.
- Transferencia entre sucursales no crea ni destruye efectivo global.
- PDF/CSV y acceso iPhone desde panel con usuarios autorizados.
- Pruebas en base aislada antes de cualquier cambio de producción.
