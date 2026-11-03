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


## Continuidad verificada — 3 noviembre 2026 (sin publicar)

- **Versión que funciona:** caja/panel Uki v8.15 en la rama principal de GitHub Pages. Conservar tal cual, sin sustituir por simuladores ni desplegar encima.
- **QR para mesas:** únicamente en las ramas de preparación del panel y de la carta. El código añade las solicitudes a la bandeja, acumula rondas en una cuenta sin marcarla pagada y conserva detalle de cocina.
- **Correo del personal:** la lista cifrada de acceso de Vercel Preview contiene una cuenta autorizada; esto **no** autoriza automáticamente una dirección web en Firebase Authentication.
- **Problema reproducido con captura:** la vista de prueba de Vercel recibe `auth/unauthorized-domain` al pulsar Google. Firebase debe autorizar el dominio exacto de la vista previa, o debe probarse desde un origen autorizado. No volver a crear simuladores o enlaces para evitar este requisito.
- **API de recepción QA:** permanece desactivada mediante `UKI_MESAS_QA_ENABLED`; su CORS permite el origen de GitHub Pages. No activar ni cambiarlo en la carta pública.
- **Base de datos:** la rama independiente de Neon `uki-mesas-qa-2026-11-03` existe y se verificó con consulta de solo lectura: exactamente un pedido `registrado` y uno `rechazado` en Arica, ninguno pendiente; no se consultó ni modificó producción.
- **Prueba pendiente de verdad:** inicio de sesión Google en un origen autorizado, POST de un pedido ficticio a QA, lectura GET en la bandeja de la sucursal y confirmación PATCH, con persistencia segura y sin tocar caja real. Las 9 + 11 pruebas simuladas previas siguen válidas y **no deben repetirse** sin cambio de código.
- **Autorización:** no modificar producción, dominio, permisos de Firebase, carta de clientes ni contabilidad sin aprobación concreta; no crear versiones nuevas del panel o ampliar funciones.
- **Permiso CORS entre vistas de prueba (verificado):** se permitió exclusivamente el origen de GitHub Pages y el dominio fijo del panel privado de Vercel, dentro de la rama QR del repositorio de la carta. Cuatro comprobaciones aisladas superadas: panel original 204, panel QA 204, origen ajeno 403, recepción QA apagada 503. No se cambió producción ni se activó la recepción.

## Validación aislada de cuenta por mesa — 3 noviembre 2026

- Lectura de QA: el pedido enviado desde la carta está en Neon QA con `branch=arica`, `mesa=2`, nombre Dianna, total CLP 2.500 y estado `pendiente`. **No se tocó la fila**.
- Se ejecutaron **las funciones originales del panel** `ukiMesaAbrir` y `ndGuardar` en un entorno JavaScript aislado, con estados y pagos simulados; no se invocó nube operativa ni se modificó el navegador real.
- **5 comprobaciones superadas**: (1) primera ronda crea una cuenta pendiente de $2.500; (2) segunda ronda de $9.000 se agrega a la misma cuenta y suma $11.500; (3) los identificadores QR se guardan y repetir uno no duplica; (4) solicitudes de otra sucursal no ingresan en la cuenta; (5) una cuenta pagada no se reutiliza para otra ronda.
- **Pendiente de verificar**: hacer un registro/confirmación extremo a extremo en un panel aislado de persistencia de QA. La vista privada actual tiene `UKI_OPERACION_HABILITADA=false` y consulta de bandeja **solo lectura**, por lo que los cinco controles anteriores son pruebas de integración lógica, **no** una aceptación real en el navegador.
- **Producción y caja**: carta pública y panel operativo sin cambios; no se modificaron pagos, ventas, propinas ni cierres. El pedido QA de $2.500 conserva el estado `pendiente`. No activar para clientes sin autorización.
