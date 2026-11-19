# Romo Sushi — paridad funcional obligatoria con Uki (QA)

**Fecha de revisión:** 2026-11-18. **Estado:** NO APROBADO COMO COPIA EXACTA.

## Contrato de alcance
Romo Sushi debe utilizar las mismas funciones, pasos, pestañas y comprobaciones que el panel aprobado de Uki, con únicamente marca, colores, carta comercial y almacenamiento/usuarios por sucursal independientes. No alterar Uki, sus pedidos, caja, cierres o tarjetas. No anunciar ni operar Romo con público antes de verificar la paridad.

## Fuente de verdad
- La referencia funcional es el panel de Uki ya aprobado, no una reconstrucción desde conversaciones.
- El archivo actual de Romo `public/romo-panel-qa/index.html` contiene buena parte de la interfaz de Uki, pero tiene desvíos condicionales de Romo.
- Proyecto QA Romo: `romos-sushi-panel`, rama `qa/romos-panel-v816`.
- Base aislada Romo: `romos_sushi`, sucursal `romo:serena`; no trasladar datos de Uki.

## Estado del cotejo (evidencia en código)
| Área | Estado | Evidencia y acción exigida |
|---|---|---|
| Formulario Nuevo: subtotal y propina | Presente | `vNuevo` y `ukiPropinaUI`; comprobar equivalencia visual |
| Pago completo, mixtos y otro local | Ocultación CSS CORREGIDA en QA | Antes: `body.romo-operativo-preparacion #ukiPagoPedidoSoloUki{display:none!important}`. Ahora visible; test `tests/romo-paridad-visual-uki.test.mjs`. Falta ensayo integrado en iPhone de una operación auténtica |
| Guardado atómico pago pendiente/confirmado | Pruebas de código aprobadas, no producción | `ukiRomoGuardarPedidoPendienteQA` y `ukiRomoAceptarSolicitudCartaQA` mantienen CAS Neon independiente; evitar duplicados y cobros ficticios |
| Pedidos y estados | Pendiente de paridad íntegra | `vPedidos` en Romo retorna `ukiRomoPedidosPendientesHTMLQA()` en vez del flujo de Uki. Comparar cada control, cancelación, edición y timbres |
| Caja (resumen, movimientos, precierre, cierre, historial, reportes, acumulada) | Pendiente de paridad íntegra | `vCaja` deriva a `ukiRomoCajaPestanasQA()`, no directamente al flujo de Uki. Auditar operaciones y equivalencias de cada pestaña, sin unir bases de datos |
| Modos de ingreso de pedido | Restricción identificada | `cambiarModoNuevo` limita Romo a `manual` y `whatsapp`; revisar todos los modos aprobados de Uki antes de habilitarlos con persistencia segura |
| Inventario y Promociones | Pendiente de auditoría funcional | Accesos visibles, pero necesitan CRUD completo, permisos, carta sincronizada y exports equivalentes |
| Timbres, tarjetas, búsqueda y WhatsApp | Parcial/pendiente | Código especializado `ukiRomoTimbresPanelQA`; confirmar la misma lógica de Uki y prohibir duplicados |
| Mi Administración / dueños | CONSULTA PARCIAL / NO CONTABILIZADA | La pantalla QA `public/mi-administracion-duenos.html` ya contiene una consulta privada de cierres Romo (solo lectura) con Google + PIN, pero estos importes aún NO se incorporan a ventas generales; el panel Romo sigue sin enlace operativo a esa función. No mezclar la base financiera de Uki ni duplicar ventas |
| Turnos del 14 y del 18 de noviembre | Conciliación pendiente | No modificar histórico cifrado automáticamente ni generar cobros en jornada antigua |
| Publicación comercial | NO AUTORIZADA | QA no equivale a cierre funcional; no tocar enlaces públicos de Uki |

## Regla de aprobación
No declarar `copia exacta`, `todas las funciones completas` ni `lista para clientes` hasta cotejar todas las rutas y formularios del panel vigente de Uki con pruebas automáticas por módulo y una sola prueba integrada controlada por el dueño. Las correcciones de Romo se publican juntas, no mediante ciclos de capturas manuales por cada botón.

## Última corrección comprobada
- Se eliminó la regla de CSS que ocultaba el formulario original `Pago completo confirmado`.
- El HTML servido por Vercel QA ya contiene el formulario visible, pagos mixtos y confirmación en el mismo paso.
- No se hicieron cambios en producción Uki ni se modificaron los registros de pedidos/ventas de Romo.

## Auditoría automática de fuente oficial — 18 nov 2026
- Producción Uki VERIFICADA: proyecto Vercel `uki-sushi-inventario`, despliegue en producción del commit `3274dbc1b66b676663b74d74ae40f84d251b3ee9`. Código canónico: `firebase/uki-sushi-local.html`.
- 320 funciones Uki recuperadas; 279 secciones de funciones sin cambios textuales y 41 intervenidas en QA Romo; 112 funciones adicionales Romo.
- Los 13 módulos JavaScript oficiales de Uki están referenciados y sus archivos están presentes en la copia Romo.
- Se retiró una pantalla de pagos alternativa que duplicaba la oficial y se restauró el selector de modalidad de Uki.
- La navegación de Caja Romo ahora emplea encabezado y subpestañas de la interfaz original, pero mantiene los cálculos y datos en Neon Romo.
- Los tests `tests/romo-paridad-origen-oficial-qa.test.mjs`, `tests/romo-pago-directo-qa.test.mjs`, `tests/romo-paridad-visual-uki.test.mjs` y `tests/romo-paridad-cobros-qa.test.mjs` forman parte de `npm run test:release` en rama QA.
- Corrección CI: módulo de cobros espejo `firebase/uki-romo-cobro-pendiente-qa.mjs` sincronizado con `public/romo-panel-qa/uki-romo-cobro-pendiente-qa.mjs` para evitar dos versiones contradictorias.
- **No se ha aprobado paridad funcional completa**: siguen pendientes pruebas de las 41 funciones modificadas, equivalencia real de Pedidos/Caja/Inventario/Promos/Mi Administración y cierre de turno histórico.

Funciones del núcleo Uki cuyo comportamiento se alteró en Romo (requieren revisión de equivalencia o justificación de aislamiento):

`cajaDelDia`, `cambiarCajaTab`, `ir`, `estadoVacioSucursal`, `guardarEnLocalStorage`, `cargarDesdeLocalStorage`, `render`, `pedirPin`, `entrarSuc`, `salirSuc`, `ukiFraseDiaria`, `vInicio`, `vInicioTrabajador`, `ukiExportarPrecierres`, `ukiWhatsAppFicha`, `leerTextoD`, `ukiTimbreTextoPedido`, `ukiAbrirTimbreBorrador`, `vNuevo`, `fichaHistorial`, `vClientes`, `ukiPagoDeliveryDesglose`, `addPropina`, `quitarPropina`, `ukiDetallePago`, `totales`, `vCaja`, `vReportes`, `vRegistros`, `vPedidos`, `ukiQRPermitirCobroDefinitivo`, `ndGuardar`, `ukiAjustePedidoOlvidado`, `ukiVHistorialCorreccionesCierre`, `ukiRegistrarCorreccionCierre`, `vHistorialCompacto`, `vHistorial`, `actualizarPresentacionNube`, `actualizarBloqueo`, `contexto`, `accion`.

## Avance siguiente: inventario y caja sin afectar Uki (18 nov 2026)
- Reparado el JavaScript roto de `public/romo-panel-qa/romo-inventario-exportar.js`: contenía seis apóstrofos que impedían su ejecución en el inventario del trabajador. El trabajador puede generar PDF/Excel/WhatsApp con el nombre de Romo.
- El exportador compartido en Romo QA ahora selecciona el logo textual, encabezado y nombre de archivo de Romo o Uki según `report.branch` sin afectar los originales de producción.
- Historial Romo: `public/romo-panel-qa/uki-inventario-historial-admin.js` ya no redirige el historial al backend Uki. Lee con token autorizado `/api/romo-inventario-qa` y transforma las revisiones del propio registro Neon mediante `romo-inventario-historial-qa.mjs`.
- Las cantidades de revisiones anteriores se reconstruyen SOLO cuando los movimientos posteriores conservan el valor `antes`; si faltan datos, el detalle se bloquea con error explícito. Revisiones antiguas sin nombre guardado se presentan como `Nombre no registrado en esa revisión`.
- Las nuevas revisiones cerradas por personal de Romo conservan el nombre proporcionado y validado del trabajador dentro del historial (sin consultar a Uki).
- En Caja Romo el título `Turno abierto` ahora se muestra únicamente si lo confirma el estado; una fecha operativa antigua produce un aviso de conciliación, sin cambiar la caja ni cerrar automáticamente.
- Los casos se verifican en `tests/romo-inventario-paridad-historial-qa.test.mjs`, incluidos aislamiento Romo, PDF/CSV, reconstrucción, operaciones incompletas y sintaxis del exportador.
- Verificada la puerta QA GitHub: pruebas generales Romo y pruebas base Uki aprobadas; sin publicación comercial y sin escrituras sobre el negocio.

## Continuidad de Pedidos — códigos y reserva manual (18-11-2026)

**Rama exclusiva de preparación** `qa/romos-panel-v816`. Sin despliegue, sin pedido/venta/cierre real y sin cambios a `main` de Uki.

- Se corrigió el guardado manual para que al buscar duplicados considere únicamente `Romo’s Sushi La Serena`, comparando códigos de carta normalizados sin mayúsculas ni espacios. La consulta de Uki continúa aislada.
- En los dos módulos de aceptación (`public/romo-panel-qa/` y `firebase/`) el código `codigo_pedido` de la solicitud Neon debe coincidir con `draft.codigoCarta`, y la solicitud debe pertenecer a `serena`. Si el código ya existe en un pedido Romo, incluso cancelado, se rechaza antes de reservar; no se copia ni modifica la caja.
- En ambos constructores del candidato de pedido se rechaza una referencia de carta repetida incluso cuando tenga otro ID de solicitud. Esto complementa el control ya existente por identificador UUID y folio de turno.
- La recuperación autorizada de reserva vencida de 50 minutos estaba bloqueada por `pedido_interno IS NULL`; Neon define `pedido_interno TEXT NOT NULL DEFAULT ''`. Se ajustó el filtro SQL a `pedido_interno=''` conservando las condiciones: reserva vencida, estado pendiente, sin pedido asociado, autorización de dueños, motivo y registro en bitácora. **No se recuperó ninguna reserva real y no se modificó el temporizador**.
- Se agregaron `tests/romo-aceptacion-codigo-unico-qa.test.mjs` y `tests/romo-reserva-vencida-recuperacion-qa.test.mjs` a `npm run test:release`. GitHub Actions **44444816331** completó con éxito. Son pruebas de código/mocks, **no una prueba real con Google, Safari ni una reserva vencida en Neon**.
- Las rutas QA y la escritura comercial continúan con sus permisos y banderas anteriores; ninguna nueva Preview ni publicación Production fue creada en este bloque.

**Siguientes diferencias funcionales aún abiertas:** recepción/edición/cancelación segura desde la misma interfaz Uki y desde el enlace normal de la carta Romo, cobro/entrega/timbre en caja real, siete pestañas de Caja y sus movimientos, cierre y Mi Administración. El QR de mesas no es requisito en Romo. No declarar paridad operativa ni activar clientes hasta prueba manual controlada y conciliación de Neon Romo.

## Decisión operativa — Romo sin mesas ni QR (18-11-2026)

- La dueña confirma que **Romo no tiene mesas** y que los clientes realizarán sus pedidos con el **enlace normal de la carta**. No crear QR de mesas, cuentas QR ni un flujo paralelo para Romo.
- Esta excepción a la réplica de Uki **elimina el QR de mesas de los requisitos de publicación, de las pruebas comerciales y del listado de pendientes de Romo**. Los QR existentes en Uki se conservan intactos.
- En la pantalla **Pedidos de Romo** se deja de mostrar la tarjeta especial «Pedidos de mesas» y su filtro separado. No se borran pedidos históricos ni se altera la base, los pagos, la carta, el flujo normal de retiro/delivery o el registro existente de consumo en local. No se crearon solicitudes de prueba ni se habilitaron ventas.
- Las demás funciones de Uki acordadas para Romo siguen pendientes de homologación donde corresponda: pedidos, cobros, timbres, caja, inventario, cierres y Mi Administración.
