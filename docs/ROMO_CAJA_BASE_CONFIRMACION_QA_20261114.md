# Romo La Serena: validación obligatoria de base de caja (14-11-2026)

En la captura real de Safari de la dueña, la vista **Caja de Romo** mostraba $18.000 de base y $20.000 de caja chica, idénticos a los valores predeterminados de Uki, pese a que el primer estado cifrado de Romo se creó en $0 (revisión 1). La revisión 2 incorporó el pedido #1 de prueba, sin pago. Es posible que ese proceso guardara los valores del estado diario antiguo. Como el estado está cifrado en el cliente no se afirma el origen sin una confirmación manual.

## Protección
- Cada caja diaria nueva de Romo tiene **base 0**, caja chica **0** y `baseConfirmada:false`. Uki mantiene sus valores y funcionamiento existentes.
- Los registros diarios anteriores de Romo que no tengan `baseConfirmada:true` quedan como **no confirmados**, aunque contengan valores.
- Un aviso visible presenta los importes anteriores como **no verificados**, sin declararlos dinero físico. No se alteran automáticamente ni se ocultan los valores históricos.
- Se bloquean cobros y movimientos de caja hasta que una dueña confirme expresamente el efectivo y caja chica reales, incluso si los importes verdaderos son 0/0.
- La confirmación queda guardada en el estado cifrado Romo con `baseConfirmada:true`, fecha y responsable «dueños», usando el mismo CAS Neon.
- El resumen no anuncia efectivo disponible si falta validación. Ningún pedido ni pago se crea en este paso.

**Pendiente una acción manual de dueños**, desde Caja → «Establecer base del turno», ingresar los importes físicos reales, confirmar, salir y volver a ingresar para comprobar la revisión. Solo luego se pueden habilitar cobros/gastos para revisión manual. No se ejecutaron pruebas automáticas ni registros de dinero ficticio.
