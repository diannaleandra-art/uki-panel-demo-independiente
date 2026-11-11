# Romo · avance real hacia paridad operativa con Uki
**Fecha:** 2026-11-11
**Entorno:** rama `qa/uki-panel-unico-romo-serena-20261111` únicamente.
**Estado:** puente de datos y pruebas preparados; **NO OPERATIVO**, NO PUBLICADO.

## Qué pide la dueña (se mantiene exactamente)
Romo's Sushi La Serena (Balmaceda 1612) debe ser la TERCERA
sucursal del mismo panel Uki, con el mismo ingreso, las mismas
pantallas y TODAS las funciones que ya se operan en Uki Regimiento
Arica y Uki La Serena. No crear módulos de trabajo alternativos,
segundas contraseñas, menús especiales ni pasos extra.

Diferencias **solo de negocio/datos**, no de funciones:
- Romo: logotipo/colores y carta propia SIN pizzas.
- Precios de piezas Romo +$500 respecto a Uki, y promociones propias.
- Sucursales con pedidos, caja, clientes, inventario, cierre e
  historial separados (Romo nunca en tablas/colecciones Uki).

## Por qué se necesita el puente de almacenamiento
El panel Uki guarda una foto cifrada de sus pedidos, caja, ventas, clientes,
cierres, ajustes e historial por sucursal. La misma estructura debe servir
a Romo, pero NO se puede guardar Romo usando una rama "desconocida"
ni la colección `uki_operacion_v1` de los Uki.
También debe prevenirse que dos teléfonos reemplacen cambios mutuamente.

## Preparado en esta rama (SIN desplegar ni habilitar)
- `sql/20261111_romo_estado_operativo_v1_QA_NO_EJECUTAR.sql`
  define una foto cifrada por `romo:serena`, con revisión numérica,
  sin DELETE y con permisos técnicos mínimos. La migración **NO se ejecutó**.
- `lib/romo-estado-operativo-qa.mjs`:
  valida que el paquete cifrado pertenezca únicamente a
  `Romo’s Sushi La Serena`; lee y escribe con revisión CAS.
  No recibe el texto de la contraseña ni datos de pedidos descifrados.
  Roles agendador/dueños permiten estado operativo; rol inventario no
  puede leer ni modificar toda la caja.
- `api/romo-estado-operativo-qa.js`:
  API GET/POST del mismo proyecto Vercel que Uki,
  cerrada salvo `VERCEL_ENV=production`,
  `ROMO_OPERATIVO_LIVE_ENABLED=true`,
  origen exacto autorizado, base Neon `romos_sushi` con host propio
  y sesión Google firmada + UID/rol activo en Neon.
  En preview, de forma predeterminada y actualmente: 503.
  Conflicto entre teléfonos: 409, no reintenta sobrescribir.
- `firebase/uki-romo-operativo-qa.mjs`:
  cliente del MISMO panel, inactivo (`ROMO_OPERATIVO_ENDPOINT_QA=''`),
  preparado para reutilizar las funciones de CIFRADO y validación de
  estado ya existentes en Uki; nunca envía la contraseña.
- `firebase/uki-sushi-local.html` carga el módulo QA sin habilitar
  funciones de Romo y conserva intactos los dos accesos operativos Uki.
  **Sigue impidiendo registrar ventas Romo**, deliberadamente.
- Pruebas en `tests/romo-estado-operativo-qa.test.mjs`,
  `tests/romo-estado-api-cerrada-qa.test.mjs` y
  `tests/uki-romo-operativo-puente-qa.test.mjs`.
  Simulaciones dinámicas: 16 controles de estado y 12 de API correctos.
  No son pruebas reales contra Neon ni con iPhone.

## Bloqueos pendientes ANTES de cualquier venta Romo
1. Comprobar el inventario y carta pública Romo independientes, con
   los mismos formularios y reglas de permisos que Uki.
2. Verificar cómo las contraseñas EXISTENTES de Uki abrirán el mismo
   estado de Romo desde distintos teléfonos. Si ambas claves Uki son
   diferentes, preparar un mecanismo de cifrado compatible con ambas
   sin hacerlas llegar al servidor.
3. Ejecutar migración de tabla operativa en base Romo solo tras
   autorización explícita. Nunca tocar las tablas Uki.
4. Configurar y comprobar credenciales privadas Neon Romo en Vercel,
   y asignar el UID de Google autorizado tras validar su token real.
5. Integrar lecturas/guardados con los mismos eventos y controles de
   cierre del panel, garantizar que NO se puede cobrar sin guardado
   confirmado y no perder modificaciones históricas ni timbres.
6. Pruebas de dos teléfonos con pedidos y caja de demostración, conflicto,
   inventario, rechazo, timbres, cierre y recuperación. Corregir fallas.
7. Publicación final solo tras permiso de la dueña.

No hay usuarios, contraseñas cifradas inscritas, ni turnos Romo. No
presentar esta preparación como publicación ni como módulo listo.
