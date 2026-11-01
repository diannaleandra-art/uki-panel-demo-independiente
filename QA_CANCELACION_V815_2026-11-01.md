# Uki Sushi · Panel v8.15 LOCALES · cancelación de pedidos

**Estado: preparación en rama separada. No publicada en la versión que usan los locales.**

La mejora corresponde a la pantalla fotografiada: «Uki Sushi · Panel v8.15 · LOCALES», código `firebase/uki-sushi-local.html`, **no** al panel simplificado de Neon/Netlify ni al PR #21 del otro repositorio.

## Flujo propuesto en el panel existente
1. Abrir sucursal autorizada y comprobar «Nube: sincronizado».
2. Entrar a **Revisar pedidos** y desplegar un pedido pendiente del turno.
3. Elegir **Lo canceló el cliente** o **Lo canceló el local**.
4. Pulsar **Cancelar pedido** y confirmar.
5. El pedido continúa en el historial con estado `Cancelado`, `motivoCancelacion` y `canceladoEn`.

## Límites
- Únicamente pedidos no pagados, pendientes, sin premio y del turno **aún abierto**.
- No se pueden cancelar pedidos de otra sucursal, ya cancelados ni cuando la nube está bloqueada.
- El botón de editar y el de cambiar pago desaparecen para pedidos cancelados, y las operaciones internas también impiden modificarlos.
- **No se elimina el pedido** ni se altera su importe original. El cálculo vigente de `totales()` ya excluye los cancelados de ventas, caja y delivery.
- Los pedidos pagados, con timbres o cierres guardados necesitan un flujo separado de devolución o ajuste contable: no se hace automático.
- La función no abre WhatsApp ni registra ventas reales de prueba.

## Comprobaciones efectuadas
- La sintaxis JavaScript del script principal se analizó correctamente.
- 12 pruebas simuladas de la función pasaron: cliente, local, motivo no admitido, motivo omitido, pagado, cancelado previamente, turno cerrado, premio, sucursal diferente, nube bloqueada, rechazo de confirmación y pedido entregado.
- No se ejecutó ninguna cancelación sobre Firebase, pedidos existentes ni datos reales.
- La implementación está en una rama de un repositorio GitHub **público**; no se agregaron credenciales ni registros de clientes.

## Pendiente antes de habilitar en los locales
- Ejecutar pruebas visuales móviles de una **copia controlada sin datos reales**.
- Revisar integración con auto-guardado de Firebase y cómo se maneja un error/conflicto durante cancelación.
- Confirmar que cierre, timbres y totales quedan coherentes con datos ficticios y después autorizar explícitamente el despliegue del panel operativo.
- No fusionar la rama ni cambiar GitHub Pages/producción sin autorización.
