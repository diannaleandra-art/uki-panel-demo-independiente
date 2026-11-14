# Bloque siguiente: protección de primera apertura Romo (14-11-2026)

**Alcance**: rama `preparacion/uki-romo-sobre-main-20261114`, únicamente vista previa.

## Resultado manual previo
- La dueña comprobó desde Safari acceso Google + clave cifrada vinculada + conexión independiente.
- Neon Romo tiene 1 verificador de clave (Uki Serena), 0 filas de estado operativo.
- No hay caja ni pedidos inicializados; no se han registrado movimientos reales.

## Riesgo corregido en preparación
El panel existente llama a `guardarEnLocalStorage()` durante `render()`, y la apertura de Romo establece `vista:"inicio"` a partir de un estado inicial `vista:"pedidos"`. Si en el futuro se enciende la conexión operativa, este cambio visual podía generar un primer estado cifrado remoto **sin confirmación manual**.

Defensas en profundidad:
1. Si el GET operativo devuelve `revision=0`, el panel cierra la sesión interna preparada, **no establece S.suc** y muestra un aviso de inicialización pendiente, sin invocar guardado.
2. El adaptador `crearSesionPanelUnicoRomoQA.guardar` rechaza `revision=0` (ambas copias lib/public).
3. La API rechaza POST de revisión cero si `ROMO_ESTADO_INICIALIZACION_QA_ENABLED` no está específicamente habilitada.
4. Se mantienen apagadas `ROMO_ESTADO_CIFRADO_QA_ENABLED`, `ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED`, `ROMO_ESTADO_INICIALIZACION_QA_ENABLED` y el endpoint operativo del navegador.
5. Ningún cambio en `main`, carta pública Romo, datos Uki ni registros Neon.

## Siguiente implementación pendiente
Crear una operación **explícita de inicialización cifrada de caja vacía** con confirmación de dueños; sólo entonces conectar la navegación y guardado atómico por sucursal. Después comprobar manualmente en iPhone los módulos de pedidos, caja, inventario, timbres, cierres y delivery, siempre con datos Romo separados y sin repetir las pruebas de acceso ya aprobadas.

**No se ejecutan pruebas automáticas ni se autoriza producción mediante este cambio.**
