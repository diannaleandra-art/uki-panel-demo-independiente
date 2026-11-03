# Uki Sushi — pedidos por QR en mesa: plan de integración (SIN PRODUCCIÓN)

Estado al 3 nov 2026: **solo análisis/diseño; no hay recepción automática activada, no usar con clientes reales.** No publicar ni cambiar la carta de producción sin autorización específica.

## Infraestructura comprobada
- Panel: `uki-panel-demo-independiente/firebase/uki-sushi-local.html`, GitHub Pages, Firebase con snapshot completo cifrado por sucursal. Sucursal y clave de nube son solo para personal autorizado.
- Carta: proyecto Vercel `uki-sushi-pedidos`, código de lanzamiento en `diannaleandra-art/uki-sushi-respaldo`, ruta `public/candidata/app.js`, `model.mjs`.
- La carta ya ofrece modo `consumo`, pero no recoge mesa; prepara pedido para WhatsApp. No hay endpoint POST de recepción de pedidos en `api/route.js` (solo consulta de rutas GET).
- El formato de texto que crea la carta y el encabezado rígido que detecta el importador del panel no son idénticos; no basar la conexión en pegar texto.

## Flujo objetivo
1. QR público por sucursal y mesa, con URL tipo `?tipo=mesa&sucursal=arica&mesa=2`; el servidor valida la sucursal y mesa activa. Un QR por mesa, administrable.
2. Carta existente se abre en modo consumo y enseña: "Mesa 2 · Regimiento Arica". El cliente arma productos existentes. WhatsApp es opcional para pedir desde la mesa.
3. Enviar → API segura `POST /api/mesas/pedidos` crea **solo solicitud** con idempotencyKey, cantidad, ingredientes, observaciones, sucursal y mesa; monto recalculado en servidor con carta autorizada. Respuesta: código + "Pendiente de confirmación".
4. Bandeja autorizada del panel: "Pedidos de mesas", estados recibido, confirmado, en preparación, entregado, rechazado/cancelado. Distinguir solicitudes de ventas pagadas.
5. Trabajador confirma → adjuntar a cuenta de mesa existente o abrir una nueva; nunca duplicar en caja. Consumiciones adicionales acumulan en la misma cuenta.
6. Al pedir la cuenta: total, propina voluntaria 10 %, cuenta imprimible/compartible, cobro manual al personal; solo entonces queda pagado.
7. Delivery y cálculo de repartidores no deben incluir jamás solicitudes de consumo.

## Seguridad y concurrencia obligatorias
- No dar claves de nube, PIN, credenciales Firebase ni sesión Google a clientes.
- No escribir peticiones públicas en el documento cifrado `uki_operacion_v1` del panel. Necesita bandeja aislada en base de datos y control de lectura/escritura por sucursal.
- API con límite por IP/mesa, anti-spam, validación de productos/precios del lado servidor, bloqueo de pedidos duplicados, sanitización de observaciones y máximo de ítems.
- Operaciones por pedido con ID único y escritura atómica; no sustituir el snapshot completo cuando dos empleados guardan a la vez.
- Confirmación explícita del trabajador, auditoría de cambios y manejo de agotados/precios. Un QR fotografiado puede usarse desde fuera: requerir confirmación y medidas antiabuso.
- Las pruebas deben usar pedidos falsos y ambiente aislado de caja/cuentas reales.

## Datos mínimos necesarios
- Cantidad y numeración de mesas por sucursal (por ahora se puede probar con Mesa 1, 2 y 3).
- Confirmar sucursales de consumo: Uki Regimiento Arica y/o Uki La Serena.
- QR impreso o adhesivo por mesa; internet de los teléfonos y del local.
- No hace falta crear otra carta, otro celular ni otro número de WhatsApp para la función QR.
- Aprovechar infraestructura Vercel + Firebase existente **solo si permisos y cuotas lo permiten**; revisar consumo real y no activar servicios de pago o facturación sin permiso.

## Criterios de aceptación antes de publicar
- Dos trabajadores confirman pedidos simultáneos sin sobrescribir ni perder registros.
- Tres solicitudes ficticias a una mesa, una reintentada: aparecen exactamente tres, no cuatro.
- La misma mesa tiene una sola cuenta abierta; todos los importes coinciden con las tarifas vigentes.
- Pedido rechazado por agotado no entra en venta/caja; pedido confirmado tampoco se marca pagado antes del cobro.
- Sucursales aisladas, clientes sin acceso a datos privados.
- Borrar pruebas no afecta registros reales; costo y límites comprobados; publicar solo con autorización.

## Estado verificado al 03-11-2026 (sin publicación)
- Rama privada de trabajo del panel: `preparacion/mesas-borradores-qr-sin-produccion-2026-11-03`. Rama de trabajo de la carta: `preparacion/uki-mesas-carta-bandeja-sin-publicar-2026-11-03`.
- Panel: formulario para pausar y recuperar pedidos, bandeja de mesas y enlace a `https://uki-sushi-pedidos.vercel.app/api/mesa-pedidos` preparados; cambios exclusivos de rama de pruebas.
- Carta: modo QR mediante `?sucursal=arica&mesa=2`, envío por POST y confirmación de recepción del servidor; sin afectar carrito ni WhatsApp convencional.
- API: no admite solicitudes hasta que `UKI_MESAS_QA_ENABLED`, conexión aislada y UIDs autorizados estén debidamente configurados. Recalcula precio según el catálogo, bloquea duplicados por clave de reintento y no registra pagos.
- Neon, proyecto `uki-sushi-integracion-pruebas`: se creó rama aislada `uki-mesas-qa-2026-11-03` con tabla `uki_mesa_solicitudes_qa`. Se insertaron dos pedidos ficticios en Mesa 2 (Regimiento); un reintento duplicado no se insertó, y una segunda transición a "registrado" no modificó nada. La Serena permaneció sin solicitudes. Se dejó la tabla **sin pendientes**.
- La rama de base de datos de QA quedó **suspendida** para reducir cómputo del plan gratuito. No se ha habilitado conexión a la carta publicada ni a caja real.
- Se probó el contrato de API mediante servidor simulado: aceptación, rechazo de sucursal inválida, lectura sin autorización, recálculo de precio, deduplicación y rechazo de URL de base ajena.
- El guardado de varios pedidos abiertos conserva los borradores en bloques cifrados con compatibilidad de copias anteriores.
- **No está probado** el flujo extremo a extremo desde navegador real hasta el panel; tampoco se han validado simultáneamente dos trabajadores en la misma sucursal.
- **No se ha publicado** ninguna de las dos ramas; Vercel sigue sirviendo la rama de lanzamiento aprobada.
- Pendientes antes de poner QR en mesas: entorno preview de Vercel con **solo** la base QA, trabajador autorizado en Firebase, tests de navegador/seguridad, validación de precios y costos del proveedor, número definitivo de mesas y autorización expresa de producción.
- Importante: Vercel Hobby indica uso **solo personal/no comercial** en sus términos. Verificar el plan aplicable antes de usar recepción de pedidos para un restaurante; no asumir que será siempre gratuito ni contratar/actualizar sin autorización.


## Control de acceso preparado (3 noviembre 2026)
- Cuenta de Google autorizada por configuración cifrada de **Preview** en Vercel; la dirección real no queda publicada en los archivos de prueba.
- La API de lectura exige un token de Firebase válido firmado por Google, proyecto correcto y coincidencia con el correo Google verificado en lista de acceso.
- Prueba de aplicación con JWT y SQL **simulados**: acceso de cuenta autorizada, rechazo de correo ajeno, rechazo de correo sin verificar, rechazo de otro proveedor, rechazo de token inválido y separación por sucursal. Además, marcar una solicitud dos veces devuelve conflicto y ninguna solicitud se marca pagada.
- Pruebas incorporadas al código de carta en `tests/mesa-acceso-bandeja.test.cjs`; Vercel Preview construyó el commit con las pruebas, pero `READY` **no demuestra por sí solo** que se haya ejecutado cada caso.
- `UKI_MESAS_QA_ENABLED` permanece en **false**. Ningún QR real puede enviar solicitudes todavía. No se han solicitado contraseñas ni se ha usado una sesión personal en los tests.
- **Bloqueador para la prueba real**: el panel QA aún no tiene URL de Preview operativa (los proyectos anteriores de Vercel apuntan a rutas legadas) y el origen de esa futura URL debe ser autorizado por la autenticación de Firebase y por CORS. No alterar la configuración de producción sin revisar.
- No anunciar conexión completa ni activar producción hasta probar inicio de sesión real del trabajador y un POST→GET→confirmación con almacenamiento QA, validación de cloud sync y costes.

## Prueba adicional 3 nov 2026 — carta → API → bandeja simulada

- Se verificó por código ejecutable el recorrido de **dos pedidos ficticios** desde la carta QR de Mesa 2, sucursal Regimiento Arica: pizza Pepperoni (2 x $9.000) y pizza Margarita (1 x $9.000); catálogo/precios obtenidos del `model.mjs` real del repositorio, sin alterar precios reales.
- API procesada en memoria contra un repositorio SQL **simulado**, no contra base real: 2 solicitudes únicas, montos $18.000 y $9.000, total ficticio $27.000, detalles de cocina y observación conservados, estados "pendiente".
- Reenvío del mismo pedido: misma respuesta, **sin tercera solicitud**; después de recibir confirmación, la carta vacía el carrito y permite otra ronda.
- En otra prueba simulada del panel se comprobó que dos rondas de Mesa 2 aparecen en una cuenta, que una cuenta pagada abre una cuenta nueva, que no se duplica un QR y que Mesa 3 queda aparte. No se registraron ventas reales.
- Mejoras posteriores: comanda con proteínas/vegetales, toppings (nombres reales), salsas y observaciones; se añadieron pruebas `node:test` al repositorio de la carta y `postinstall` para ejecutarlas durante el build del Preview.
- Vercel carta Preview quedó `READY` en el commit `2c08ba765c3dbc18ab0805ae1d025cf80fbbf5f8`, que incorpora estas mejoras. Estar `READY` no prueba por sí solo que hubo una llamada HTTP real.
- La cuenta del personal no está todavía autorizada (`UKI_MESAS_QA_ALLOWED_EMAILS/UIDS` sin configurar) y `UKI_MESAS_QA_ENABLED=false`. **No se habilitó POST público real ni la bandeja auténtica**, y no se probaron GET/PATCH con un token Firebase de trabajador.
- Se intentó publicar la rama de panel solo como Preview en proyectos Vercel preexistentes, pero falló debido a `rootDirectory` legado inexistente; **no se cambiaron las opciones de esos proyectos** ni el panel GitHub Pages. Evitar asumir que hay URL de panel Preview utilizable.
- Vercel no permitió abrir por el conector las vistas previas protegidas desde herramientas; por ello el test real navegador a backend y autenticar Google queda pendiente.
- Antes de habilitar: confirmar el Google del trabajador autorizado, resolver entorno aislado de vista previa que acepte Firebase Auth y CORS, probar POST real en Neon QA y GET/PATCH desde panel QA, comprobar sincronización cifrada sin conflictos; apagar flag y eliminar datos ficticios al terminar. No usar claves de usuarios reales en la prueba.

## Aceptación de cuenta en navegador aislado — comprobación completada

- GitHub Actions: `https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/41687589605` — **éxito** el 3 de noviembre de 2026.
- Se usó Chromium real en GitHub Actions y la página original v8.15 de esta misma rama, servida desde `localhost`, con almacenamiento temporal y clave inventada. El ensayo fue **sin autenticación real ni red de caja**, interceptando la consulta QR con dos solicitudes ficticias equivalentes en mesa/sucursal/importes. No se ingresaron contraseñas reales ni se emitieron pagos.
- Recorrido UI completado: entrar a sucursal Regimiento Arica, pulsar Pedidos → Revisar y registrar, guardar cuenta pendiente de $2.500, refrescar bandeja y añadir segunda ronda de $9.000, guardar misma cuenta de $11.500, comprobar no duplicación, cifra local AES y total caja $0. API real sin POST/PATCH.
- El pedido **real de QA** enviado por cliente desde carta ($2.500, Mesa 2, Regimiento Arica) fue verificado en Neon como **pendiente después de la prueba**. La prueba no lo registró ni marcó como pagado y no modificó producción.
- Diferencia pendiente de lanzamiento: validar autorización y guardado/sincronización real dentro del panel operativo antes de activar QR para público. La vista privada consultiva permanece en solo lectura y `UKI_OPERACION_HABILITADA=false`. No repetir esta comprobación de navegador salvo cambio del flujo.

## Sincronización cifrada de cuentas QR — control aislado

- Se detectó y corrigió la discrepancia entre el particionador (que incluye `borradores` y `ajustesHistoricos`) y los tipos admitidos por el cifrado; ambos se cifran ahora correctamente en las ramas de prueba.
- Ejecución verificada en GitHub Actions, 3 noviembre 2026: https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/41688525080 — **éxito**.
- Se ejecutaron dos pruebas aisladas: navegador real del panel v8.15 con botones «Revisar y registrar» y guardado local cifrado; y protocolos originales de cifrado, particionado, guardado/revisión y autoguardado con emulador **en memoria**, sin conexión a Firebase productivo.
- 8 controles de sincronización superados: cuenta pendiente y borrador, lectura completa, segunda ronda, conflicto de revisión, clave incorrecta, sucursales separadas, autoguardado de tercera ronda, sin pagos/propinas/cierre. El cliente QA real de Regimiento con pedido por $2.500 no fue cobrado ni aceptado.
- **No equivale a una prueba con Firestore real**: todavía requiere verificar permisos y recuperación en Firebase con sesión autorizada y almacenamiento aislado antes del lanzamiento. No activar QR público ni escrituras en producción sin autorización.

## Diagnóstico de permisos Firestore real (solo lectura) — 3 noviembre 2026

- La vista privada del panel Uki v8.15 añadió un chequeo automático de **solo lectura** mediante Firebase Web SDK `getDocFromServer(doc(db, "uki_operacion_v1", branch))`, una consulta de manifiesto para Regimiento Arica y otra para La Serena.
- Usa sesión Google existente; no descarga bloques cifrados, no pide clave y no llama a `cloud.guardar`, `writeBatch` ni `runTransaction`.
- Los posibles resultados son lectura autorizada con/sin manifiesto, `permission-denied` y `unavailable`. No se anuncia éxito de permisos hasta ver el resultado de la cuenta autenticada en el navegador.
- Vista privada desplegada READY en Vercel (commit `27c844bfd008249003e718ee577ac7dfe78f0976`); GitHub Actions pasó en ejecución 41689280664. Vercel SSO continúa activado, root/build temporal restituido. `UKI_OPERACION_HABILITADA=false`, sin escrituras operativas.
- **Pendiente**: la usuaria debe abrir desde Safari la URL estable de la vista de panel QA, ingresar con Google si hace falta y compartir el texto de «Comprobación de lectura de Firebase»; solo entonces sabremos si las reglas de lectura de Firestore real permiten el acceso. Una lectura exitosa no valida las reglas de escritura; para ello hará falta ambiente Firebase separado o emulador y una prueba autorizada antes de activar para clientes.

## Permisos de lectura Firestore verificados por la usuaria — 3 noviembre 2026

- La usuaria abrió la URL privada del panel v8.15 con `ukiadministracion@gmail.com` autenticado y compartió captura de la comprobación `getDocFromServer` sobre los dos manifiestos `uki_operacion_v1`.
- Resultado textual confirmado: **«Regimiento Arica: lectura autorizada (hay respaldo cifrado) · La Serena: lectura autorizada (hay respaldo cifrado). No se escribió ni modificó ningún registro.»**
- En la misma captura, la bandeja QA devolvió **Regimiento Arica: 1 pendiente**, **Mesa 2, Dianna, $2.500, 1 × 4 korokes**; **La Serena: 0 pendientes**. La consulta SQL separada en Neon QA verificó que dicho pedido sigue `pendiente`.
- Conclusiones: la autenticación y los permisos de **lectura** de los manifiestos Firestore reales funcionan en ambas sucursales; la consulta GET autorizada a pedidos QR de QA funciona. Este resultado no equivale a permisos de **escritura**, restauración cifrada o autoguardado real desde otro dispositivo.
- Mantener la prueba sin cambios de caja ni producción. Para comprobar escrituras antes del lanzamiento: usar exclusivamente un Firebase proyecto aislado o emulador con reglas verificadas, nunca los documentos `uki_operacion_v1/regimiento` ni `uki_operacion_v1/la-serena` de producción; las pruebas de emulador de cifrado ya pasaron en https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/41688525080.

## Firestore Emulator: escritura, lectura y seguridad QA comprobadas

- **GitHub Actions exitoso:** https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/41692635549 (dos trabajos en estado success: navegador del panel v8.15 y Firestore Emulator).
- Prueba nueva `tests/uki-qr-firestore-emulator.qa.mjs`: Firestore Emulator ejecuta operaciones reales del SDK y los módulos de Uki `crearSnapshotsUki`, `dividirEstado/reunirEstado` y cifrado AES-GCM sobre proyecto ficticio **`demo-uki-mesas-qa-aislado`**. El emulador fue creado en GitHub Actions, se cerró automáticamente y no tiene conexión a Firebase real.
- **11 comprobaciones aprobadas:** guardar cuenta y bloques cifrados, recuperar desde un segundo cliente, conservar borradores y ajustes históricos, no exponer contenido legible en documentos, acumular una segunda ronda en la misma cuenta ($11.500), impedir sobrescrituras con revisión antigua, rechazar contraseña incorrecta, separar Regimiento Arica y La Serena, impedir acceso no autorizado y anónimo con reglas **QA**, y conservar pagos/propinas/cierres en cero.
- Los archivos `tests/uki-firestore-emulator.rules` y `firebase-qa-emulator.json` definen reglas propias del emulador. **No equivalen a las reglas de seguridad reales de Firebase producción**. El acceso de solo lectura a manifiestos reales fue comprobado previamente por la usuaria, pero no hubo escrituras en sus registros.
- Estado: el protocolo de escritura/lectura entre sesiones está comprobado en emulador; queda pendiente validar reglas operativas verdaderas y estrategia de despliegue/publicación de QR en un entorno autorizado. No activar QR público ni alterar caja real sin autorización expresa.

## Seguridad real de Firestore: lectura sin sesión denegada

- GitHub Actions: `https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/41694275796`; resultado **success** de los dos trabajos de QA.
- Se probó desde Chromium con el SDK oficial de Firebase y **sin autenticación**, haciendo **solo GET** con `getDocFromServer` a tres rutas conocidas del proyecto operativo: manifiesto de Regimiento, manifiesto de La Serena y ruta de bloque interno inexistente.
- Las tres llamadas devolvieron `permission-denied` (**ACCESS_DENIED**). No se consultó `.data()`, no se mostraron ni exportaron registros, no se usaron contraseñas, **0 operaciones de escritura** y ningún cambio de producción.
- La prueba de lectura autenticada realizada previamente por la dueña se considera aprobada para dos manifiestos reales. La combinación demuestra lectura autorizada versus acceso anónimo prohibido, pero **no** prueba autorizaciones de escritura, acceso por otra cuenta autenticada ni la corrección íntegra de reglas reales.
- No existe `firestore.rules` de producción en el repositorio. El archivo `tests/uki-firestore-emulator.rules` es exclusivo de pruebas, **no equivale ni reemplaza reglas desplegadas en Firebase**. Para validar reglas de escritura en producción falta acceso autorizado a su configuración o el conector Firebase de la cuenta; no copiar reglas de emulador en producción.
- Mantener `UKI_OPERACION_HABILITADA=false` en la vista privada; la carta y el panel público siguen sin estos cambios. No activar pedidos QR públicos sin autorización expresa.
