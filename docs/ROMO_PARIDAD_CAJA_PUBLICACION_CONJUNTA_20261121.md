# Romo · paridad operativa y financiera, 21-11-2026
Base de Romo: c287e1e6539b3b66e9dbb9b7b5dd31712b0cea6f. Referencia oficial Uki: 36a0c19b79f134c2159d6b024f410935877db5a7.
Rama de integración separada. No promover hasta revisión manual y validación de permisos.
## Este bloque
- Precierre: reutiliza vPrecierreTrabajadores, mantiene escritura CAS privada de Romo.
- Cierre: reutiliza vCierre, agrega Junaeb, usa bandeja Romo y adapta confirmación al cierre atómico existente. La base confirmada es de solo lectura aquí.
- Acumulada: interfaz basada en Uki, API privada Romo con permisos de dueño existentes, saldo inicial, entradas/gastos/retiros y exportaciones. La escritura sigue condicionada por la configuración de servidor; no se cambió ninguna variable ni base.
- Conciliación de cierres elegibles: usa constancia de servidor y clave única; no acreditar cierres anteriores al conteo inicial ni rectificados.
## Pendientes bloqueantes antes de publicación conjunta
- Validación manual de apertura, precierre, cierre, caja exacta y diferencias, permisos, guardado y exportación. Verificar el libro real antes de habilitar escrituras.
- Traspasos y correcciones del libro: requieren integración explícita entre almacenes independientes; no simular transferencia con dos escrituras separadas.
- Edición financiera de pedidos pagados, timbre obligatorio al cobrar y al guardar, movimientos/repartidor.
- Productos, ingredientes, categorías, fotos, promociones personalizables, inventario y accesos.
- Facturas, proveedores, integración contable con Mi Administración. No duplicar cierres, ventas manuales ni gastos.
- Unificar el código de las tres sucursales sin fusionar a ciegas ramas divergentes. Mantener enlaces, identidad comercial y bases independientes.
