# Romo La Serena · lote único de ocho áreas · QA 14-11-2026

**Alcance autorizado:** preparar en la rama de integración QA las conexiones existentes y agrupar verificaciones. No activar comercio ni tocar ramas productivas, dominios públicos, QR o cuentas de Uki.

## Situación comprobada en Neon (rama aislada `qa-romo-constancias-cierre-20261113`)
- `romo_solicitudes_carta_v1`: 1 solicitud `QA-ROMO-001` pendiente por $9.000, sin pedido interno, venta ni timbre confirmado.
- `romo_estado_operativo_v1`: 0 estados cifrados guardados.
- `romo_turnos_v1`: 0 registros de turnos.
- `romo_cierres_constancia_v1`: 0 constancias de cierre.
- `romo_personal_acceso_v1`: 1 cuenta activa con rol de dueños (no se anotan datos identificatorios).
- `romo_catalogo_v1`: 7 productos y 3 promociones registrados; sus visibilidades deben comprobarse individualmente.
Estas comprobaciones no acreditan conexión real desde dos teléfonos ni una caja abierta.

## Ocho áreas agrupadas
| Área | Lo comprobado o preparado en código | Lo pendiente para funcionar |
|---|---|---|
| 1. Acceso | Google con rol Romo en Neon separado; un mismo selector | Verificación segura de la clave habitual desde otro origen y prueba real de permisos |
| 2. Pedidos | Bandeja, reserva atómica, recepción y edición/cancelación limitada a impagos | Confirmar pantalla, guardado en Neon y dos equipos sin duplicación |
| 3. Caja | Turnos, cobros y movimientos con revisión CAS preparados; formulario de apertura reposicionado arriba | Apertura real, pagos mixtos, reparto y conciliación |
| 4. Timbres | WhatsApp manual y constancia CAS preparados | Demostrar envío real y no duplicar timbre |
| 5. Cierres | Cierre definitivo y constancia por turno preparados | Cuadre efectivo, precierre, corrección, historial y ausencia de doble cierre |
| 6. Inventario | Base independiente de Romo y formulario QA | Autorización de acceso, pruebas de conteos y sincronía con carta |
| 7. Dueños | Agregados/constancias y registro de finanzas QA preparados | Conectar sesión Google+PIN, persistencia de cierres y reconciliación sin duplicar ventas manuales |
| 8. Carta | Catálogo Romo y entrada de solicitud independiente preparados | Verificar precios, promos, foto, WhatsApp, QR y solo después activar público |

## Cambios incluidos en este lote
- En **Caja Romo** la sección de abrir/cerrar turno aparece **antes** del resumen, evitando la confusión de la captura en iPhone.
- El resumen aclara cuándo todavía no existe un turno y diferencia **solicitudes** de **pedidos/ventas**.
- Los botones no afirman guardados: las operaciones dependen de la confirmación remota de Neon.
- Se agrega una prueba de regresión de ocho áreas al flujo CI de la misma rama, sin modificar pruebas históricas.
- No se cambia el funcionamiento ni la clave de las dos sucursales Uki.

## Condición para publicación comercial posterior
Primero: conectar autenticación/clave real de Romo, ejecutar operaciones completas en navegador con cuenta autorizada, verificar dos teléfonos y finanzas privadas. Luego validación de los dueños y **otra autorización expresa de lanzamiento**. No interpretar un despliegue de vista previa como publicación comercial.
