# Uki · publicación coordinada de promociones

**Estado:** preparada en QA; SIN autorización ni ejecución de publicación pública.

## Componentes existentes, no rehacer
- Carta pública de clientes y QR: `uki-sushi-pedidos.vercel.app`, producción en `a4bb973951e5a9e7739f52001ff4ccfb9cda6f14`.
- Servidor de catálogo/panel en Vercel `uki-sushi-inventario`, producción en `f5871792d28e758abd0cc110866a853e726133fe`.
- QA de carta: `diannaleandra-art/uki-sushi-respaldo`, `qa/uki-promos-tipos-producto-20261110`, probado en `9a64c918002693e26951c21fde5c18e1ff838a2e`.
- QA de panel/backend: `diannaleandra-art/uki-panel-demo-independiente`, `qa/uki-promos-tipos-producto-20261110`. Se conserva la carta actual, pagos, timbres, turnos y QR.

## Situación de la promoción real
- Regimiento Arica, SKU `monthly:super-gohan-clasico-mas-dos-korokes-6a5885b2`.
- Precio original $6.000; publicada; fotografía ya guardada. No borrar ni duplicar el SKU.
- La fila real tiene `roll_count=1`, `size=12`, `version=2`, error que la transforma en un roll ficticio.
- QA comprobó `promo_type='combo'`, `customizable=false`, `roll_count=0` y `size=0`.
- `korokes=0` en columnas técnicas para combos fijos; descripción debe decir «Incluye 2 korokes» para cliente y cocina. No altera el contenido ofrecido.
- La Serena permanece independiente.

## Orden obligatorio con autorización explícita antes de producción
1. **Preflight solo lectura:** confirmar SKU, versión, precio, visibilidad, foto, estado de QR, rama y commit final. Si cambió la versión, detener sin forzar cambios.
2. **Migración aditiva de esquema:** aplicar `migrations/2026-11-10-uki-promos-por-tipo-qa.sql` revisada, que agrega `promo_type` y `customizable`; las promos existentes quedan con tipo sushi hasta conversión individual. No toca ventas ni pedidos.
3. **Servidor compatible:** publicar únicamente los cambios de promociones del panel/backend probados en QA; no copiar toda la rama de pruebas porque contiene otras vistas, herramientas y funciones sin relación. Comprobar GET para las dos sucursales, autenticación y edición.
4. **Carta compatible y QR:** preparar despliegue de producción desde los cambios aprobados de carta. La versión de pruebas usa URL de Neon QA para sus previews, pero en `uki-sushi-pedidos.vercel.app` debe utilizar su backend de producción. Confirmar QR y carrito antes de modificar la promoción.
5. **Corrección exacta de Súper gohan:** solo tras confirmar compatibilidad, ejecutar con aprobación el archivo `migrations/2026-11-10-uki-super-gohan-conversion-APROBACION-PENDIENTE.sql`. Aborta si cambió versión, precio, foto o condiciones. Verificar $6.000, SKU, visibilidad, fecha original de publicación, foto y no duplicación.
6. **Comprobación pública:** iPhone Regimiento Arica: banner con Súper gohan, precio y fotografía, botón abre combo sin rolls; Frutilla $0 y Nuez +$500; comprobar que La Serena no comparte productos; QR recibe detalle y precio correctos. Verificar promoc. originales, retiro, WhatsApp, pagos y pedidos, sin crear ventas reales.
7. **Recuperación:** mantener registrados los dos deployments de producción anteriores y preservar una copia transaccional del registro de la promoción antes de convertirlo. Ante fallos, restaurar el par compatible panel/carta y comprobar la base; nunca ejecutar rollback de código desconectado de la versión de esquema.

## Límite conocido
El personalizador de algunas futuras promociones de gohan o pizza **aún no está implementado** como los productos originales. Los combos fijos sí están comprobados. No presentar esta posibilidad como publicada ni inventar opciones de armado.

## Pruebas aprobadas
- Panel/SQLite no: PostgreSQL local aislado, pruebas reales de promoción, esquema y QR; ciclo crear, publicar con foto, retirar y restaurar.
- La conversión de roll mal creado a combo conserva SKU, precio, fotografía, visibilidad, fecha y datos de otra sucursal; rechazo de actualizaciones con versiones antiguas.
- Safari/WebKit y Chromium móvil: selector de sucursal original, banner dinámico, fotografía real, carrito, QR y productos por sucursal.
- **No se ejecutaron estas operaciones en producción desde este archivo.**
