# Continuidad simplificada · seguimiento de pedidos Uki y Romo · 24/11/2026

**Objetivo del usuario: terminar UNA función sencilla para tres sucursales, sin rehacer paneles, crear demos adicionales ni imponer pasos al personal.** Sucursales: Uki Regimiento Arica, Uki La Serena, Romo Sushi La Serena.

## Flujo aprobado
1. Cliente registra pedido desde carta; elige método de pago. Ve un mensaje corto: "Sigue tu pedido aquí. Deja esta ventana abierta o guarda el enlace en tu celular".
2. Si eligió transferencia, ve monto exacto y cuenta de su sucursal SOLO cuando estén validados por el servidor. "Ya transferí" es sólo aviso, no prueba de abono.
3. La agendadora verifica en el banco y pulsa UN botón con el monto: "Confirmar: vi $X abonados".
4. SIN ese registro de verificación bancaria, el sistema no puede marcar pagado ni finalizar el pedido. Pagos mixtos: resto conciliado. No modificar caja/timbres/cierres por esta alerta.
5. Chat breve desde enlace, entre cliente y su pedido en panel, sin Meta/WhatsApp automático.
6. Los tres locales reciben mismas funciones y mantienen datos separados.

## Estado real de trabajo
- **PRODUCCIÓN NO CAMBIÓ.** No se han activado estas reglas en los pedidos comerciales. No se han validado cuentas bancarias por sucursal.
- Proyecto de QA: repositorio \`diannaleandra-art/uki-panel-demo-independiente\`, rama \`preparacion/enlaces-seguros-3-sucursales-20261124\`, Vercel \`romos-sushi-panel\` únicamente Preview y protegido.
- Neon QA existente para Uki y Romo: tablas de enlaces, transferencias, chat cifrado, y cierre QA. No hay pagos insertados; no tocar bases reales.
- Se crearon verificadores de pago en servidor (SQL atómico para registro QA) y un bloqueo de siete rutas cifradas legadas de Romo en Preview; éste impide writes de esos endpoints y **no sirve tal cual como solución comercial**, ya que el panel real necesita seguir guardando caja y pedidos.
- Cambio reciente significativo:
  - \`lib/seguimiento-qa-servidor-v1.cjs\`: \`issueForRegistered\` deriva el MISMO token del ID, \`request_key\` fuerte y fecha del registro guardado; reintentar no cambia enlace. \`issueAccepted\` reutiliza ese mismo token después de aceptar, en vez de invalidarlo.
  - \`api/romo-solicitudes-carta-qa.js\`: tras registrar una solicitud Romo en la rama segura, intenta devolver \`seguimientoEnlace\` en respuesta, bajo flags y comprobación de que su conexión coincide con Neon QA. No entra en uso hasta integrar el frontend real.
  - \`public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs\`: botón de copiar el mismo enlace, sin otro paso.
  - \`tests/seguimiento-registro-pendiente-v1.test.cjs\`: verifica que el enlace sobrevive reintento y aceptación para cada local.
- CI última confirmación exitosa: ejecución GitHub Actions \`45346306676\`; 90 tests seguimiento y 23 regresiones Romo, 113/113 exitosos.

## Pendiente mínimo ANTES de publicar
1. Integrar visibilidad y conservación del enlace dentro de las cartas **reales** de Romo y de ambas sucursales Uki, sin registrar ventas al pulsar WhatsApp. La función de enlace compartido existe en QA, pero la carta pública de Uki en otro repositorio \`uki-sushi-respaldo\` aún NO está conectada al emisor de tokens.
2. Integrar la verificación bancaria en la **operación única real de guardado** por pedido, sin que las rutas antiguas de snapshots cifrados (Romo) o Firestore (Uki) puedan marcar pagado/entregado a espaldas del servidor. Conservar controles de propinas, timbres, caja y cierres. No activar el bloqueo bruto de QA en producción.
3. Confirmar cuentas bancarias auténticas y correctas por sucursal, con documentación empresarial apropiada. No inventar datos.
4. Pruebas manuales con personal autorizado en navegador normal (Firebase Google no acepta actualmente el hostname temporal de Preview), comprobar iPhone, PC, avisos, pago mixto, reintentos y doble guardado. No solicitar pasos de más a la usuaria durante preparación.
5. Únicamente entonces publicar juntas las tres sucursales. No decir que está listo en producción hasta verificarlo.

## Seguridad
- No inferir pago recibido a partir del texto WhatsApp, botón del cliente o de la preferencia declarada. La base Romo guarda snapshot AES-GCM que el servidor no puede inspeccionar sin rediseño de fuente autoritativa.
- Los enlaces caducan; al reintentar en un plazo válido NO deben cambiar. Si ya hay un enlace activo distinto, \`issueForRegistered\` falla sin invalidarlo.
- La bandera Vercel \`SEGUIMIENTO_BLOQUEAR_SNAPSHOT_LEGACY_QA_ENABLED=true\` está limitada a la rama preview exacta. No copiarla a producción.
- No crear otra rama/proyecto/app ni más pantallas demo si no hace falta. Priorizar terminar la función concreta con UX simple.


## Avance de usabilidad QA 24/11/2026
- En `public/romo-panel-qa/index.html` la ficha del pedido de carta con UUID válido, tanto en la vista Uki como en la vista Romo, muestra «💬 Mensajes y transferencia». Abre el detalle en el MISMO panel; no requiere otra pantalla ni otro formulario.
- `public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs` añade el acceso directo a ese pedido y conserva la confirmación de abono con un solo botón con monto exacto.
- `api/seguimiento-personal-tres-qa.js` incluye solicitudes `pendiente` y `aceptada` en la bandeja. El aviso temprano no autoriza confirmar pagos de solicitudes todavía pendientes.
- Se probaron los cambios con CI en la rama Preview. Nada de esto está desplegado en los paneles de caja de producción ni activa transferencia bancaria real.
- Persisten bloqueos para publicación: datos bancarios verificados por sucursal, integración real con Uki/Firestore y Romo/snapshot cifrado, y pruebas manuales de iPhone/PC. El bloqueo bruto de snapshots QA no puede llevarse a producción.

## Ajuste concreto de cierre Romo (misma fecha)
- Se detectó que `ukiRomoCambiarEstadoQA(id,'entregar')` en el listado de Romo era una segunda vía para marcar Entregado que no consultaba el estado bancario.
- Se añadió `ukiSeguimientoPermitirCerrarQA(p)` en esa rama de entrega **antes** de solicitar responsable o guardar, manteniendo cancelaciones y cobros existentes independientes.
- Test de regresión específico en `tests/seguimiento-bloqueo-guardado-panel-qa.test.cjs` verifica ambos caminos de entrega; GitHub Actions `45347823432` aprobó 94 pruebas de seguimiento y 23 de regresión Romo (117/117).
- Vercel Preview privado: commit `a7ad274ee6a6203ada350a86a1a2d583fe7f97e5`, no producción.
- **Todavía no es bloqueo transaccional comercial**: para producción quedan migración de guardado cifrado, integración en Uki/Firestore y datos bancarios correctos. No prometer cumplimiento operativo mientras existan rutas que escriben snapshots opacos.


## Continuación 24/11 · pantalla cliente Uki, sin publicación
En el repo separado \`diannaleandra-art/uki-sushi-respaldo\`, rama \`preparacion/uki-pago-declarado-seguimiento-20261124\`:
- \`public/candidata/app.js\`: tras el POST de carta, si la respuesta **válida** del servidor trae \`seguimientoEnlace\`, crea un solo aviso «🍣 Sigue tu pedido aquí» con «Ver seguimiento» y «Guardar enlace». Valida HTTPS, dominio y ruta antes de mostrar; si el servidor NO ofrece enlace, no inventa uno. **Mantiene** \`window.location.assign(href)\` hacia WhatsApp y no considera cobrada la orden.
- \`public/candidata/seguimiento-pedido-v1.mjs\`: permite mostrar cuenta bancaria **verificada y de la sucursal** al estar la solicitud pendiente o aceptada; «Ya transferí» es sólo aviso. El botón de guardar usa Compartir nativo del iPhone, o copiar como alternativa.
- \`public/candidata/seguimiento-pedido.html\`: nombre del botón simplificado a «Guardar enlace».
- CI \`45349725455\`: 8 pruebas de Uki exitosas.
- **Limitación pendiente crucial**: \`api/carta-solicitudes-live.js\` de Uki todavía NO devuelve el campo \`seguimientoEnlace\`, de manera que esta interfaz no mostrará enlace en pedidos reales hasta conectar el emisor autorizado del servidor. No se añadió integración con base de datos comercial ni se publicó.

## Comprobación adicional 24/11 · continuidad en la misma carta
**Acuerdo definitivo:** seguimiento, chat y avisos EN LA MISMA CARTA digital, sin abrir otra página ni enviar otro enlace por WhatsApp. «Guardar mi pedido» regresa a esa carta. Los paneles y cajas existentes se conservan.

- Cartas preparadas, no publicadas: Uki Arica y Uki Serena en uki-sushi-respaldo, rama preparacion/seguimiento-en-misma-carta-20261124; Romo en romos-sushi-qa., rama preparacion/romo-seguimiento-en-misma-carta-20261124.
- Bandeja de chat preparada en otro desarrollo QA del panel Romo; no mezclar ramas anteriores con esta rama avanzada sin revisar los contratos.
- Inspección READ-ONLY de Neon QA: Uki 3 solicitudes (2 aceptadas, 1 pendiente), Romo 1 aceptada. En ambas, 0 transferencias, 0 chats, 0 finalizaciones. Ninguna solicitud de prueba tiene pagos o medioPago estructurados; no se pueden certificar pagos reales.
- Corregido lib/seguimiento-operacion-unificada-qa.cjs: ahora devuelve puedeAvisarTransferencia sólo con importe válido, banco de la propia sucursal verificado y estado de pedido compatible. Las cartas embebidas esperan este dato.
- Ejecutadas 30 comprobaciones puras sobre código de la rama para las tres sucursales: 30/30, sin escribir en bases ni bancos. Cubren pago mixto, estado de aviso, banco ajeno/ausente/no verificado, finalización pendiente y conciliación del resto. Preview Vercel alcanzó READY; no equivale a publicación ni prueba operativa iPhone.
- Persisten bloqueos: verificar titular y cuenta por local, guardar los medios definitivos desde el panel (no sólo preferencia de carta), conectar API cliente y personal, estados reales y guardado servidor atómico sin rutas antiguas que permitan marcar pagado o entregado.
- No activar producción ni ejecutar migraciones comerciales hasta completar las pruebas manuales del lote para los tres locales.

## Refuerzo QA del guardado y medio de pago · 24/11/2026
- Se reforzó lib/seguimiento-qa-servidor-v1.cjs para que un aviso, confirmación bancaria o mensaje sólo se registre si el pedido conserva el estado, sucursal y, para movimientos monetarios, total y detalle original de pago en la MISMA instrucción SQL. Esto no modifica la caja comercial.
- Se añadió la función QA lib/seguimiento-confirmar-medio-pago-qa.cjs y acción confirmar_medio_de_pago en la API de personal. Confirma sólo que la agendadora validó una forma de pago declarada por el cliente; NO marca el abono como recibido. Rechaza desgloses mixtos no validados, cambios de importe o método, usuarios de otras tiendas, pagos ya confirmados y finalizaciones ya registradas.
- Esta función se debe integrar en el guardado habitual del pedido antes de comercializarla, sin pantallas o botones adicionales para la agendadora. Por ahora es backend QA desactivado en comercio.
- Se añadieron pruebas de regresión a npm run test:seguimiento. Se realizaron 24 comprobaciones aisladas con módulos de prueba y 9 EXPLAIN sin ejecutar escrituras de aviso, confirmación y chat (3 operaciones x 3 sucursales); todos aprobados. Las 3 consultas EXPLAIN del guardado QA de medio de pago también se validaron sin ejecutar UPDATE. Las compilaciones Vercel Preview reportaron READY; **no equivale a una prueba integral real ni a publicación**.
- Pendientes para activación: validar cuentas de cada local, completar integración con la operación de guardado/caja cifrada y Firebase para que no haya atajos, probar en Safari iPhone y computador, certificar medios mixtos/propinas y realizar validación manual con personal autorizado. Sin esos puntos, mantener la función desactivada en producción.

## Integración sin pasos adicionales, posterior a guardado confirmado
Fecha: 24/11/2026. PREPARACIÓN QA, NO PUBLICADA EN LOS TRES LOCALES.

1. Se agregó en public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs una función opcional window.ukiQAConfirmPaymentMethodAfterSave. Sólo puede ejecutarse en Preview privado, con la marca UKI_SEGUIMIENTO_AUTO_PAGO_QA_ENABLED explícitamente habilitada. La marca está apagada por defecto.
2. Romo invoca la función únicamente DESPUÉS de recibir la aceptación atómica de Neon y vincular el identificador fuerte de la solicitud al pedido guardado en el mismo panel. Uki Regimiento y Uki La Serena la invocan únicamente tras confirmar el estado aceptado desde la bandeja existente. No se añadió ninguna pantalla, botón ni aplicación al flujo.
3. La función rechaza automáticamente pagos mixtos, delivery con medio distinto, propina, pedido ya pagado, pagos de otro local y totales que no cuadran. Sólo intenta validar el método declarado por la agendadora: nunca registra un abono, ingreso, caja, propina ni timbre.
4. El backend QA ahora exige totalValidado entero que debe coincidir exactamente con el total almacenado y usa identidad Google de personal y sucursal. Mantiene la preferencia original del cliente, permitiendo corregir el medio desde el mismo pedido sin considerar esa corrección un pago recibido.
5. El adaptador fuente exige, para origen carta-normal, medioPagoConfirmadoPor, medioPagoConfirmadoTotal exacto y fecha válida. La selección inicial del cliente NO autoriza transferencia. Si cambia el total, deja de ser válida la confirmación previa.
6. Se añadieron pruebas a npm run test:seguimiento. Se ejecutaron en un entorno de simulación 16 comprobaciones del módulo de medio (16/16), 7 del detector/enganche a las cartas y paneles (7/7), 7 de lectura de fuentes (7/7). Además, EXPLAIN sin escritura validó la consulta SQL del método en Neon QA de las tres sucursales (3/3). Vercel Preview reporta READY, que no equivale a prueba integral de pagos ni a release comercial.
7. AÚN BLOQUEA PUBLICACIÓN: verificar las cuentas bancarias por local, habilitar y probar el flujo con Google del personal en QA, enlazar estados reales y cerrar las rutas legadas que puedan registrar pagado/entregado por snapshots cifrados o Firestore sin la misma transacción de pago. El bloqueo actual de QA no protege por sí solo los guardados comerciales. Probar manualmente iPhone/PC, reintentos, pagos mixtos y caja antes de activar para los tres locales.

Conservar el trabajo aprobado y no habilitar banderas en producción ni ejecutar SQL comercial sin validación.

## Contrato simple de la carta y el panel · revisión 24/11
- El pedido del cliente se consulta en la misma carta; no se crea otra página ni otro registro. Tres locales: Uki Regimiento Arica, Uki La Serena y Romo Sushi La Serena.
- El estado de la carta ahora distingue **medio elegido por el cliente** de **medio validado por la agendadora**. El servidor QA devuelve `pagoDeclarado` para que la carta muestre «Transferencia» incluso antes de la aceptación, sin fingir que se verificó el dinero.
- Hasta que exista validación del importe y cuenta bancaria de esa sucursal, no se muestran datos bancarios ni se habilita «Ya transferí»; ese aviso nunca acredita el pago.
- Romo muestra datos bancarios comprobados tanto con solicitud pendiente como aceptada, si el propio servidor autoriza ese estado. La respuesta de otra sucursal se rechaza.
- En Romo se eliminó la bandera de interfaz adicional `ROMO_SEGUIMIENTO_EN_CARTA_QA_ENABLED`: el paso entre WhatsApp habitual y recepción de la carta se decide solo por el estado real de la recepción del panel. Al quedar inactiva la recepción, no se rompe WhatsApp.
- **Pruebas:** 15/15 comprobaciones de datos de las tres sucursales con medios seleccionados pero no validados. Se verificó la interfaz de Romo con los datos de prueba: selección pendiente visible sin mostrar cuenta ni botón; cuenta y aviso visibles cuando el servidor los autoriza; otra sucursal bloqueada. Compilación automática de Preview, no prueba real de clientes.
- **Aún no publicar como operativo:** no están activados los permisos del proxy de Romo para la nueva rama, faltan las cuentas bancarias reales validadas por local y el control atómico del pago en todos los guardados de caja existentes. Ninguna de estas pruebas cambió las ventas comerciales.

## Ensayo completo de pedido ficticio por local, sin registrar ventas
- Se añadió `tests/seguimiento-pedido-completo-tres-sucursales-qa.test.cjs` a `npm run test:seguimiento`, ejecutado por la configuración de CI de la rama privada.
- La prueba usa **un pedido inventado por sucursal**, con UUID, referencia y total ficticios, SIN conexión a Santander, Neon, Firestore, clientes, caja comercial o timbres. Recorre solicitud pendiente, emisión del acceso a la misma carta, enlace idéntico después de aceptar, rechazo de mensajes/avisos antes de la aceptación, validación del medio por agendadora sin cobro, chat bilateral, aviso del cliente que no acredita el abono, bloqueo de cobro y entrega con pago pendiente, rechazo si la agendadora no confirma haber visto el abono o indica monto incorrecto y, por último, confirmación bancaria **simulada**, registro QA de pagado seguido de entregado.
- Se comprueba que un token de Uki Regimiento no autoriza pedidos de Uki La Serena. Se verifica que las consultas simuladas no modifican tablas comerciales de caja, ventas ni timbres.
- Comprobación funcional local con dobles de interfaz de token y cifrado: **4/4 escenarios**, 3 sucursales + aislamiento entre sucursales. Esto comprueba el flujo programado pero NO sustituye ejecución de GitHub Actions con criptografía real o una prueba real por HTTP con Google, bancaria y caja.
- Vercel Preview del commit de prueba reportó READY (no producción). Lectura posterior de Neon QA de Uki y Romo: **0 transferencias y 0 finalizaciones** en las tablas QA, confirmando que el ensayo no creó movimientos.
- **Pendiente crítico antes de liberar:** el guardado comercial AES-GCM de Romo y el guardado de Uki/Firestore aún no comparten una operación atómica autoritativa con la confirmación bancaria; además faltan cuentas bancarias verificadas y pruebas reales con sesiones del personal, Safari iPhone y panel. No afirmar que el bloqueo comercial ya opera.
