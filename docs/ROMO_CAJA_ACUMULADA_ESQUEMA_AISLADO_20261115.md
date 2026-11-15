# Romo Sushi La Serena · estructura independiente de caja acumulada

## Estado
**Migración escrita en la rama de preparación; NO ejecutada en Neon ni desplegada.**
Ubicación: \`migrations/2026-11-15-romo-caja-acumulada-aislada-qa.sql\`.

## Aislamiento y funcionamiento
- Reutiliza exclusivamente la BD existente \`romos_sushi\` y la sucursal \`romo:serena\`. La propia migración aborta si se ejecuta en otra base. No crea otra sucursal ni modifica la contabilidad, caja, inventario o pedidos de Uki.
- Tablas: cuenta única, movimientos auditados con ID de operación UUID y registro de cierres acreditados con \`source_key\` único.
- Todos los saldos parten en cero **sin inicializar**. El saldo inicial requiere conteo físico y nombre responsable.
- Una sola función transaccional con bloqueo de fila \`FOR UPDATE\` verifica saldo suficiente, registra entradas, retiros y gastos y evita operaciones repetidas por \`op_key\`.
- Para acreditar un cierre, el importe se lee directamente del recibo Neon Romo \`romo_cierres_constancia_v1\`, con arqueo exacto y fecha **posterior** al registro inicial. El importe no se acepta del navegador. Cada cierre se registra como máximo una vez, incluso si el usuario vuelve a pulsar.
- Este esquema **no** implementa traspasos a Uki ni rectificaciones de cierres; permanecen pendientes de autorización y conciliación separadas. No se permite gastar dinero negativo.
- La función SQL se concede únicamente a \`romos_app_service\`; la API deberá validar en servidor la identidad Google con rol de dueños y bloquear toda escritura salvo la bandera Preview explícita.

## Pendientes
1. Revisar migración con credenciales de mantenimiento y verificar privilegios/tabla existente antes de aplicarla a la **BD Romo**, sin tocar datos actuales.
2. Conectar API de lectura y, solo tras revisar permisos y operación, una UI limitada a dueños.
3. Con autorización de la propietaria, realizar comprobación **manual** en iPhone con saldo físico real, un cierre confirmado y un retiro real; no inventar dinero ni hacer pruebas comerciales automáticas.
4. Completar rectificaciones, trabajadores y la importación financiera idempotente de Mi Administración antes de equiparar funcionalidades con Uki.

No publicar este lote como operación financiera terminada.


## API de solo Romo (sin habilitar)
El endpoint \`api/romo-caja-acumulada-qa.js\` exige rama Preview exacta, origen permitido, host/base \`romos_sushi\`, cuenta \`romos_app_service\`, token Google con rol \`duenos\` y \`ROMO_CAJA_ACUMULADA_LECTURA_QA_ENABLED=true\`. Las consultas son \`saldo\` y \`movimientos\`. Para escribir se requiere **además** la bandera separada \`ROMO_CAJA_ACUMULADA_ESCRITURA_QA_ENABLED=true\`; está ausente/no configurada en esta preparación.
Las operaciones de escritura permitidas son \`inicializar\`, \`entrada\`, \`gasto\`, \`retiro\` y \`sincronizar_cierre\`. El servidor impone \`op_key\` UUID, nombre responsable, concepto, importes y \`source_key\` validada; la función SQL guarda/rechaza todo de forma atómica. El trabajador de inventario y el agendador **no tienen permiso**. No se entregan datos de clientes ni se conecta el libro de Uki.
La migración debe revisarse y aplicarse primero por los dueños/autorizado sobre la base existente Romo. La interfaz de escritura y las pruebas manuales aún no están habilitadas.
