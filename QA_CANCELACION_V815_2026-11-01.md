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

## Revisión adicional de código y sincronización

- Simulación de la interfaz `vPedidos()`: botón y selector solo para pendientes elegibles; estado y motivo de cancelación visibles; botones editar/pago bloqueados en pedidos cancelados.
- Simulación de `totales()`: tras cancelar un segundo pedido sin pagar, ventas cobradas y delivery permanecen iguales, desciende la cantidad de pendientes, y aumenta el conteo de cancelados; sin repercutir en caja.
- Se fortaleció `cancelarPedido` para esperar el guardado cifrado local y revertir la modificación si Safari informa un fallo, sin declarar éxito prematuramente. La interfaz pide comprobar «Nube: sincronizado» antes de abandonar el panel.
- 13 escenarios de lógica de cancelación y error de guardado ejecutados con datos ficticios, todos aprobados.
- Se ensayó el módulo real de autoguardado `uki-sushi-autoguardado.js` con Firebase **simulado**: una confirmación remota eleva la revisión y devuelve «sincronizado», mientras que un conflicto detiene nuevos guardados y marca «conflicto». No se utilizó la base Firebase real.
- Aún **NO** se probó la versión publicada desde iPhone, ni se ha demostrado un guardado real en Firebase con esta función. Tampoco se modificaron datos de clientes, cierres, pagos ni timbres reales.
- El archivo HTML de la rama mantiene la conexión Firebase existente, por lo que **no debe publicarse como vista previa que se conecte a datos reales** sin neutralizar la escritura de pruebas y revisar controles de acceso.

## Prueba adicional del protocolo de Firestore con simulador — 2026-11-01

- Se ejecutó `crearSnapshotsUki` del código existente, junto con los módulos reales `dividirEstado`, `reunirEstado` y `crearAutoGuardadoOperativo`, reemplazando las llamadas a Firestore por un almacén simulado en memoria y el cifrado por un *codec* ficticio. **No se probó el cifrado AES ni se accedió a Firebase real.**
- Se guardó un pedido ficticio pendiente de Regimiento Arica con revisión 1; posteriormente se simuló su cancelación por `cliente`, la sincronización automática generó revisión 2 y al volver a cargar se recuperó el estado `Cancelado`, el motivo y la fecha.
- Se guardó una segunda sucursal ficticia y se comprobó que permaneció `Pendiente`, sin recibir la cancelación de Arica.
- Se intentó escribir una revisión vieja (1) sobre la revisión 2: la función devolvió `CONFLICTO` y la cancelación permaneció guardada sin sobrescritura.
- La comprobación fue **100 % simulada, sin red ni producción**, y se completó satisfactoriamente.
- El backend real y el acceso multiusuario sobre Firebase están pendientes de una prueba aislada y expresamente autorizada. **No habilitar la función operativa ni fusionar la rama antes de comprobar esta parte.**
