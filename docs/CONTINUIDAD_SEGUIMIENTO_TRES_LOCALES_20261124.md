# Continuidad del seguimiento · Uki y Romo · 24-11-2026

## Propósito aprobado
Una sola experiencia para Uki Regimiento Arica, Uki La Serena y Romo Sushi La Serena:
1. La carta registra una solicitud; sin confirmar pago ni venta.
2. El cliente conserva un enlace privado, sin registro ni instalación, y ve el estado real de su pedido.
3. Una aceptación debe reflejarse sólo después del guardado persistido.
4. El cliente puede escribir al local desde esa misma página; la agendadora responde desde su panel habitual.
5. Si eligió transferencia, puede avisar "Ya transferí", lo cual NO marca el cobro como recibido.
6. La persona autorizada verifica en el banco el monto real y registra responsable; hasta entonces no hay transferencia confirmada ni finalización normal.
7. Ninguna sucursal puede leer solicitudes, cuentas, chats o caja de otra.

## Código preparado en rama privada
Rama: preparacion/enlaces-seguros-3-sucursales-20261124
- lib/seguimiento-enlaces-seguros-v1.cjs: enlaces firmados con vencimiento y revocación por huella.
- lib/seguimiento-qa-servidor-v1.cjs: lectura por pedido, avisos, confirmación manual y mensajes; tablas separadas.
- lib/seguimiento-operacion-unificada-qa.cjs: validación compartida de estados y pagos mixtos.
- lib/seguimiento-chat-cifrado-v1.cjs: cifrado autenticado, separado por pedido y sucursal.
- lib/seguimiento-qa-entorno-v1.cjs: exige Preview y bases realmente aisladas.
- lib/seguimiento-qa-personal-auth-v1.cjs: permisos de personal por local.
- api/seguimiento-cliente-tres-qa.js y api/seguimiento-personal-tres-qa.js: endpoints nuevos, APAGADOS por defecto.
- public/seguimiento-pedido-qa.html: pantalla de seguimiento para cliente en móvil.
- public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs: bandeja discreta dentro del panel; no se abre sola.
- migrations/qa/NO_EJECUTAR_*.sql: esquemas, sin aplicar a ninguna base real.

En rama independiente de Uki: preparacion/uki-pago-declarado-seguimiento-20261124
La carta registra la *preferencia declarada* por el cliente, pero no la trata como pago verificado. La información histórica incompleta permanece pendiente de revisión.

## Validación
GitHub Actions ejecutó las reglas de seguimiento en datos ficticios. Última ejecución confirmada: 39 pruebas aprobadas, 0 fallidas, ID 45336068795. Prueba de Uki sobre preferencia de pago: ID 45335896039, satisfactoria. Estas validaciones NO equivalen a pruebas manuales en Safari/PC o a pruebas con bases reales.

## Bloqueos antes de activar
- No existen las nuevas variables de activación de seguimiento QA en los proyectos Vercel revisados.
- No se han provisionado ni verificado las dos conexiones aisladas para ejecutar migraciones de ensayo.
- Los datos bancarios reales de Santander (o cuenta aprobada) deben validarse EN CADA sucursal y guardarse sólo como secreto del servidor.
- Para Uki, faltan unir los montos de pago mixto validados del panel y la aceptación real; la preferencia del cliente por sí sola es insuficiente.
- Falta validar el proceso completo con personal autorizado y tres pedidos ficticios por local, incluyendo duplicados, reconexión, enlace vencido, respuesta de chat y confirmación manual bancaria.
- No se ejecutó SQL de escritura en producción, no se activó seguimiento público, no se modificaron pagos ni cierre/precierre.

## Regla de publicación
No fusionar, activar flags ni conectar a bancos o pedidos comerciales sin superar pruebas manuales y confirmar la publicación conjunta de las tres sucursales. No usar Meta para el chat: este canal es privado dentro de la carta/panel.
