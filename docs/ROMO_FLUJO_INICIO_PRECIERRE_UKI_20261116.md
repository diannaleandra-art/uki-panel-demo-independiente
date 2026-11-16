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

## Continuidad de cierre nocturno y turno de trabajador — 16-11-2026

Comparado con la apertura real de Romo y el cierre oficial de Uki, se repararon exclusivamente en la rama de preparación los siguientes desajustes, sin funciones nuevas, sin despliegue ni movimiento de fondos:

- **Jornada nocturna:** `prepararAperturaTurnoRomoQA` ya admite abrir con la fecha operativa local del día en curso o del anterior. Los validadores del resumen de cierre (`public/romo-panel-qa/uki-romo-resumen-duenos-qa.mjs`), de la constancia Neon (`lib/romo-cierre-constancia-qa.mjs`) y del registro de Mi Administración (`lib/romo-cierres-duenos-repositorio-qa.mjs`) ahora aplican la misma regla. Se calcula la fecha en `America/Santiago` mediante `formatToParts` y se conserva el día operativo del turno: no se trasladan ventas a otra jornada. Commits `0e201545`, `74c9b956`, `8580a95d`.
- **Trabajador y precierre:** `public/romo-panel-qa/uki-romo-cierre-definitivo-qa.mjs` ahora limpia `turnoPrecierreAbierto` al cerrar la caja, igual que el cierre oficial de Uki, y lo inicializa vacío en la siguiente apertura. Conserva íntegra la lista de precierres realizados: el cierre NO fabrica un precierre. Commit `64498219`.
- **Revisión estática de timbres:** el flujo existente exige confirmación manual de WhatsApp, conserva la marca de enviado por pedido y bloquea el segundo envío; la entrega y el cierre verifican timbres pendientes de compras pagadas. No se modificó por falta de una diferencia comprobada con la regla aprobada; requiere prueba manual.
- **Comprobación de aislamiento:** la rama `main` de Uki permanece en `3274dbc1b66b676663b74d74ae40f84d251b3ee9`. En la base principal `romos_sushi` siguen sin instalarse las tablas opcionales de rectificación y no hay cierres originales; las pruebas SQL fueron únicamente en la rama Neon de prepublicación.

**No declarar terminado** el circuito sin prueba manual con iPhone y dueña: apertura real, trabajador 1, precierre, trabajador 2, otro precierre, pedido real, timbre WhatsApp, cierre definitivo, comprobante, importación a Mi Administración, y revisar los dos pedidos de carta que siguen pendientes sin aceptarlos/rechazarlos automáticamente. Mantener una sola publicación conjunta.
