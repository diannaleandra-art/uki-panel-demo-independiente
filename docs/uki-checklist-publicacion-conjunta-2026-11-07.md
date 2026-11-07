# Uki Sushi — Lista única de publicación conjunta (7 noviembre 2026)

**Proyecto:** Uki Sushi La Serena y Regimiento Arica. **Objeto:** conservar decisiones y evitar publicaciones fragmentadas.
**Regla:** no desplegar, migrar producción, modificar precios ni fusionar ramas a `main` sin autorización explícita. Mantener los QR impresos y los datos de pedidos/caja/cierres.

## A. YA OPERATIVO — no rehacer ni volver a migrar

1. Carta y QR públicos por sucursal; envío de pedidos por WhatsApp.
2. Panel operativo, registro manual, caja, gastos, pagos mixtos (productos/delivery), cobros entre locales, propinas, timbres, informes y cierres.
3. Solicitudes de carta en Pedidos → Pendientes, con formulario existente y opciones «Aceptar y revisar», «Motivo» y «Rechazar»; el registro de una solicitud por sí mismo no equivale a venta.
4. Inventario interno y acceso restringido a trabajador, disponibilidad agotado/disponible manual e independiente del stock.
5. Caja acumulada en efectivo. No cambiar sumas, quincenas ni periodos operativos.

**Observación:** diferencias entre código de rama y versión publicada se comprueban antes de todo lanzamiento; no inferir que un test aprobado significa publicación.

## B. DESARROLLO TERMINADO/PREPARADO EN RAMAS — aún NO listo para activar sin validación conjunta

| Cambio | Dónde está | Falta antes de publicación |
|---|---|---|
| Administrar ingredientes del armado: alta/edición, incluido $0 o recargo, sucursal y preparaciones | Panel `feature/uki-ingredientes-armado-integracion-completa-2026-11-07`; carta `feature/uki-ingredientes-armado-carta-2026-11-07` | Fusionar integraciones en QA aislado, migración aditiva, activar API sólo después de verificar sincronización panel/carta y monto exacto por sucursal |
| Delivery >9 km o tarifa incierta: WhatsApp con pedido completo y «Delivery por confirmar» | Carta `feature/uki-disponibilidad-manual-carta-2026-11-06` | Publicar carta agrupada y comprobar carrito, datos completos y mensaje |
| Envoltura mixta: 2 envolturas gratuitas distintas, sin pepino y respetando «Sin nori» | Misma rama de carta | Validar en todos los formatos, carrito, ticket y WhatsApp |
| Inventario organizado: Inventario actual / Revisiones de trabajadores / Historial, acceso trabajador limitado | Rama de integración de ingredientes, junto a módulos administrativos existentes | Safari/iPhone, navegación, exportar y revisar primer envío real controlado (históricamente hubo cero revisiones confirmadas) |
| Mejoras de Carta y precios (productos editables, manual disponible/agotado) | `main` y ramas preparadas, con integración parcialmente no publicada | No habilitar edición hasta confirmar que cliente vea importes correctos y misma sucursal |
| Interfaz de motivo antes de rechazar y detalles del rechazo | `main` del panel | Verificar versión servida y detalle del rechazo en equipos reales |

## C. AÚN INCOMPLETO O NO COMPROBADO — bloqueantes

1. **Pedido único entre dispositivos:** controles de duplicados locales están en `feature/uki-evitar-duplicados-carta-manual-2026-11-07`; falta exclusión mutua central antes de escribir caja, confirmación después de respaldar con éxito, recuperación segura de fallos y test de carrera de dos agendadores. No basta comparar el folio corto; usar ID UUID original de solicitud y sucursal. Ref: `docs/uki-auditoria-duplicados-2026-11-07.md`.
2. **WhatsApp + carta → Pendientes, punta a punta:** comprobar entrada real/QA desde iPhone, identificador cliente y teléfono, correcciones/rechazo y que la caja sólo cambie al guardar confirmado. La apertura de WhatsApp no garantiza que el cliente haya enviado el mensaje.
3. **Sincronización del inventario de trabajador:** falta confirmación de un registro completo y real en QA/panel, sin afectar agotados manuales ni dar acceso a caja.
4. **QA de ingredientes:** probar «Frutilla incluida en Regimiento, no en Serena» y luego recargo exacto, sin sumar descuentos indebidamente, en carta, carrito, WhatsApp y backend; validar aislamiento de Neon QA.
5. **Convergencia de ramas:** `feature/uki-ingredientes-armado-integracion-completa-2026-11-07` diverge respecto a `main`; no fusionar a ciegas. La mejora de duplicados está en otra rama. Preservar todos los cambios actuales en ambos locales.
6. **Vercel:** el último intento comunicado de despliegue de carta/previews recibió HTTP 402 por límite diario. No confundir con estado actual sin comprobar de nuevo; jamás contratar ni cambiar plan para forzar publicación.
7. **Pruebas finales en iPhone:** ambas sucursales, ingreso de pedido manual, recepción de carta, pago mixto, cruce entre locales, delivery, caja, cierre y timbre; ni datos ni QR impresos se reemplazan durante QA.

## D. Orden de salida seguro, después de aprobación

1. Implementar y superar controles de duplicados centrales en rama de prueba, con simulación de red fallida y dos dispositivos.
2. Integrar sin perder cambios los paneles de inventario y administración de ingredientes y la carta; ejecutar suite de pruebas en ramas; comprobar QA aislado con una cuenta autorizada.
3. Confirmar las versiones precisas de cada proyecto Vercel (backend, carta pública y panel), dominio oficial y respaldo recuperable.
4. Publicar **paquete compatible**: backend + migración aditiva + interfaz del panel + carta, encendiendo la función nueva al final. Evitar publicar una pieza que dependa de otra aún ausente.
5. Verificar con Safari desde iPhone en las dos sucursales y conservar capacidad de revertir versiones sin borrar datos.

**Corte de situación:** ninguna de las mejoras del punto B debe anunciarse como ya publicada sin comprobar la versión servida. Ningún cambio de este archivo escribe en los sistemas operativos.
