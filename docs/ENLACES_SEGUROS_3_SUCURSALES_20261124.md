# Enlaces seguros de seguimiento - tres sucursales
Preparacion privada 24-11-2026. NO conectado a cartas ni paneles comerciales.
Las sucursales cubiertas son Uki Regimiento Arica, Uki La Serena y Romo Sushi La Serena.
El modulo emite una URL de pedido firmada y caducable (maximo siete dias) con identificador, tienda, 18 bytes aleatorios y huella SHA256. No contiene telefono, datos bancarios ni mensajes. No basta conocer el codigo del pedido.

Obligacion del backend: guardar pedido y huella de enlace confirmados en base de datos antes de entregar URL. En cada consulta se debe verificar firma, fecha, tienda, pedido, huella persistida y estado active. Cambiar la huella invalida enlaces anteriores; estado revoked permite anular un enlace.

PENDIENTE: tablas aisladas y permisos por tienda, emision despues de guardar pedido, asociacion a panel y chat, cuenta bancaria validada por local, transferencias mixtas, cierre bloqueado mientras transferencia sin verificar y pruebas MANUALES en QA antes de una sola publicacion.

La biblioteca NO crea tablas, NO cambia pagos, NO lee Santander ni publica enlaces. No usar con clientes sin persistencia y controles de permisos.
Pruebas automaticas de reglas: tests/seguimiento-enlaces-seguros-v1.test.cjs
