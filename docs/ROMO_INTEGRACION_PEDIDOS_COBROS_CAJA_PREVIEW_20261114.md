# Romo La Serena — integración consolidada de pedidos, cobros y caja (preview)

Fecha: 14 de noviembre de 2026. Rama: \`preparacion/uki-romo-sobre-main-20261114\`.

## Consolidación del panel único
La clave Google, el sobre cifrado de Romo y el pedido manual #1 ya fueron verificados manualmente por la propietaria. La base original de Uki y su rama \`main\` no se tocan.

Este único despliegue de la rama de pruebas agrega a Romo:
- **Pedidos** con filtros por todos/pendientes/pagados/entregados/cancelados, con el mismo lenguaje visual de Uki.
- Confirmación explícita de **pagos recibidos** en pedido previamente registrado (hasta dos medios por productos y dos por envío, validación de sumas con \`ukiErrorDistribucionPago\`). El servidor recibe SOLO el estado cifrado, CAS sobre revisión y Google dueños; ninguna modificación se muestra como guardada antes de respuesta confirmada.
- Acción de **Entregado** para pedidos pagados y **Cancelar con motivo** solo sin pago, también con CAS.
- **Caja en modo consulta**, reutiliza \`totales()\` de Uki y sus estilos; pagos mixtos y delivery se desglosan correctamente. No se habilitan gastos, precierres ni cierres reales.
- La navegación de Romo permite Pedidos, Nuevo y Caja consulta; impide rutas de Timbr es/otros módulos que todavía no tienen persistencia Romo. Nunca envía eventos Firebase para esta sucursal.
- El modo WhatsApp y los borradores automáticos se bloquean en el piloto para que no parezcan guardados cuando no lo están. Al salir de un formulario no guardado se solicita confirmación.
- El antiguo banner que decía "NO REGISTRAR PEDIDOS" ahora señala que es un piloto con funciones limitadas. No es una autorización para clientes ni producción.

## Limitaciones y próxima conexión
La persistencia completa automática del resto de funciones Uki **NO** está segura mientras \`guardarEnLocalStorage()\` no realice CAS para todos los eventos. Por tanto, no se habilitan las pantallas que podrían perder cobros o datos. Las piezas existentes de inventario, timbres, cierres y carta se conservan sin recrearlas. Falta conectar sus operaciones a Neon Romo, separar permisos de trabajador y dueños, vincular catálogos/precios/disponibilidad y habilitar solicitudes de WhatsApp y rutas de delivery de Romo. El endpoint de preview solo admite escritura por cuentas Google rol dueños. Producción no modificada.

## Aprobación manual
1. Ingresar a Romo y comprobar que se ven los filtros de pedidos y la pestaña Caja consulta.
2. Probar con un pedido **real pendiente** solo cuando sea seguro; nunca cobrar el pedido PRUEBA - NO PREPARAR (#1, bloqueado).
3. Si se confirma pago, salir y volver a entrar y comparar el estado con el resumen de Caja.
4. Frente a error/no confirmación, no reintentar sin verificar si cambió la revisión, para evitar doble registro.
