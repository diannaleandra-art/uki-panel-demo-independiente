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
| Mi Administración / dueños | NO INTEGRADO | La sección de Romo declara textualmente que la integración de cierres está pendiente. No enlazar a la caja/base de Uki por conveniencia |
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
