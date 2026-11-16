# Romo · preconciliación Mi Administración (16 noviembre 2026)

## Preparado en rama Romo, no publicado
- La vista previa privada previsualizarSincronizacionCierresRomoQA separa inspección de importación. Solo SELECT, requiere verificación de dueños, PIN y bases independientes, revisa constancias y registros existentes, nunca crea ventas ni actualiza cierres.
- El importador existente usa exactamente esta vista previa antes de una eventual escritura idempotente; sigue SIN endpoint público de importación y con banderas por defecto desactivadas. No se cambió el esquema ni se hicieron transacciones.
- El filtro QA se alinea con la rama actual de preparación. No se habilitó ninguna bandera ni despliegue.
- Mi Administración de la rama de preparación ya muestra cierres de Romo separadamente. Ahora valida source_key, fecha, desglose, monto, revisión Neon y duplicados; ante inconsistencia deja la pantalla vacía en vez de ocultar cierres y mostrar sumas engañosas.
- La etiqueta de repartidor aclara que la cifra proviene del importe registrado en cierre; el campo original delivery_por_pagar requiere conciliación semántica antes de sumar como deuda o gasto.
- No se suman cierres Romo a los totales generales ni se crean movimientos manuales duplicados. El cierre único es romo:serena|turno.
- Faltan comprobaciones manuales con cierres reales, confirmar destino contable, reportes y rectificaciones postcierre. No inventar pruebas ni usar la base de Uki.
