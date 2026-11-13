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

## 13 noviembre 2026 · Timbre Romo con confirmación cifrada (sólo QA)
Se agregó un módulo separado que prepara el timbre de un pedido Romo previamente
confirmado y pagado, exigiendo WhatsApp real abierto, constancia de envío manual,
responsable y horas. No emite mensajes ni presume envíos. Rechaza timbres
duplicados y pedidos impagos/entregados/externos. Cambia únicamente una COPIA
aislada del pedido, cifra y solicita CAS en Neon; ante un error no muestra la
confirmación ni reintenta. El control del mismo panel ya expone la acción, pero
el botón y el flujo de WhatsApp del trabajador SIGUEN SIN CONECTAR y la activación
Romo continúa bloqueada. Uki no fue modificado.

## 13 noviembre 2026 · Timbre enlazado en el mismo panel de Romo (solo QA)
La vista de pedidos confirmados ahora ofrece nombre del responsable, abrir WhatsApp
y confirmar el envío manual; el mismo control de Romo llama al guardado cifrado CAS
en Neon. No atribuye el envío a una pantalla abierta. Ante resultado incierto no
reitenta; exige revisar pedido/historial. El formulario de alta usa la misma tarjeta
de Uki con la marca correcta de Romo, sin cambiar los premios ni el mensaje de Uki.
La edición, la cancelación y la entrega todavía no están disponibles en Romo.
Los interruptores de Romo y su carta comercial permanecen desactivados.

## 13 noviembre 2026 · Entrega de pedidos confirmados, QA
La vista de pedidos Romo ahora permite indicar el responsable y marcar Entregado
solo sobre pedidos Pendientes, conservando caja y medios de pago intactos.
La misma lógica de Uki exige timbre confirmado en pedidos pagados que lo requieran.
El guardado usa copia cifrada AES-GCM y revisión CAS en Neon; el historial anota
responsable y hora. Respuestas inciertas no marcan entregado en la pantalla.
Esto aún requiere prueba real con cuentas Google autorizadas y dos teléfonos.
La edición y cancelación continúan pendientes; no se activaron ventas públicas.

## 13 noviembre 2026 · Cancelación segura de pedidos sin pago (QA)
Se agregó la opción del mismo panel para cancelar únicamente pedidos Pendientes
que no tengan cobros, pagos externos ni propinas y cuyo turno siga sin cerrar.
Requiere motivo y responsable; se guarda un evento en historial y la copia se
confirma cifrada en Neon CAS. No inventa devolución pendiente ni toca caja.
Los pedidos pagados siguen bloqueados hasta resolver el circuito de reembolsos
y conciliación. Romo continúa comercialmente desactivado y Uki no se modifica.

## 13 noviembre 2026 · Edición de pedidos pendientes de Romo (QA)
Se habilitó en código (sin activar comercio) la edición de cantidades, precios,
detalles de armado y delivery **exclusivamente** cuando el pedido sigue Pendiente,
no tiene pagos, propinas ni timbre y su turno se mantiene abierto en Neon.
Se exige motivo y responsable, y se conserva el historial antes/después con
importes exactos, sin modificar folio, identidad de la solicitud ni caja.
CAS de Neon y AES-GCM confirman el cambio antes de mostrarlo; en una respuesta
incierta debe consultarse Neon antes de repetir. La edición de pedidos pagados
requiere el flujo de conciliación y sigue bloqueada. Uki sin cambios.

## 13 noviembre 2026 · Inventario Romo independiente (QA)
Backend preparado en la misma aplicación para Romo La Serena usando la tabla romo_inventario_v1 de Neon, con unidades, existencias, mínimos, disponibilidad, conteos, entradas e historial. Solo los dueños pueden editar fichas o archivarlas; el rol inventario puede registrar conteos con Google autorizado. Las escrituras tienen revisión CAS para evitar pisar trabajos desde dos teléfonos. Los datos de Uki no se usan.
La API exige ROMO_INVENTARIO_LIVE_ENABLED=true y ROMO_OPERATIVO_LIVE_ENABLED=true en producción: ambas siguen sin activarse. Falta conectar el mismo formulario de inventario en el panel y el PIN de trabajador; no es un inventario comercial operativo todavía.
