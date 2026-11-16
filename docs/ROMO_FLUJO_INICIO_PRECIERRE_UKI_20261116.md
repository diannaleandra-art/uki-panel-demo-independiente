# Romo — mismo flujo de inicio y precierre aprobado en Uki
Fecha: 16-11-2026. Referencia: firebase/uki-sushi-local.html (main, Uki oficial).
Rama: preparacion/uki-romo-sobre-main-20261114.

## Diferencia funcional corregida
La copia Romo ocultaba Inicio y empezaba en Pedidos. Al mostrar Inicio, su botón de inicio de trabajador conservaba el guardado local de Uki, que está expresamente inhabilitado en Romo y por tanto no confirmaría el turno. El precierre Romo se iniciaba desde Caja, a diferencia de Uki.

## Cambios de réplica
- Entrada Romo abre la misma pestaña Inicio que Uki; su navegación incluye Inicio, Pedidos, Nuevo, Timbres y Caja, con inventario/promos ya existentes.
- Los accesos rápidos Inicio → Precierre/Cierre/Historial redirigen a las pestañas correspondientes de la caja Romo sin activar las API ni el almacenamiento de las sucursales Uki.
- Inicio presenta la misma tarjeta de turno del trabajador. Si aún no se abrió Caja real, dirige a la apertura confirmada Romo; nunca crea base presunta.
- El botón de inicio usa ukiRomoIniciarTurnoTrabajadorQA: copia cifrada + guardado CAS de Neon Romo, NO ukiIniciarPrecierre (local Uki).
- Después de confirmar inicio de turno se permanece en Inicio, como en Uki; puede pasarse a Precierre desde la misma tarjeta, que abre Caja → Precierre.
- Sin trabajador iniciado, Caja → Precierre devuelve a Inicio, como en Uki. Los precierres guardan fecha, responsable, fotografía y diferencia sin cerrar el día, y permiten iniciar posteriormente otro trabajador.
- No se alteran datos, importes, permisos, timbres, cierres, inventario ni los dos locales oficiales de Uki.
- Se mantiene el acceso de dueños actualmente conectado en Romo; no se inventa un PIN nuevo de caja. El PIN independiente de inventario sigue siendo distinto.

## Pendiente de verificación
Validación manual obligatoria en iPhone: entrar a Romo → Inicio → abrir caja real si hace falta → registrar primer trabajador → Caja → Precierre (conteo físico) → Inicio → segundo trabajador → otro Precierre → cierre definitivo. Comprobar mismas vistas, mismo historial y datos exclusivamente Romo. Prohibido crear pedidos o cierres ficticios.
Sin publicación a producción y sin prueba automática.
