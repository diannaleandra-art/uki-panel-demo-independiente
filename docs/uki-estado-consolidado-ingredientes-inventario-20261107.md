# Uki Sushi · Control de publicación (7 noviembre 2026)

Este archivo consolida el estado del trabajo de Uki para evitar repetir cambios o publicar funciones incompletas.

## Ya está en el panel operativo

- Recepción de solicitudes de la carta normal en **Pedidos → Pendientes**, con confirmación/rechazo separado de caja.
- Tarjetas compactas: **Motivo del rechazo → Rechazar solicitud**; **Aceptar y revisar** independiente.
- Inventario integrado en el panel actual, con acceso separado y restringido del trabajador; disponibilidad manual.
- Carta y precios, revisión de existencias, reportes e historial existentes.

**No reconstruir ni duplicar la carta, formulario de pagos, medios mixtos, pedidos QR, cierres ni caja acumulada.**

## Preparado en pruebas, pero aún no habilitado para clientes

**Panel y backend de ingredientes:** `diannaleandra-art/uki-panel-demo-independiente`, rama:
`feature/uki-ingredientes-armado-integracion-completa-2026-11-07`

**Carta y comprobación de importes QR:** `diannaleandra-art/uki-sushi-respaldo`, rama:
`feature/uki-ingredientes-armado-carta-2026-11-07`

La nueva pantalla **Administrar ingredientes del armado**, dentro de Carta y precios, permite:
- Crear y editar vegetal/proteína/envoltura sin agregar un producto independiente.
- Marcar **incluida = $0** o indicar un recargo exacto.
- Elegir preparaciones compatibles y sucursal.
- Desactivar/disponibilizar manualmente, sin depender del stock.
- Actualizar opciones de sushi clásico/premium, promociones, handrolls, Sushi Burger y Gohan.

Validaciones: precios anteriores conservados sin cambios; se cobra un recargo nuevo aunque el ingrediente estuviese antes incluido; 40 solicitudes QR simultáneas no cruzan valores entre las dos sucursales; editor oculto mientras la API no esté habilitada.

## Inventario del trabajador

- El trabajador usa el enlace y PIN exclusivo del inventario.
- Su menú sólo cuenta, recibe mercadería y guarda revisión para administración/WhatsApp.
- La administración consulta esas revisiones desde el panel actual; no se concede acceso a caja al trabajador.
- **Revisión de datos del 7/11/2026:** la base operativa aún tenía **0 revisiones, 0 artículos y 0 movimientos**, por lo que NO se ha demostrado un envío real de inventario hasta recibir uno de un trabajador.
- Se simplificó visualmente la portada de inventario, con un solo enlace de acceso del trabajador, en la rama de pruebas.

## Puertas de seguridad antes de activar

1. Vercel: bloqueó un nuevo despliegue por el límite diario gratuito (HTTP 402), sin contratar plan ni modificar facturación.
2. Verificar una versión de pruebas de la carta en Safari/iPhone con el servidor aislado Neon QA.
3. Verificar envío de un conteo de trabajador al panel (no tiene por qué cambiar disponibilidad de la carta).
4. Probar desde Carta y precios una opción de ejemplo (p. ej., Frutilla incluida en clásico en Regimiento), confirmar que NO aparece en la otra sucursal; después recargo elegido por la administradora, carrito y mensaje WhatsApp.
5. Solo después de las pruebas: preparar migración aditiva para la rama productiva Neon; publicar backend, panel y carta compatibles; encender `UKI_INGREDIENTES_ARMADO_ENABLED` únicamente cuando la API y la tabla estén listos. No habilitar cada pieza aisladamente.
6. Volver a comprobar pedidos QR, inventario, pagos mixtos, timbres y cierres. No tocar caja/ventas existentes.

**Estado:** funciones de pedidos publicadas; administrador de ingredientes preparado y probado pero **NO activado en producción**. No prometer publicación ni fechas mientras Vercel mantenga el bloqueo.
