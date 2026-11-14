# Romo La Serena — primera vista preliminar del panel único, solo lectura

Fecha: 14-11-2026. Rama: `preparacion/uki-romo-sobre-main-20261114`.

La dueña confirmó manualmente desde Safari la lectura cifrada AES-GCM del estado independiente de Romo (revisión 1, 0 pedidos, 0 cierres, base y caja chica $0). No repetir las pruebas de Google, respaldo, vinculación ni recuperación de estado.

## Preparación completada
Se agregó **Ver Romo en modo consulta (sin ventas)** en el acceso ya existente, dentro de `public/romo-panel-qa/index.html` (no crea otro panel ni requiere otro login). Reutiliza la misma validación Google y clave remota y la recuperación cifrada desde `/api/romo-estado-cifrado-panel-qa` por **GET**. Descifra solo en Safari, muestra contadores derivados de pedidos, cierres, gastos, propinas, delivery manual y caja. Además consulta `ukiRomoCatalogoLeerQA` con autorización para mostrar cantidad de categorías/productos/ingredientes/promociones de Romo, sin cambiar la carta.

**Seguridad de la vista:** no establece `S.suc`, no abre `entrarSuc`, no llama `guardarEnLocalStorage`, no produce POST, no inicia sesión operativa ni expone datos personales. Solo mantiene cantidades y dos importes iniciales en memoria efímera de la pestaña; se limpian al salir. El panel principal de Uki no se toca y los controles de pedidos/caja no están disponibles en la vista. Inventario y timbres se marcan pendientes (no se inventan números).

La recuperación anterior sigue disponible. `ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED` permanece deshabilitado y el endpoint del cliente operativo sigue vacío. Ningún cambio a `main`, a producción o a tablas de Neon.

## Paso posterior
Tras comprobar manualmente la vista desde Safari, terminar el puente de escritura exclusiva Romo con confirmación CAS, bloqueo de Firebase/Uki y rutas de inventario/timbres; probar por módulos sin ventas reales y autorizar publicación consolidada.
