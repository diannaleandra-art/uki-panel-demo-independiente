# Romo La Serena - Cierre QA y lanzamiento controlado

## Cierre preparado en QA
Apertura con responsable, base y caja chica; cierre con efectivo contado, diferencia documentada, medios mixtos, ingresos por plataforma, gastos, retiros, propinas y reparto del día/saldos anteriores. Dos turnos de un día son independientes.
La confirmación requiere bandeja remota comprobada, permiso de cierre por rol Google, snapshot cifrado AES-GCM y revisión CAS en Neon. No se repite automáticamente tras una respuesta incierta.

## Controles apagados
- ROMO_PANEL_INTEGRACION_HABILITADA_QA=false
- ROMO_PANEL_MOVIMIENTOS_HABILITADOS_QA=false
- ROMO_PANEL_CIERRE_HABILITADO_QA=false
- ROMO_OPERATIVO_CLIENTE_HABILITADO_QA=false
- ROMO_CIERRE_DEFINITIVO_HABILITADO_QA=false
- Backend necesita ROMO_OPERATIVO_LIVE_ENABLED y ROMO_CIERRE_DEFINITIVO_LIVE_ENABLED habilitados expresamente.
- Recepción necesita ROMO_SOLICITUDES_LIVE_ENABLED habilitada expresamente.
En Vercel existen nombres de variables de DB, host y origen de Romo, pero las variables de activación indicadas no están registradas. No se han publicado estas modificaciones.

## Pendiente antes de abrir la carta al público
1. Verificar de punta a punta en el navegador con cuenta autorizada: apertura, aceptación, timbre, pagos, movimientos, cierre e historial.
2. Probar dos teléfonos reales sobre el mismo turno y probar respuesta incierta sin doble cierre.
3. Confirmar que los cierres Romo entren en Mi Administración de dueños sin doble contabilización. Hoy el estado de Romo se cifra en su propia Neon; no está demostrado el traslado automático de cierres a las finanzas privadas de dueños.
4. Verificar que edición de pedido, inventario y timbres restantes tengan equivalencia funcional con Uki. Parte de Romo aún es solo consulta.
5. Validar enlace y QR de carta Romo, precios/promociones, WhatsApp y recepción pública antes de aceptar pedidos.
6. Solicitar aprobación expresa y agrupar una publicación controlada del panel y otra de la carta, con revisión de logs y prueba final de cierres.

Nunca publicar un cambio de Romo que altere las dos sucursales productivas Uki o sus QR ya impresos.
## 13 noviembre 2026 · Adaptador de cierre Romo para dueños (solo QA)
Se preparó un resumen financiero de Romo a partir del cierre definitivo, con fuente única romo:serena|turnoClave (separada de los cierres Uki). Valida medios de pago contra ventas y separa reparto, gastos, propinas, retiros y caja chica, sin clientes ni pedidos individuales. El motor entrega el resumen SOLO después de CAS confirmado en Neon y lo marca **pendiente de sincronizar en Mi Administración**. El transporte al panel privado, su autorización con PIN de dueños, la persistencia idempotente y las pruebas con dos teléfonos siguen pendientes; no se ha escrito en la base financiera ni se activó Romo.

## 13 noviembre 2026 · Preparación de recepción de cierres Romo en Mi Administración (QA)
Se añadió un registro privado independiente fin_romo_cierres_live_v1, en un script de migración NO EJECUTADO. Motor de recepción para backend, con roles duenos de Romo y sesión PIN privada comprobada obligatoriamente por el servidor; exige resumen confirmado de Neon, separa cobros y reparto, no transmite clientes ni pedidos, rechaza cargas discrepantes y devuelve duplicado sin crear otra venta. No escribe en fin_movimientos ni en fin_uki_cierres_live_v1. Faltan aprobar/aplicar el esquema en una rama privada, conectar el endpoint a las sesiones reales de dueños, leer los cierres en la vista de Mi Administración y comprobarlos con dos teléfonos. El código permanece en QA y todas las operaciones comerciales apagadas.
