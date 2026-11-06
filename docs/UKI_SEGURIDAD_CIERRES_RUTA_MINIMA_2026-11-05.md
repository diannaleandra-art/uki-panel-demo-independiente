# Uki Sushi — separación de cierres: ruta mínima de implementación

Fecha: 2026-11-05. Proyecto exclusivo Uki Sushi. Solo código QA/Preparación.
No hay cambios en producción ni migraciones financieras ejecutadas.

## Resultado de la auditoría

El panel vigente utiliza `firebase/uki-sushi-local.html`, estado `S`.
`datosSoloSucursal()` guarda/copía todas las categorías, incluidos
`cierres`, `cajasDiarias`, `gastos` y `pedidos`.
`entrarDatosSucursal` abre el mismo bloque AES-GCM usando la contraseña
compartida de esa sucursal. La nube Firestore cifra también un snapshot
del estado unificado; `uki-particion-local.js` divide físicamente en
bloques, pero usa **la misma clave** de descifrado.

**Conclusión:** una pestaña Caja escondida o protegida con un botón no
puede garantizar privacidad frente a un trabajador que conozca la clave
del snapshot compartido. Una puerta visual Google tampoco basta si
se carga el snapshot completo en su navegador.

## Preparación ya realizada (reversible y sin impacto operativo)

- `firebase/uki-inventario-revision.html`: acceso independiente al
  inventario mediante llave QR de dispositivo autorizada, sin cargar
  snapshot operativo ni finanzas.
- `firebase/uki-inventario-reposicion.mjs`: calcula cantidades a reponer
  por mínimo configurado; envía la lista por WhatsApp manualmente.
- `firebase/uki-separacion-cierres-v1.mjs`: prototipo **sin conectar**
  de partición por lista blanca: pedidos e información operativa pasan
  al paquete de personal; caja/cierres/gastos/reportes y cualquier campo
  nuevo pasan al paquete reservado de administración.
- `tests/uki-separacion-cierres.test.cjs`: pruebas de no filtración
  de campos financieros, no pérdida de pedidos, aislamiento por sucursal,
  rechazo de campos prohibidos e invariantes de no publicación.
- Las pruebas pasan en GitHub Actions. No se cambió el almacenamiento real.

## Próxima implementación segura, sin rehacer todo el panel

1. **Respaldar y validar** una copia cifrada de ambas sucursales,
   además de la revisión remota actual y de los pedidos aún pendientes.
2. Crear dos almacenamiento/colecciones diferentes:
   - trabajo de personal (pedidos y datos operativos necesarios);
   - finanzas privadas (cierres, totales, gastos, balances y reportes).
   Deben tener **llaves de cifrado y permisos de servidor separados**.
3. Administración autentica con Google autorizado y obtiene exclusivamente
   el acceso a finanzas. El trabajador entra con equipo QR autorizado de
   su sucursal, registra pedidos/conteos y **no puede descargar ni descifrar**
   el conjunto financiero. Se preservan nombres de turno y PIN compartido
   donde siguen siendo necesarios, sin usarlo como llave financiera.
4. Hacer migración de ensayo **solo en QA** con una copia sintética/ficticia;
   verificar que no cambien folios, pagos mixtos, reparto, gastos, pre-cierre,
   historial, notas, WhatsApp ni fecha operativa.
5. Verificar lectura/escritura concurrente en dos teléfonos, cierres
   tardíos y retroceso seguro. Comprobar que un trabajador (también con
   el PIN anterior) no pueda abrir cierres, obtener respaldo financiero
   ni consultar reportes desde el navegador, API o Firebase.
6. Únicamente tras aprobación expresa, ejecutar plan de corte real
   con copia y rollback comprobados. **Nunca sustituir automáticamente
   los datos del día actual**.

## Estado: BLOQUEADO PARA PRODUCCIÓN

Las pantallas de inventario QA y la lista de reposición están verificadas.
La separación del panel operativo y los cierres NO está implementada.
Faltan autenticación y almacenamiento financiero separados; no promocionar
`uki-separacion-cierres-v1.mjs` sin esa implementación.

## Avance QA: doble cifrado por sucursal (2026-11-05, segunda etapa)

Implementados SIN conectar al almacenamiento vigente:
- `firebase/uki-bovedas-separadas-qa.mjs` crea **dos sobres AES-256-GCM**
  con sales, IV, claves PBKDF2 y contexto criptográfico separados:
  `operacion` (pedidos) y `administracion` (finanzas).
- Las claves deben ser diferentes; la de operación no puede abrir finanzas.
- El paquete y la validación están vinculados a la sucursal y al rol;
  se rechaza un sobre manipulado, intercambiado o de otra sucursal.
- `tests/uki-bovedas-separadas-qa.test.cjs` comprueba con datos
  ficticios que el trabajador no ve cierres ni gastos, que
  administración recompone todo sin pérdida de pedidos, y que
  el módulo NO modifica el cifrado de producción.
- Todas estas pruebas de la rama de preparación terminaron aprobadas.

**Pendiente antes de liberar:** permisos de servidor que impidan a un
trabajador incluso descargar el sobre financiero, migración atómica
con backups verificables, y prueba real de convivencia con la nube
actual. El cifrado QA por sí solo **NO** hace privados los cierres que
siguen en el snapshot compartido de producción.

## Avance adicional en QA (2026-11-05)

- **API independiente de administración:** `api/uki-finanzas-qa.js` del repositorio de carta usa
  autenticación Firebase Google con lista administrativa ya autorizada.
  Rechaza PIN, token de equipo y solicitudes sin sesión.
- **Cifrado exclusivo de QA:** `lib/uki-finanzas-qa-v1.cjs` conserva las once
  categorías financieras del estado actual (incluidas base, pagos de
  delivery y caja chica). Comprueba sucursal y usa una clave separada.
- **Neon QA:** existe `public.uki_finanzas_privadas_qa` sin registros,
  creado solo en `br-wild-sky-b5bruake`; NO hay cierres reales copiados.
- **Vercel:** API de carta en Preview
  `uki-sushi-pedidos-bh49s8v7s-diannaleandra-7046.vercel.app`;
  pantalla administrativa de consulta únicamente en QA
  `uki-sushi-panel-qa2026-diannaleandra-7046.vercel.app/firebase/uki-cierres-admin-qa.html`.
  Ambas despliegues llegaron a READY. No publicar el módulo en producción.
- **Configuración:** banderas y llave financiera establecidas exclusivamente
  en variables Preview de la rama de preparación. No tocar Production.
- **Ensayo sin escritura:** `firebase/uki-migracion-cierres-seca-qa.mjs`
  separa operación, once categorías financieras y campos adicionales
  sin descartarlos. Pruebas en GitHub confirman ambas sucursales,
  pagos mixtos, fechas operativas, integridad, no contaminación de sucursal.
- **Pendiente:** falta prueba manual positiva con Google administrador sobre
  la API desplegada y, más importante, aún falta un corte de datos seguro
  para mover las bóvedas reales sin detener pedidos. El PIN actual sigue
  pudiendo abrir la caja del panel vigente: NO se considera resuelto.
  NO ejecutar migraciones de datos reales sin aprobación expresa.

## Validación manual de administración en iPhone — 2026-11-05

La administradora comprobó en Safari la página QA de cierres privados:
`Google conectado`, `Consulta administrativa QA realizada`,
y en Regimiento Arica: cero cierres, cero gastos, cero días con caja.
La base Neon QA `public.uki_finanzas_privadas_qa` fue verificada
posteriormente y permanece sin registros. El despliegue de producción
de la carta sigue en `9b3debd5af8afcdf5d644078e02c0db21c2f09c3`
(`READY`), y las pruebas automáticas en GitHub finalizaron correctamente.

**Resultado:** consulta Google→API privada→Neon QA validada desde iPhone.
Esto **NO** confirma aún la migración de los cierres reales ni protege
por sí mismo los cierres actualmente accesibles con la clave antigua.
Antes de un corte productivo: respaldo verificable de ambas sucursales,
aislar lectura/escritura de finanzas en servidor, reconstrucción histórica,
comprobación de accesos sin Google y rollback sin pérdida de pedidos.
No cambiar producción sin autorización expresa.

## Acceso sencillo por un solo código administrativo — preparado, NO desplegado

En la rama de preparación QA se añadió `firebase/uki-cierres-admin-qa.html`
con un único campo `Código de administración (8 números)`. Google permanece
conectado desde la sesión autorizada del iPhone. El primer acceso ofrece
`Crear código de administración`; ese código se crea una vez y se comparte
**solo entre los administradores autorizados**, no con trabajadores. No se
almacena en el navegador ni se solicita al usuario que lo envíe al chat.

En la API `api/uki-finanzas-qa.js`, el código es **obligatorio para GET y PUT**
de los cierres, además del token Google administrador. `POST estado/crear`
permite comprobar si existe el código o configurarlo por primera vez.
`lib/uki-finanzas-admin-pin-qa.cjs` guarda exclusivamente hash PBKDF2 con sal
en Neon QA, nunca el texto del PIN; tiene máximo 5 intentos por identidad
Google y bloqueo de 15 minutos con reserva SQL atómica. Los trabajadores
con PIN o dispositivo compartido no acceden al endpoint financiero.

Neon QA tiene las tablas `uki_finanzas_admin_pin_qa` y
`uki_finanzas_pin_intentos_qa` vacías. La migración SQL reproducible está
en `migrations/2026-11-05-uki-finanzas-pin-qa.sql`. Las pruebas
automáticas del backend y de la página fueron aprobadas.

**Bloqueo de publicación (2026-11-05):** Vercel rechazó crear la nueva
Preview por cuota `402 api-deployments-free-per-day`. No existe todavía
un despliegue nuevo con el código administrativo. La página QA previamente
publicada sigue mostrando Google sin el campo de código. No ofrecerla como
si ya incluyera la función. Tampoco se activó protección nueva en el panel
real. Las ventas y cierres reales continúan intactos. Aun después de
publicar QA, falta la migración separada del snapshot legado antes de
habilitar privacidad efectiva de cierres en producción.

## Control de corte y preservación integral — misma etapa de QA

Se incorporó `firebase/uki-corte-seguro-qa.mjs` con comprobación SHA-256
de ida y vuelta de una COPIA sintética; no se conecta a red ni datos reales.
`tests/uki-corte-seguro-qa.test.cjs` comprueba las dos sucursales,
pagos mixtos, cierres del día anterior y que no se habilite producción
mientras no se pruebe la recuperación de respaldos, el bloqueo de lectura
del snapshot antiguo, la operación nueva y la autorización expresa.

**Hallazgo que impide una liberación precipitada:** en el almacenamiento
actual los trabajadores con la clave vieja podrían descifrar datos de
caja si todavía conservan acceso al snapshot o al respaldo local. Crear
un código nuevo para Administración NO revoca esas copias antiguas.
El paso real deberá retirar lectura a `uki_operacion_v1`, manejar
los equipos antiguos con intervención de sus titulares, rotar claves
operativas y preservar el histórico en el área privada.

Se ajustó el contrato de la bóveda financiera QA para guardar también
`adicionales` (12.º campo), que contiene otros metadatos del estado
que NO deben perderse. Se añadió conversión compatible en
`firebase/uki-migracion-cierres-seca-qa.mjs` y validación de ida y
vuelta con pruebas aprobadas en GitHub para ambos repositorios.

**Capacidad de datos:** la API QA actual admite como máximo 240 KB de
contenido financiero. La simulación falla explícitamente si el historial
supera ese tamaño, sin recortarlo. Antes de mover cierres reales se debe
medir su tamaño y, si hace falta, implementar bóvedas cifradas por partes
y recuperación verificada. No se ha medido ni transferido el historial
real, que requiere acceso del propietario al respaldo descifrado.

**Estado verificado:** código, pruebas y simuladores completados solo
en las ramas de preparación. El servidor QA actualmente publicado todavía
usa el contrato anterior; no se debe presentar como una migración ya
activa. No hay autorización ni ejecución de corte real. La carta pública
y el panel operativo actual continúan intactos.
