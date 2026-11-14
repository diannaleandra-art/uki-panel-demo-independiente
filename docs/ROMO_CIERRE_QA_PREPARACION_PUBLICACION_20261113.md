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

## 13 noviembre 2026 · Vista financiera agrupada de Romo (QA)
La extensión de presentación del panel de dueños ahora admite cierres Romo separados de Uki, respetando filtros por negocio y sucursal, fecha y razón social. Detecta coincidencia exacta con una venta manual de Romo por referencia y monto, evitando mostrarla dos veces; si difieren, señala conflicto en lugar de sumar. Los totales de cierre se muestran como informativos y no suman nuevos ingresos a fin_movimientos. Falta conectar esta función a la UI real de Mi Administración y a su endpoint autorizado; no se publica en producción.

## 13 noviembre 2026 · Rama real aislada de Neon para cierres Romo
Se creó **qa-romo-finanzas-cierres-20261113** desde la rama privada de
Mi Administración (br-cool-shadow-b59fjtyj) y se creó allí únicamente
fin_romo_cierres_live_v1, sin instalar nada en la rama padre.
Verificación: 21 cierres históricos Uki en ambas y 0 cierres Romo en
la nueva rama. La rama padre NO posee la tabla de Romo.

## Consulta privada Romo en Mi Administración (solo QA)
Se preparó la acción de solo lectura listar_cierres_romo_qa sobre la
misma API y sesión PIN+Google de Mi Administración; exige además la
nueva bandera ROMO_FIN_CIERRES_LECTURA_QA_ENABLED, apagada por defecto.
La vista agrupa los cierres de Romo y las ventas manuales sin duplicarlos,
manteniendo los cierres Uki intactos. El cliente también conserva su
interruptor de Romo desactivado. La ruta aún NO está desplegada a
producción ni asociada a la base aislada. Falta comprobar una sesión real
autorizada en QA y terminar el registro verificable de cierres.

## 13 noviembre 2026 · Constancia atómica para cierres Romo en QA
Se preparó una constancia agregada en Neon de Romo en el mismo CAS
del sobre cifrado, con SHA256, revisión y fuente única por turno.
Mi Administración debe comprobar esta constancia en Neon Romo antes
de aceptar un cierre. La bandera ROMO_CIERRE_RECIBO_LIVE_ENABLED
sigue apagada y el SQL se instalará solo en rama aislada QA.
El servidor no puede recalcular el contenido AES-GCM sin clave del
dueño; se requiere conciliación de importes antes de operar.

## 13 noviembre 2026 · Sincronización QA automática tras ingreso dueños
Se preparó la acción de servidor `sincronizar_cierres_romo_qa` en Mi Administración. Se ejecutaría al
consultar cierres desde la misma sesión Google y PIN, sólo si las banderas explícitas
están habilitadas. El servidor comprueba además el rol duenos activo en Neon Romo y
lee las constancias directamente de la base Romo, sin admitir importes del navegador.
Solo se admiten dos endpoints **de las ramas de prueba**:
Neon finanzas QA `ep-lucky-band-b5j3itkw.c-7.us-east-2.aws.neon.tech`
y Neon Romo QA `ep-gentle-paper-beusxztt.c-9.us-east-2.aws.neon.tech`.
La escritura es idempotente: turno repetido no vuelve a sumar ventas; monto
diferente exige conciliación. Sin datos de clientes, sin cambios a tablas Uki.
Banderas `ROMO_FIN_SYNC_QA_ENABLED`, `ROMO_FIN_OWNER_SYNC_QA_ENABLED`
y `ROMO_FIN_OWNER_READ_QA_ENABLED` siguen desactivadas. La ruta está guardada
en rama GitHub QA, no publicada ni conectada a credenciales.

## 13 noviembre 2026 · Corrección de la ruta privada de lectura
La acción `listar_cierres_romo_qa` de Mi Administración ya no consulta la
tabla de Romo contra la base de finanzas habitual. Ahora, solo tras Google
y PIN de dueños, resuelve el host exacto de la rama aislada `finanzas QA`
y consulta `fin_romo_cierres_live_v1` allí. La configuración exige
`ROMO_FIN_CIERRES_LECTURA_QA_ENABLED=true` y la rama esperada.
Ambos permisos siguen desactivados; no hay ventas nuevas ni consultas
públicas. Uki continúa usando su ruta y sus datos anteriores.

## Validación de duplicados y JSONB (rama QA)
El registro financiero de Romo ahora exige revisión de Neon idéntica
además de turno e importes para reconocer una importación repetida. Una
revisión distinta se marca para conciliación y nunca sobrescribe el cierre.
La comparación de constancias normaliza también las claves anidadas de
los medios de pago, evitando rechazos falsos cuando PostgreSQL JSONB
reordena los campos. Se añadieron pruebas de regresión. Sin cambios a Uki
ni activación comercial.

## Consulta privada: comprobación del rol de dueños Romo (QA)
La acción de lectura de cierres exige la misma sesión Google + PIN de
Mi Administración **y además** verifica el UID activo y rol `duenos` en la
base independiente Romo QA, con correo de dueños verificado. Solo entonces
consulta los importes en finanzas QA. Tanto la conexión financiera como la
de permisos se limitan a los endpoints de las dos ramas QA.
La lectura continúa desactivada hasta habilitación autorizada;
no se modifica la producción ni se exponen credenciales nuevas.

## Validación previa de lotes Romo (solo QA)
La sincronización ahora valida todas las constancias y compara los cierres
ya existentes en Mi Administración **antes de realizar ningún INSERT**.
Un cierre inconsistente o una revisión distinta identificada previamente
bloquean todo el lote. Solo después verifica cada constancia de nuevo e
importa los cierres uno por uno con idempotencia. Una modificación concurrente
podría exigir reintento manual: NO hay transacción única entre dos bases Neon.
Ninguna bandera operativa se habilitó y no se introdujeron ventas de prueba.

## 13 noviembre 2026 · Bloqueo explícito de entorno de producción
Se modificaron los dos verificadores de URL de finanzas Romo QA para exigir
`VERCEL_ENV=preview` y coincidencia exacta de `VERCEL_GIT_COMMIT_REF` con
`qa/integracion-panel-unico-romo-serena-20261112`, además de los hosts
Neon QA y las banderas privadas previamente requeridas. Esto impide que
un despliegue de producción active accidentalmente los conectores de pruebas.
La API actual de Mi Administración sigue usando autenticación exclusiva de
producción; para probarla desde la vista previa falta completar el acceso
privado QA sin modificar el endpoint operativo.
