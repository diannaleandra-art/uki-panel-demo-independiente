# Uki Sushi — pedidos por QR en mesa: plan de integración (SIN PRODUCCIÓN)

Estado al 3 nov 2026: **solo análisis/diseño; no hay recepción automática activada, no usar con clientes reales.** No publicar ni cambiar la carta de producción sin autorización específica.

## Infraestructura comprobada
- Panel: `uki-panel-demo-independiente/firebase/uki-sushi-local.html`, GitHub Pages, Firebase con snapshot completo cifrado por sucursal. Sucursal y clave de nube son solo para personal autorizado.
- Carta: proyecto Vercel `uki-sushi-pedidos`, código de lanzamiento en `diannaleandra-art/uki-sushi-respaldo`, ruta `public/candidata/app.js`, `model.mjs`.
- La carta ya ofrece modo `consumo`, pero no recoge mesa; prepara pedido para WhatsApp. No hay endpoint POST de recepción de pedidos en `api/route.js` (solo consulta de rutas GET).
- El formato de texto que crea la carta y el encabezado rígido que detecta el importador del panel no son idénticos; no basar la conexión en pegar texto.

## Flujo objetivo
1. QR público por sucursal y mesa, con URL tipo `?tipo=mesa&sucursal=arica&mesa=2`; el servidor valida la sucursal y mesa activa. Un QR por mesa, administrable.
2. Carta existente se abre en modo consumo y enseña: "Mesa 2 · Regimiento Arica". El cliente arma productos existentes. WhatsApp es opcional para pedir desde la mesa.
3. Enviar → API segura `POST /api/mesas/pedidos` crea **solo solicitud** con idempotencyKey, cantidad, ingredientes, observaciones, sucursal y mesa; monto recalculado en servidor con carta autorizada. Respuesta: código + "Pendiente de confirmación".
4. Bandeja autorizada del panel: "Pedidos de mesas", estados recibido, confirmado, en preparación, entregado, rechazado/cancelado. Distinguir solicitudes de ventas pagadas.
5. Trabajador confirma → adjuntar a cuenta de mesa existente o abrir una nueva; nunca duplicar en caja. Consumiciones adicionales acumulan en la misma cuenta.
6. Al pedir la cuenta: total, propina voluntaria 10 %, cuenta imprimible/compartible, cobro manual al personal; solo entonces queda pagado.
7. Delivery y cálculo de repartidores no deben incluir jamás solicitudes de consumo.

## Seguridad y concurrencia obligatorias
- No dar claves de nube, PIN, credenciales Firebase ni sesión Google a clientes.
- No escribir peticiones públicas en el documento cifrado `uki_operacion_v1` del panel. Necesita bandeja aislada en base de datos y control de lectura/escritura por sucursal.
- API con límite por IP/mesa, anti-spam, validación de productos/precios del lado servidor, bloqueo de pedidos duplicados, sanitización de observaciones y máximo de ítems.
- Operaciones por pedido con ID único y escritura atómica; no sustituir el snapshot completo cuando dos empleados guardan a la vez.
- Confirmación explícita del trabajador, auditoría de cambios y manejo de agotados/precios. Un QR fotografiado puede usarse desde fuera: requerir confirmación y medidas antiabuso.
- Las pruebas deben usar pedidos falsos y ambiente aislado de caja/cuentas reales.

## Datos mínimos necesarios
- Cantidad y numeración de mesas por sucursal (por ahora se puede probar con Mesa 1, 2 y 3).
- Confirmar sucursales de consumo: Uki Regimiento Arica y/o Uki La Serena.
- QR impreso o adhesivo por mesa; internet de los teléfonos y del local.
- No hace falta crear otra carta, otro celular ni otro número de WhatsApp para la función QR.
- Aprovechar infraestructura Vercel + Firebase existente **solo si permisos y cuotas lo permiten**; revisar consumo real y no activar servicios de pago o facturación sin permiso.

## Criterios de aceptación antes de publicar
- Dos trabajadores confirman pedidos simultáneos sin sobrescribir ni perder registros.
- Tres solicitudes ficticias a una mesa, una reintentada: aparecen exactamente tres, no cuatro.
- La misma mesa tiene una sola cuenta abierta; todos los importes coinciden con las tarifas vigentes.
- Pedido rechazado por agotado no entra en venta/caja; pedido confirmado tampoco se marca pagado antes del cobro.
- Sucursales aisladas, clientes sin acceso a datos privados.
- Borrar pruebas no afecta registros reales; costo y límites comprobados; publicar solo con autorización.

## Entrega actual
- En rama de prueba del panel se ha preparado **pausar/retomar varios borradores en un dispositivo** (sin registrar ventas).
- **No** está resuelta todavía la sincronización multi-dispositivo.
- **No** está creada todavía la API de solicitudes de mesa ni el enlace QR funcional a esa API.
