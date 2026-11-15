# Romo La Serena · instalación del esquema de caja acumulada

Fecha: 15 de noviembre de 2026. **Instalación realizada. Sin desplegar nuevas funciones web ni movimientos financieros.**

## Alcance confirmado con Neon
- Proyecto existente: `romos-sushi-la-serena`; base existente: `romos_sushi`; rama principal de Neon. No se creó otro proyecto ni otra base.
- Antes de intervenir: 0 constancias de cierre; 0 turnos registrados; 1 estado cifrado. Las tablas de caja acumulada no existían.
- Después: creadas `public.romo_caja_acum_cuenta_v1`, `public.romo_caja_acum_movimientos_v1`, `public.romo_caja_acum_cierres_v1` y la función `public.romo_caja_acum_aplicar_v1`.
- Saldos iniciales **no establecidos**. Registros en las tres tablas nuevas: **0/0/0**. No se hizo ningún conteo, entrada, gasto, retiro, cierre o venta ficticia.
- Permisos efectivos comprobados: `romos_app_service` tiene lectura y puede ejecutar la función, pero no tiene `INSERT` directo sobre el ledger. La función `SECURITY DEFINER` serializa saldos mediante bloqueo `FOR UPDATE`, idempotencia de `op_key` y exige una constancia válida para acreditar cierres.
- `romos_clave_alta_qa_20261114` no puede leer las tablas nuevas. No se cambiaron los permisos de las tablas anteriores de inventario, pedidos ni caja.
- Antes se compiló el esquema en rama temporal independiente de Neon; se corrigieron dos expresiones CASE, delimitadores PL/pgSQL y permisos predeterminados. La compilación del procedimiento y la lectura de privilegios se confirmaron **sin ejecutar operaciones comerciales de ensayo**.

## Estado web
- Solo se guardó código en `preparacion/uki-romo-sobre-main-20261114`. La rama principal de GitHub `main` sigue sin esos cambios.
- La integración de siete pestañas, la consulta aislada, las exportaciones y el historial de Romo siguen en preparación. El panel existente de Uki en producción no se publicó de nuevo.
- Al revisar Vercel no había despliegues de la rama de preparación, por lo tanto **no hay URL de Preview verificada para pruebas manuales**.
- No están configuradas las banderas independientes `ROMO_CAJA_ACUMULADA_LECTURA_QA_ENABLED` ni `ROMO_CAJA_ACUMULADA_ESCRITURA_QA_ENABLED`. La API nueva está cerrada. No habilitar escrituras sin una comprobación manual aprobada.

## Único recorrido manual pendiente cuando exista un Preview autorizado
Abrir Romo con Google de dueños y clave actual → comprobar los pedidos de la carta → aceptar y guardar pedido real → timbre → registrar solo cobros reales → entrega → precierre y cierre con arqueo físico → constancia en Neon → consulta de Caja acumulada con saldo inicial contado → comprobar Historial, CSV, PDF y WhatsApp → validar una sola atribución del cierre en Mi Administración.

El precierre del trabajador aún exige la sesión operativa Google de dueños; su acceso propio no está homologado. El PIN de inventario no concede autorización de caja. No habilitar ni publicar el sistema como plenamente equivalente a Uki antes de resolver esa separación y los procedimientos restantes.

**Regla:** conservar Uki Regimiento y Uki La Serena en producción, sin modificar las operaciones ya aprobadas. Cada paso comercial se valida manualmente, no con pedidos de prueba.
