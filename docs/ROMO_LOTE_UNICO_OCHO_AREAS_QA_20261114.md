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

## 14-11-2026 · Primera clave de Romo protegida (solo QA)
Se detectó que la clave de Uki no puede verificarse realmente desde otro dominio cuando el estado Romo en Neon está en revisión 0. El acceso a Romo sigue exigiendo Google autorizado en servidor; además la **primera** apertura del estado vacío ahora exige repetir la clave en un segundo campo enmascarado antes de mostrar el panel. No se comunica esa clave a Neon ni se crean ventas; las siguientes aperturas descifran el estado existente y ya no exigen repetirla. Un error de confirmación bloquea el ingreso sin cambios. Esto no constituye verificación cruzada con la contraseña de Uki, que sigue pendiente. Se agregaron pruebas automatizadas, sin activar la carta pública ni alterar la caja Uki.

## 14-11-2026 · Preparación de inventario en Neon QA
Se identificó que la API de inventario solo admitía entorno production. Ahora admite un modo **QA** estrictamente limitado a la rama de integración, requiere `ROMO_INVENTARIO_QA_ENABLED=true` además de `ROMO_OPERATIVO_QA_ENABLED=true`, y usa exclusivamente `romoOperativoConfig` para su base y origen aislados. El modo QA queda **apagado** porque la nueva bandera no fue configurada en Vercel. Google y rol se siguen verificando en servidor, la producción conserva sus dos banderas live, y no se tocó ninguna tabla ni inventario Uki. Se añadieron pruebas de acceso y cierre por defecto.

## 14-11-2026 · Recuperación de solicitudes abandonadas
Se encontró que las reservas de 30 minutos estaban protegidas por token, pero la consulta y el nuevo bloqueo ignoraban la fecha de caducidad. Ahora una **reserva vencida** vuelve a poder seleccionarse para revisión; el rechazo con motivo limpia la reserva vencida, y la aceptación requiere además un token vigente. Reservas vigentes de otro equipo siguen bloqueadas. No se crea venta, timbre ni cobro al vencer el plazo. La recuperación solo funciona si la API Romo QA se habilita y despliega en preview, nunca en la carta pública por sí sola.

## 14-11-2026 · Corrección de destino inventario y cabecera Romo
El panel de inventario QA apuntaba por error a `https://uki-sushi-inventario.vercel.app/api/romo-inventario-qa` (dominio de producción). Ahora su URL apunta al endpoint de la rama QA (`uki-sushi-inventario-git-qa-integraci-dc8aa9-diannaleandra-7046.vercel.app`), con comprobación adicional del dominio del panel y acceso existente. Se conserva `ROMO_INVENTARIO_PANEL_HABILITADO_QA=false` y **no** se ha creado `ROMO_INVENTARIO_QA_ENABLED` en Vercel, por lo que escribir inventario continúa inhabilitado. La cabecera muestra `Neon Romo: lectura confirmada` solo al cargar correctamente el estado Romo; no se confunde con la nube Firebase de Uki, ni se afirma sincronización comercial.

## 14-11-2026 · Inventario QA habilitable en vista privada
Vercel `uki-sushi-inventario`: nueva variable encriptada `ROMO_INVENTARIO_QA_ENABLED=true`, exclusivamente en entorno `preview` de la rama QA Romo; producción no fue cambiada. El panel QA ahora expone Inventario solo si el hostname es el alias privado de Romo; el servidor obliga además a Google y permisos de rol y conecta únicamente con la base QA. No activa stock real, ventas ni carta pública. Requiere publicación nueva del frontend y backend para ver el cambio; **pendiente prueba real con dueño autorizado**.

## 14-11-2026 · Ruta publicada del panel QA
El dominio Vercel sirve public/index.html (Inventario Uki), mientras que firebase/uki-sushi-local.html no estaba expuesto, causando el 404. Se publica copia exacta de vista QA en public/romo-qa/uki-sushi-local.html con los JS/MJS/SVG que necesita el mismo panel, sin reemplazar public/index.html. CI verifica que ambos recursos permanezcan idénticos. Ruta privada: https://uki-sushi-panel-git-qa-integracion-pa-261e5e-diannaleandra-7046.vercel.app/romo-qa/uki-sushi-local.html?sucursal=romo-serena. No habilitar carta comercial ni tocar locales Uki.
