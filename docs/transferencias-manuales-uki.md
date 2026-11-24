# Revisión manual de transferencias — Uki

Preparación del 24 de noviembre de 2026. Base: `c60097b7e6235f4393405d97be6ca29874a34729`.

## Estado

Cambios preparados para revisión; no publicados en el panel operativo. Se revisó el código y la sintaxis JavaScript. La comprobación manual de las pantallas sigue pendiente: el navegador de esta sesión no pudo acceder al servidor local aislado. No se ejecutaron suites de pruebas automatizadas.

La revisión es una declaración de la persona que consultó Santander. Este cambio no consulta movimientos bancarios, no autentica la identidad del revisor y no genera enlaces de cobro. La conexión bancaria requiere una integración independiente y conocer el tipo de cuenta.

## Comportamiento propuesto

- Se puede aceptar y guardar un pedido pendiente de pago; la solicitud conserva su identidad.
- Para confirmar un nuevo pago por transferencia se registra el importe correspondiente, el nombre del revisor, la fecha y una referencia opcional.
- La revisión incluye solo las partes transferidas de productos, delivery y propina que recibe este local. Excluye los cobros de otro local.
- Finalizar la entrega exige revisión vigente y resolución de cualquier diferencia de cobro relacionada con la transferencia.
- Editar importe o distribución invalida la revisión para finalizar. Las diferencias de productos y delivery conservan los cobros anteriores; un cambio de medio que involucra transferencia también conserva la distribución anterior hasta conciliarla, aunque el saldo sea cero.
- Una nueva propina por transferencia en un pedido pagado exige revisar el nuevo importe antes de guardar.
- Retirar la confirmación del pago archiva la revisión. Se puede cancelar un pedido sin pago mediante el flujo existente.
- Una referencia no vacía se comprueba al revisar, guardar y finalizar contra otros pedidos de la misma sucursal, incluidos sus antecedentes y ajustes históricos. Una referencia descartada por duplicación conserva su motivo sin adjudicar otro abono.
- Una venta olvidada por transferencia exige declarar la revisión del importe local antes de rectificar el informe histórico.
- No cambia el cierre de caja ni activa servicios bancarios.

## Comprobación manual pendiente

Usar exclusivamente un entorno aislado y datos ficticios. Mantener Firebase, bancos y servicios de clientes desconectados. No usar pedidos reales para estas comprobaciones.

1. Aceptar una solicitud WhatsApp y guardarla por cobrar. Verificar que no se duplique ni se marque pagada.
2. Intentar guardar una transferencia como pagada sin revisión. Registrar revisor y abono correcto; confirmar pago y entrega.
3. Dividir un pedido entre efectivo y transferencia. Incluir delivery y propina con medios distintos; exigir únicamente la suma transferida.
4. Registrar cobro parcial en otro local y comprobar que no entre en el importe que se revisa aquí.
5. Editar una venta pagada de $10.000 a $15.000; conservar los $10.000 recibidos, mostrar $5.000 pendientes y exigir nueva revisión antes de finalizar.
6. Cambiar un cobro pagado de efectivo a transferencia por el mismo importe. Conservar el efectivo anterior hasta revisar y conciliar los medios. Comprobar también la dirección inversa.
7. Agregar una propina transferida a un pedido pagado. Sin nueva revisión, el guardado debe bloquearse y conservar el movimiento anterior.
8. Retirar «pagado» y volver a marcarlo: la revisión anterior no debe reutilizarse.
9. Repetir una referencia en dos pedidos y en un borrador que se retoma después de guardar el otro. Debe bloquearse y permitir corregir la revisión o guardar pendiente después de descartarla.
10. Escribir revisor/referencia y provocar un refresco de pantalla. Conservar los campos y la revisión tras guardar y recargar la copia aislada.
11. Cancelar un pedido sin pago y registrar una venta olvidada por transferencia con revisión explícita.

Publicar únicamente después de completar la comprobación manual y revisar la rama vigente. Las pruebas locales no sustituyen la validación de sincronización con una cuenta de pruebas autorizada.
