# Romo: piloto de pedidos manuales pendientes (14-11-2026)

**Aprobación comercial gradual** solicitada por propietaria. Esta publicación es **preview de la rama específica**, no activación automática de carta pública ni cobro real.

Base exclusiva Neon Romo `romo:serena` con estado cifrado revisión 1; Google y contraseña habitual se comprobaron manualmente. Los dos locales Uki permanecen en producción ajena.

## Cambios
- Se reutilizan selector, formulario Nuevo del panel de Uki y acceso Google ya aprobado, sin generar nuevo panel independiente.
- Romo abre en vista Pedidos; solo se muestran rutas `Pedidos` y `Nuevo`. La bandeja de pedidos muestra exclusivamente registros cifrados Romo confirmados.
- Guardar pedido manual solo admite registro nuevo **pendiente**, sin pago, sin propina, sin QR ni solicitud automática. Delivery requiere valor manual confirmado. Validación estricta de ítems y precios, confirmación del dueño, CAS cifrado, y se muestra solo después de revisión +1 confirmada por Neon.
- Se desactiva cualquier escritura automática de Romo al renderizar/navegar. El piloto no habilita cobros, cierres, timbres, inventario ni caja.
- API `/api/romo-estado-cifrado-panel-qa` mantiene GET con rol lector Neon Romo y admite POST solo Preview rama Romo + flag de guardado y piloto + rol `duenos`. El rol de escritura `romos_clave_alta_qa_20261114` tiene SELECT de revisión/store y UPDATE restringido; no DELETE ni acceso a bases Uki.
- En respuesta incierta el cliente conserva el formulario y no afirma éxito ni reintenta. Se requiere recarga y conciliación antes de repetir.

## Condiciones pendientes para vender al público
**No entregar URL de clientes aún**: carta Romo en otra rama tiene módulo de solicitud faltante, ruta de delivery bloqueada y catálogo/inventario sin conexión comercial. Para un lanzamiento real desde WhatsApp, validar primero registro en Neon con la prueba MANUAL de dueño y conectar flujo de pagos/caja o mantener registro de cobros en un sistema operativo verificado.

No se deben ejecutar pruebas automatizadas (la propietaria exige comprobaciones manuales). No modificar main Uki, sus QR ni la carta productiva. No divulgar credenciales.
