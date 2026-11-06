# Uki Sushi — integración simple del inventario, QA 2026-11-06

## Alcance autorizado por la dueña
Mantener exactamente igual el ingreso del agendador y administración, los
pedidos, la caja, los cierres, la carta de clientes y las mesas.
Solo separar el acceso **para trabajadores que cuentan el inventario**.
Disponibilidad Agotado / Disponible **siempre manual**, nunca por stock.
Agendador/administración siguen administrando productos desde el panel.
No migrar los cierres reales ni activar el código financiero QA.

## Implementación preparada, sin reemplazar la versión real

**Trabajador:** `firebase/uki-inventario-turno-qa.html`.
Entra con sucursal, nombre y un código exclusivo de inventario (6 números).
Puede consultar existencias, contar, registrar entrada y guardar revisión
del turno; después comparte **esa misma revisión** por WhatsApp.
No recibe permisos de caja, pedidos, agregar productos ni disponibilidad.
No necesita correo, Google ni código del agendador.

**Administración:** `firebase/uki-inventario-administracion-qa.html`.
Con Google previamente autorizado, crea una vez el código del inventario,
consulta últimas 20 revisiones de cada sucursal, responsable, fecha y faltantes.
La pantalla está enlazada desde el inventario del panel QA existente.
La clave no se guarda en el teléfono ni se debe enviar por ChatGPT.

**Backend:** `api/inventario-turno-qa.js` (repo
`diannaleandra-art/uki-sushi-respaldo`):
POST actions `estado`, `crear-codigo`, `listar`, `contar`,
`recibir`, `finalizar`, `reportes`. `estado`, creación de código
y reportes exigen JWT Google admin autorizado. Las acciones de trabajador
exigen el PIN exclusivo, con bloqueo de intentos en Neon QA. El servidor
controla por sucursal, solo escribe stock y auditoría; nunca cambia
`available` automáticamente. El informe se deriva del stock del servidor
y se guarda con `request_id` único antes de abrir WhatsApp.
Los reportes se almacenan en `uki_inventario_revisiones_qa`.

**Base de pruebas:** tablas nuevas
`uki_inventario_pin_qa`, `uki_inventario_pin_intentos_qa` y
`uki_inventario_revisiones_qa`, creadas exclusivamente en Neon
`br-wild-sky-b5bruake` y recogidas en el archivo SQL de migración
`migrations/2026-11-06-uki-inventario-turno-qa.sql`.
Flag `UKI_INVENTARIO_QA_CODIGO_ENABLED=true` configurada **solo
para el Preview de esta rama**, no en producción.

## Publicación

**PENDIENTE**. La última publicación manual Preview del backend intentada
el 6 de noviembre de 2026 fue denegada por límite de Vercel
`api-deployments-free-per-day` (HTTP 402).
La nueva ruta `/api/inventario-turno-qa` aún NO existe en el backend
anteriormente desplegado; las páginas nuevas tampoco están publicadas.
Los enlaces constantes `API` de las dos páginas de QA todavía apuntan
al backend Preview anterior y DEBEN ACTUALIZARSE al URL del nuevo backend
después de publicarlo. No entregar estos enlaces como funcionales aún.

## Antes de aprobar la liberación

1. Confirmar el éxito de pruebas automáticas de ambos repositorios.
2. Publicar **solo backend Preview** cuando permita Vercel y verificar estado READY.
3. Actualizar en ambos HTML el `API` para usar el nuevo Preview.
4. Publicar **solo panel Preview** y asignar alias QA (NO producción).
5. Google admin crea código de 6 números desde el iPhone (NO enviarlo al chat).
6. Con otro móvil comprobar que sin Google y con código correcto puede
   guardar conteo, recibir, enviar WhatsApp; comprobar que la revisión
   aparece en administración de la sucursal correcta.
7. Comprobar que el inventarista no abre ni modifica productos, disponibilidad,
   pedidos ni caja. Comprobar cambios manuales de agotados y edición de
   productos por el agendador/administración, y que la carta pública refleje
   los cambios antes de activar producción.
8. Solicitar autorización para producción por separado; nunca publicar
   automáticamente. La versión operativa vigente permanece intacta.

El inventario con acceso por QR/dispositivo aprobado anteriormente no se ha
borrado ni reemplazado. Esta rama sirve de prueba y preparación de la
simplificación solicitada.

## Incidencia y corrección preparada, 2026-11-06

La propietaria creó con éxito el código privado de 6 cifras en QA y
abrió la pantalla del trabajador (Regimiento Arica, con nombre). Al tocar
«Abrir inventario» apareció «No se pudo guardar el inventario de
pruebas; no envíes datos sin comprobar». No se realizó un conteo real.

Verificaciones: Neon QA conserva 1 código, 0 revisiones, registros de
catálogo presentes y no hay bloqueos de PIN persistentes; la consulta
SQL del catálogo responde en Neon. El problema se ubica en la carga del
listado tras la autorización, aunque **la causa exacta de la excepción
no pudo leerse**: la consulta de logs de Vercel devuelve 403.

En el repositorio de carta, rama de preparación y NO producción, se
preparó `lib/uki-inventario-lectura-qa.cjs` para leer el catálogo con
un módulo independiente, sin llamar una API desde otra API. El endpoint
`api/inventario-turno-qa.js` lo utiliza para `listar` y
`finalizar` y devuelve identificadores de etapa `INV-PIN`,
`INV-CAT`, `INV-API` si reaparece un 503, sin exponer el PIN.
Pruebas de carga real del catálogo y de lectura QA aprobadas en GitHub.
Último commit backend aprobado:
`df7fa1ccb808d32dd1cd92dc8731167da1fd7270`.

Se preparó un enlace constante de API
`https://uki-sushi-inventario-qa2026-diannaleandra-7046.vercel.app/api/inventario-turno-qa`
en los dos HTML del panel. **Todavía NO está asignado a un despliegue**.
El panel actualizado en GitHub pasó CI, pero **no está publicado**.

La nueva publicación de backend QA fue RECHAZADA por Vercel con HTTP
402 `api-deployments-free-per-day`; la herramienta CLI alternativa
no está instalada ni tiene autenticación en el entorno. No intentar
actualizar alias o publicar panel hasta que el backend corregido tenga
un despliegue READY. Tras publicarlo, asignar el alias estable
`uki-sushi-inventario-qa2026-diannaleandra-7046.vercel.app`;
luego publicar el commit más reciente del panel QA y reasignar
`uki-sushi-panel-qa2026-diannaleandra-7046.vercel.app` a ese
nuevo despliegue.

**No está comprobada aún la solución desde Safari.** No pedirle a la
usuaria que cambie el código existente, vuelva a registrar productos
o repita pruebas previas. Solo solicitar abrir el inventario una vez
cuando los dos despliegues estén listos. Producción intacta.
