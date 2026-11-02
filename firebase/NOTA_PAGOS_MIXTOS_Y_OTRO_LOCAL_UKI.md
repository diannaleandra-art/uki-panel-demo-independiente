# Uki Sushi — pagos mixtos y cobros en otro local (NO PUBLICAR AÚN)

Este cambio está exclusivamente en la rama `feature/pagos-mixtos-y-cobro-en-otro-local-uki-20261102` y conserva el panel existente y sus datos.

## Caso A: pago mixto del cliente

Al registrar un pedido se puede seleccionar **dividir entre varios medios** para productos y/o delivery, añadiendo medios y montos. Si el pedido se marca pagado, la suma de los medios debe coincidir con el valor correspondiente. Caja suma el importe a cada medio una única vez. Pedidos históricos mantienen su cómputo original.

Ejemplo: productos $20.000 (efectivo $10.000 + transferencia $10.000) y delivery $3.000 (efectivo $1.000 + débito $2.000). Caja registra $23.000 distribuidos entre los medios de pago.

## Caso B: comida cobrada en otro local, preparada por Uki

Seleccionar «Productos pagados en otro local» e indicar dónde se recibió el pago. El pedido conserva el detalle de cocina y su valor, pero **los productos no se suman a la caja de Uki**. El delivery pagado en Uki sí se incluye según su medio, incluso si el envío tiene pago mixto.

Ejemplo: productos $20.000 cobrados en Uki La Serena; producción en Uki Regimiento Arica; $3.000 delivery efectivo en Regimiento. En Regimiento se registran $3.000 en efectivo y $20.000 informativos, sin duplicación. El local receptor debe registrar **por separado** el dinero realmente recibido; esta opción no transfiere dinero ni escribe en su caja automáticamente.

## Seguridad y compatibilidad

- No cambia `fechaOperativaActual` ni `cerrar()`, incluidas jornadas que cierran después de medianoche.
- No cambia Firebase, contraseñas ni agrega plataformas o gastos.
- Los pedidos antiguos sin `pagosProductos` o `pagosEnvio` siguen usando `medio` y `medioEnvio`.
- El detalle congelado del cierre registra los medios, lo cobrado en Uki y los productos pagados fuera, para evitar confundir producción con cobro.
- No se duplica el timbre del cliente cuando el pago de los productos fue en otro local.
- **10 pruebas automatizadas aisladas aprobadas**; sin acceso a ventas reales ni a nube real.
- **No fusionar a main ni publicar** sin autorización para esta mejora de pagos y prueba controlada de sincronización.
