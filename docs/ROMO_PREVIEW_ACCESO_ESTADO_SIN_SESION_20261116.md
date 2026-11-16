# Corrección: fallo en formulario de acceso Romo (2026-11-16)

La captura mostraba el encabezado Romo correcto, pero el contenido se sustituía por «No se pudo mostrar esta pantalla». La causa es la consulta de `window.ukiRomoSesionRemotaQA.estado()` en `render()` cuando únicamente estaba elegida `S.pinSuc=Romo`.

La función `estado()` del módulo `romo-panel-unico-sesion-qa.mjs` llama a `requireSession()`, que lanza error si el usuario todavía no ha iniciado la sesión remota. El cambio anterior había extendido esta consulta desde la sucursal abierta a la pantalla previa de acceso; por ello fallaba precisamente al abrir el enlace por primera vez.

## Solución
- En la pantalla de acceso **no** se consulta `estado()` ni la base de datos de Neon; se muestra simplemente el estado descriptivo de acceso.
- Después de abrir Romo, la sesión confirmada sí permite consultar su revisión real. Una sesión no disponible no debe bloquear el renderizado de la pantalla.
- Se mantienen inalterados los permisos Google/Neon, el manejo de clave, los pagos, la caja y la operación de Uki.
- El dominio Firebase puede necesitar autorización aparte; este arreglo solo corrige el error visual concreto de la captura.

Verificación de usuario pendiente: abrir el enlace estable Romo en iPhone, comprobar que aparezca el formulario completo y luego autorizar Google en Firebase para ingresar. No se hicieron pruebas comerciales ni transacciones.
