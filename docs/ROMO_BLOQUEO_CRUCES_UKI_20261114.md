# Protección cruzada Uki/Romo — actualización 14-11-2026

Rama interna `preparacion/uki-romo-sobre-main-20261114`.

**Motivo de seguridad.** En el panel original de Uki, varios módulos usan endpoints de Uki y, al recibir una sucursal que no reconocen, algunos la interpretan como `arica`. Si la tercera sucursal Romo heredara esas llamadas, un pedido, inventario o caja podría ser leído o alterado en el local Uki equivocado.

Se añadieron bloqueos **solo cuando `S.suc === 'Romo’s Sushi La Serena'`**, sin modificar el comportamiento de Uki Regimiento ni Uki Serena:
- `firebase/uki-inventario-admin-embebido.js`: bloquear solicitudes al inventario de Uki.
- `firebase/uki-caja-acumulada-admin.js`: bloquear lecturas y escrituras de caja acumulada de Uki.
- `firebase/uki-disponibilidad-admin.js`: bloquear la disponibilidad de Uki.
- `firebase/uki-carta-precios-admin.js`: bloquear acciones de precios y carga de fotos de Uki.
- `firebase/uki-armado-ingredientes-admin.js`: bloquear edición/consulta de ingredientes de Uki.
- `firebase/uki-carta-remotas-panel.js`: bloquear acceso al token que usa la API de recepción de pedidos de Uki.
- `firebase/uki-sushi-local.html`: la sesión remota Romo exige que el verificador de la contraseña habitual de Uki esté **registrado y validado remotamente**, no basta con una copia local.

**Estado:** las APIs preparadas de Romo están limitadas a preview de la rama y siguen apagadas por banderas/variables ausentes. El bloqueo evita usar Uki como ruta alternativa. **No sustituye** la implementación de los módulos equivalentes de Romo: inventario, fotos, promos, timbres, caja y recepción siguen pendientes de una conexión exclusiva, previa revisión manual en el iPhone.

La carta pública de Romo, `main` de Uki y la base de datos de ambas marcas continúan intactas. No se realizaron pruebas automatizadas.
