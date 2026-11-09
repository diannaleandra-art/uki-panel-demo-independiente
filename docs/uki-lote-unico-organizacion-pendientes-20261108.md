# Uki Sushi · Lote único de organización del panel (8–9 noviembre 2026)

**Estado actualizado:** el lote de organización del PR #39 fue publicado y comprobado en GitHub Pages. Las correcciones posteriores de timbres/cierre están solo en QA PR #40, sin publicación ni cambios de datos reales.  
**Destino:** panel operativo ya utilizado en Regimiento Arica y La Serena, misma URL, mismo sistema y permisos vigentes.  
**Referencias de código:** PR #39 ya integrado; PR #40 abierto para Timbres y cierre rectificado. Otras ramas de QA se relacionan por finalidad, **no deben fusionarse a ciegas**.

## A. Organización y corrección incorporadas en esta rama de panel (PR #39)

1. **Responsable de edición obligatorio**: cualquier cambio directo de pedido del turno abierto obliga a escribir quién lo hizo; no se autocompleta con el titular del turno. No guardar si falta; conservar hora, nombre y fotografía anterior/posterior del pedido.
2. **Historial de ediciones legible**: en detalle del mismo pedido, mostrar responsable, fecha, total anterior/nuevo, medio de pago y, cuando varían, lista de productos antes/después; mostrar diferencias de cobro pendientes. Los movimientos históricos existentes se conservan, sin inventar responsables.
3. **Inicio más limpio**: las acciones cotidianas (Pedidos, Nuevo, Inventario, Timbres, Caja, Historial y Reportes) preceden a la administración avanzada; fecha de inicio del turno y acceso de jefes quedan en apartados plegables. No crear otro panel ni alterar claves.
4. **Pedidos por prioridad**: conservar arriba las solicitudes nuevas por confirmar, con su identificación y aviso visual, separadas de ventas y de la caja; filtros frecuentes primero (Todos, Solicitudes por confirmar, Por entregar, Por cobrar, Pagados), otros estados en “Más filtros”, sin eliminar ninguno.
5. **Rechazados antiguos en Historial**: dejar de mostrar el archivo de jornadas anteriores en el área operativa de Pedidos. Consultarlo en Caja → Historial con calendario, conservando motivos, fecha, cliente, productos y mensaje original; sin contabilizar como venta o borrar nada. Los rechazados del día siguen accesibles en su filtro.
6. **Dos pedidos en atención desde un dispositivo**: opción compacta «Dejar abierto y atender otro»; los borradores no suman ni cobran; la solicitud retenida conserva su identificación WhatsApp/carta. El siguiente pedido no hereda el origen del anterior; las solicitudes pausadas no se duplican como recién llegadas.
7. **Rechazar limpia el pedido en atención**: al confirmar un rechazo de WhatsApp, retirar el borrador vinculado, conservando el antecedente; si falla guardar, restaurar el estado anterior. No retomar solicitudes ya aceptadas o rechazadas.

**Comprobación:** pruebas automáticas del código actualizado de pedidos, QR, caja y organización en la misma rama. Esto es QA, **no prueba de producción en un iPhone**.

## B. Ya presente en el panel oficial: conservar, verificar visualmente, NO duplicar

- Misma administración por sucursal y mismos formularios existentes de pagos mixtos, productos, delivery y pagos recibidos en otro local.
- Pedido con bloques «1 · Cliente y entrega», «2 · Productos y total», «3 · Pago del pedido», edición del mismo # sin otro cobro, correcciones con caja abierta; cobros QR nuevos se validan por cuenta original.
- Categorías operativas diferenciadas: «Solicitudes por confirmar», «Por cobrar», «Por entregar», «Entregados», «Cancelados», «Pagados», «Con error». El motivo debe elegirse **antes** de pulsar Rechazar.
- Precierre trabajador y cierre definitivo separados; fecha operativa del turno prevalece aunque el cierre se haga después de medianoche; reportes por día, semana y mes; medios de pago y gastos por concepto; entregas de repartidor del turno y pago de saldos anteriores.
- Delivery manual a pagar al repartidor, sin sumarlo indebidamente como efectivo ingresado; caja de Uki no suma cobros hechos en otros locales. No restaurar el bloque de «delivery externo» que la dueña pidió retirar.
- Acceso a Inventario y carta desde el panel principal, inventario trabajador en su acceso separado; agotado/disponible siempre manual e independiente del stock.
- Pedido QR y solicitud de carta no deben duplicarse por aceptar y además registrarlos manualmente. El sistema de QR/WhatsApp del panel no equivale a una conexión automática gratuita a WhatsApp Business.
- Panel de jefes/Mi Administración **ya existe**, no rehacer ni otorgar sus permisos al agendador.

## C. Acuerdos de organización todavía ligados a otras ramas, servicios o pruebas

Estas mejoras quedan **reunidas como pendientes coordinadas**, no afirmadas como implementadas en PR #39:

1. **Carta y precios con acciones juntas:** «Agregar producto», «Agregar ingrediente al armado», editar precios, disponible/agotado y promociones en el panel actual, sin pantallas duplicadas. La relación debe ser independiente por sucursal y reflejarse en la carta correcta.
2. **Productos y promociones con fotos desde iPhone:** agregar/editar/retirar/restaurar productos y promociones (incluyendo imagen o banner, cantidades, salsas/korokes cuando aplique), sin borrar pedidos históricos; fotos por sucursal. Requiere API, Neon y carta pública compatibles. Referencias: PR #35, release `uki-mejoras-lote-20261108`.
3. **Carta cliente pendiente:** Frutilla en sucursal Regimiento Arica, envolturas mixtas según los acuerdos del armado, y envío completo del pedido para delivery con tarifa «por confirmar» al superar el límite. **No es un cambio exclusivo del HTML del panel**; no publicar carta unilateralmente ni reemplazar QR impresos.
4. **Timbres y ficha del cliente:** permitir completar WhatsApp/código desde la propia tarjeta del cliente sin perder timbres ni combinar personas distintas; distinguir «abrir WhatsApp» de «timbre realmente enviado». Referencia: PR de QA #31. No inventar confirmaciones automáticas de entrega.
5. **Inventario del personal/administración:** claridad de buscador, agregado/duplicados, unidad kilo/gramos/litros y valores decimales, fecha/hora Chile, revisión por turno y reporte exportable; solo trabajadores designados, sin permitirles ver cierres ni editar precios. No mezclar stock con agotado manual. Mantener el mismo portal donde se acordó.
6. **Prevención de duplicados entre dos equipos**: la pausa local aprobada en A no sustituye la reserva central. Requiere backend y prueba de dos dispositivos/Firebase/Neon antes de activar. Referencias PR #29/#32; no publicar media solución.
7. **Caja acumulada en efectivo:** saldo por sucursal, arqueo y movimientos auditables en el portal actual, sin otra contraseña. No sumar cierres anteriores sin conciliación ni descontar gastos dos veces. Requisitos en `docs/uki-caja-acumulada-en-efectivo.md`; integrar solo tras pruebas reales y aislamiento.
8. **Ventas resumidas en Mi Administración:** recepción automática por sucursal sin duplicarlas con ventas manuales; solo lectura hasta conciliar; proyecto privado de administración. Referencia PR #36 QA, no mezclar con la caja operativa.

## D. Condiciones para la publicación única

- No fusionar ni desplegar por la mera existencia de este documento. PR #39 ya se publicó; PR #40 y las otras preparaciones necesitan autorización explícita de publicación.
- Verificar que las pruebas sean de la última versión y que no se pierdan cambios posteriores del panel oficial.
- Si se publican funciones de **carta/fotos/ingredientes**, la secuencia es compatible con backend/API → carta de clientes → panel administrativo; las migraciones deben ser aditivas y autorizadas. Si alguno falla, detener publicación, no tocar registros reales.
- El lote de **organización del panel** del PR #39 ya está integrado. No re-publicarlo ni introducir API/carta que aún necesitan validación conjunta.
- No cambiar ni borrar ventas, caja, cierres antiguos, timbres ni su historial, folios, pedidos QR, inventario, disponibilidad, credenciales o enlaces existentes por reorganizar botones.
- Mantenerlo **limpio, claro y sencillo desde iPhone**; no añadir secciones repetidas ni obligar al agendador a repetir datos ya introducidos.
- Probar en Safari con ambas sucursales; verificar el registro del responsable y su historial sin crear pedidos reales de prueba ni modificar el #244 ya corregido.

## E. Ajustes solicitados el 8 de noviembre · lote de UI, timbres y cierre

**Preparados en QA PR #40 (aún no publicados):**

1. **Timbres por venta**: orden del más reciente al más antiguo por hora real de Chile, mostrar todo el día calendario incluyendo turnos cerrados, una fila por compra, total pendientes/enviados, no confundir 21 movimientos con 21 tarjetas. Detectar pedidos pagados sin movimiento de timbre, **sin crearles timbres automáticamente**.
2. **Timbre obligatorio en el mismo pedido**: si se confirma pago y el cliente tiene WhatsApp, preparar mensaje con saldo +1, abrir WhatsApp, exigir declaración explícita de que el agendador lo envió y luego habilitar guardado; sin WhatsApp no bloquear. Guardar marca con nombre, fecha y pedido. Editar una venta antigua pagada no fuerza doble envío. Sin API de Meta no se puede probar la entrega real.
3. **Conteo físico**: en precierre de trabajador y cierre definitivo se exige importe contado, se acepta $0; preservar montos ya archivados y no mover el corte por medianoche.
4. **Cierre rectificado por pedido olvidado**: la corrección histórica incorpora origen, monto, medio, efectivo, reparto, fecha, responsable y motivo. Se genera un **informe vigente** con pedidos y cobros adicionales, sin agregar otro movimiento a la caja ni insertar un segundo cierre físico. El documento original permanece accesible únicamente como respaldo de auditoría. Los importes de otro local y el delivery por conciliar permanecen separados.
5. **Hora exacta** del cierre guardado en Historial, WhatsApp y PDF.
6. **Acciones al final del cierre**: WhatsApp, CSV compatible con Excel y PDF real del informe guardado/rectificado; retirar el botón engañoso «Descargar cierre TXT» de esa sección. El cierre rectificado se puede volver a compartir. No mandar el cierre original por error.

**Implementados también en QA PR #40, sin publicar (9 de noviembre):**

7. **Detalle de pedidos (QA)**: mostrar kilómetros de recorrido, propina y valor (si existe), usando los datos realmente registrados; no inventar distancias.
8. **Propinas manuales (QA)**: concepto + pedido correspondiente, y reporte diario, semanal y mensual separado de la caja de ventas, sin doble conteo.
9. **Inicio (QA)**: frase que cambie diariamente, hora/día/fecha junto a «Hola Uki» y retirar «Información de turno» redundante, **conservar los controles reales de iniciar turno/precierre**.
10. **Pedidos (QA)**: hacer la parte de filtros, solicitudes, mesas e incidencias de la segunda captura más compacta y fácil de entender en iPhone sin ocultar urgencias.
11. **Navegación (QA)**: accesos rápidos para subir/bajar sin deslizar mucho; selector compacto para Caja, Caja acumulada y las subsecciones de Movimientos.
12. **Validación**: revisión visual y operativa en Safari de ambas sucursales. La revisión individual de los 21 timbres se pospone expresamente por decisión del usuario; no afirmar que esos registros reales están conciliados.

**Condición de publicación**: los puntos de código del lote (timbres, cierre, propinas, km, Inicio, filtros y navegación) están implementados en PR #40 y cubiertos por pruebas automáticas. Sigue **pendiente la validación visual y operativa real en Safari/iPhone para ambas sucursales, sin incluir por ahora la conciliación de los 21 timbres (pospuesta a solicitud del usuario)**. Las pruebas no prueban entrega real de WhatsApp ni acceso a datos cifrados de producción. No publicar ni fusionar sin autorización nueva y explícita; no tocar datos reales ni facturación para probar.


## F. Precauciones verificadas antes de publicar

- Propina manual: exige concepto, monto, medio y referencia inequívoca. Si coinciden un ID interno y una Carta con el mismo número, pide especificar `Carta 457` o `Interno 244`; no asignar la propina al cliente equivocado. Bloquea un segundo registro ya vinculado y pedidos cerrados.
- Kilómetros: campo informativo opcional en un delivery; si la carta enviaba la distancia explícita se puede leer, de lo contrario se muestra **Km sin registrar** sin inventar mediciones. El precio del delivery no se recalcula.
- Inicio: reloj local chileno y frase distinta por día calendario (la jornada operativa sigue hasta confirmar cierre). No se elimina el inicio de turno del trabajador.
- Navegación: selectores compactos en Caja y Movimientos, acciones para ir arriba/abajo con iPhone. No se elimina ningún botón operativo.
- Reportes: propinas desde la fuente original, con filtros día/semana/mes, sin sumar totales del cierre como movimientos adicionales. Reportes de ventas usan una versión vigente de cada cierre, sin sumar ajustes dos veces.
- Seguridad: registros antiguos sin kilómetros, concepto o vínculo deben identificarse como tales; no modificar silenciosamente historial.


**Ajustes de seguridad en QA, 9 noviembre:** se bloquea añadir una propina en la edición si el mismo pedido ya tiene una propina manual; la tarjeta incluye propinas manuales sin duplicar el registro automático. El reporte permanece abierto al cambiar entre día, semana y mes. El ingreso de un pedido olvidado permite dejar en blanco (equivalente a $0) el delivery cobrado en Uki cuando lo cobró íntegramente otro local. Último conjunto de 96 pruebas automáticas aprobado; **esto no sustituye una revisión visual real ni verifica el envío de WhatsApp**.
