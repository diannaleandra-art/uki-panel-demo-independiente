# Romo · canjes de timbres de Uki final con guardado Neon CAS

Fecha: 15 de noviembre de 2026.

**Referencia oficial:** `firebase/uki-sushi-local.html` de `main`, funciones `canjear12`, `canjear36`, `ventasValidas`, `ukiVistaCliente`.

## Paridad exacta de negocio
- A las **6 compras válidas**: un canje de **12 piezas gratis**, sin reiniciar los timbres acumulados. No se puede canjear dos veces el premio de 6 durante el ciclo.
- A las **10 compras válidas**: un canje de **36 piezas + 2 korokes gratis**, reiniciando la tarjeta según las mismas reglas Uki.
- Se registra el mismo tipo de evento `canje6` o `canje10` en la tarjeta y un pedido de premio `esPremio:true` con precio y total **$0**, medio `Canje 6 ventas` o `Canje 10 ventas`, sin contar una venta ni un cobro.
- En Romo, el pedido de premio queda ligado al turno abierto y confirmado. La edición de la tarjeta y el pedido se envían en **una única revisión CAS cifrada de Neon Romo**. El botón confirma explícitamente la entrega, no crea una venta. Si falla la confirmación, no se modifica el estado visible ni se permite asumir éxito.
- El PIN de inventario no habilita esta operación y no se añadieron funciones que no estuviesen en Uki.

## Comprobación
Solo comprobación de sintaxis JS en GitHub y revisión de fuentes. **No se simuló ni ejecutó ningún canje comercial**. Validación en iPhone pendiente con una tarjeta que realmente reúna 6/10 timbres; no inventar compras para probar.
