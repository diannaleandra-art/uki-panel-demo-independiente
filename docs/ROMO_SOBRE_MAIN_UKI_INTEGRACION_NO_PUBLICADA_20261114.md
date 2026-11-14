# Romo’s Sushi La Serena · Integración preparada sobre la versión más reciente de Uki

Fecha de preparación: 14 de noviembre de 2026. Rama interna: `preparacion/uki-romo-sobre-main-20261114`.

## Objetivo
Un solo panel, con Uki Regimiento Arica, Uki La Serena y Romo’s Sushi La Serena (Balmaceda 1612). Conservar absolutamente las funciones del código `main` de Uki del commit `a567f7a1c3a9dc37daf9c43f77da4964e87dee71` y añadir solo el acceso y el estado cifrado independiente de Romo.

## Qué se hizo en esta rama
- La rama fue creada **desde main actual**, no desde la versión antigua QA. Se conservan todos los módulos recientes de carta, inventario y caja de Uki.
- Se añadió la tercera sucursal al selector y al flujo de ingreso existente.
- Se añadió una clave de almacenamiento exclusiva para Romo; nunca usar la ruta `desconocida` de Uki.
- Se incluyó el adaptador cifrado `uki-v813-browser` con revisión y detección de conflictos, la verificación de la misma clave Uki y la lectura del catálogo Romo. No se creó un segundo panel.
- La conexión con los datos reales de Romo **está apagada**: `ROMO_OPERATIVO_ENDPOINT_QA`, `ROMO_PROOFS_ENDPOINT`, `ROMO_CLAVE_ALTA_ENDPOINT_QA` y `ROMO_CATALOGO_ENDPOINT_QA` permanecen vacíos.
- Las pantallas y sincronización Firebase de Uki conservan sus propias rutas. El panel Romo no puede habilitar ventas todavía. La prueba de contraseña local es la misma de Uki sin enviarla a ChatGPT ni a la base de datos.

## Lo que NO se hizo
- No se tocó `main`, la rama de pruebas anterior ni los enlaces comerciales de Uki y Romo.
- No se desplegó el panel, no se hicieron operaciones, pedidos, ventas o cierres de prueba y no se modificó ningún dato de Neon.
- No se ejecutaron tests automatizados: la propietaria requiere comprobar las funciones **manualmente** desde iPhone.

## Pendientes obligatorios antes de habilitar Romo
1. Completar la API privada Romo y su verificación del Google Firebase y permiso del dueño, sin configuración automática de secretos.
2. Enrolar el verificador cifrado de la clave **actual** Uki desde el iPhone de la dueña; no pedir ni guardar la clave en el chat.
3. Separar explícitamente los módulos de carta, inventario, pedidos, caja, cierres, timbres y delivery con storeId `romo:serena` y datos propios de Neon.
4. Comprobar el flujo real en Safari manualmente, incluyendo accesos, caja, cierres e integridad de las sucursales.
5. Solicitar autorización explícita para publicar una sola actualización consolidada, sin pérdida de funciones.

El estado presente es **código preparado, no integrado operativamente en producción**.
