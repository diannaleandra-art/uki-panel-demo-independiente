# Romo La Serena · recepción de carta a panel único · QA 13-11-2026

**NO ES PUBLICACIÓN COMERCIAL. NO ABRIR VENTAS SIN AUTORIZACIÓN.**

## Base Romo confirmada
- Neon: proyecto separado romos-sushi-la-serena, BD romos_sushi.
- Tabla creada: public.romo_solicitudes_carta_v1; store_id fijo romo:serena, branch serena.
- Idempotencia: request_key único. Pedido interno aceptado único mediante índice parcial.
- Las solicitudes de clientes NO crean caja, timbre, venta o pago.
- Nunca escribir en tablas de Uki.

## Flujo backend preparado, desactivado
1. La carta Romo crea solicitud pendiente, sin marcar WhatsApp confirmado.
2. El MISMO panel UIKit (tercer local Romo) consulta bandeja y reserva con token, exclusivo.
3. El trabajador revisa el armado, precios Romo y medio de pago en el formulario existente.
4. La acción aceptarYGuardarSolicitudRomo comprueba reserva y versión, guarda el snapshot cifrado Romo y marca aceptada en una **única sentencia SQL**; si no confirma, no debe crearse otro pedido.
5. Caja, historial y timbres quedan dentro del snapshot habitual de Uki para esta sucursal, pero **la interfaz todavía NO está conectada** y se requiere QA de lectura/escritura, roles y dos teléfonos antes de operar.

## Protección
- API nueva: api/romo-solicitudes-carta-qa.js en la misma app inventario; sin generar otro panel.
- Devuelve 503 mientras falten VERCEL_ENV=production, ROMO_OPERATIVO_LIVE_ENABLED=true, ROMO_SOLICITUDES_LIVE_ENABLED=true, credenciales Romo, origen exacto, rate salt y personal Google autorizado.
- No configurar ni activar estas banderas antes de la aprobación final.
- No modificar las dos sucursales Uki, QR ni despliegues productivos.
- La rama de carta Romo también mantiene ROMO_SOLICITUDES_CLIENTE_HABILITADAS_QA=false.

## Pendiente antes de publicación autorizada
- Conectar UI de bandeja y mismo formulario del panel a funciones Romo, sin copiar pantallas.
- Autorizar acceso de personal Romo con Google, validar misma contraseña Uki y conexión operativa.
- Probar aceptación simultánea con dos teléfonos reales, pago mixto, caja, historial, timbre, cierre y recuperación.
- Evaluar/preparar un único lanzamiento autorizado, incluyendo carta pública Romo.

## Continuación: mensaje de carta Romo al formulario vigente de Uki (QA)
Se agregó un adaptador que conserva las cantidades, productos, instrucciones por roll, salsa, envoltura y el delivery, usando el mismo objeto de datos del formulario vNuevo()/ndGuardar().
Los precios unitarios quedan en 0 para ser verificados; nunca se inventan desde el total indicado.
Pago señalado por el cliente no equivale a pagado. Todo sigue apagado por ROMO_PANEL_RECEPCION_HABILITADA_QA=false, sin acceso de personal ni ventas.
Simulación con dos trabajadores: el primero reserva; el segundo debe recibir conflicto.
Aún falta conectar el guardado cifrado y la bandeja visibles al formulario real y ensayar desde dos teléfonos antes de activarlo.

## Guardado atomicamente confirmado (solo QA, sin activación)
El modulo firebase/uki-romo-guardado-atomico-qa.mjs prepara el estado cifrado de Romo sobre una COPIA, usa la misma estructura del formulario Uki y SOLO actualiza la pantalla despues de la confirmacion en Neon.
Ante un resultado incierto no libera la reserva ni inventa una confirmacion: exige verificar bandeja, caja e historial antes de reintentar.
La API ahora devuelve el campo branch en el listado, imprescindible para aislar Romo Serena.
La bandera ROMO_GUARDADO_ATOMICO_HABILITADO_QA=false impide usarlo; sigue faltando enlazar el constructor de ventas, timbres y pagos ya existente del panel y ensayar la interfaz desde dos telefonos.
