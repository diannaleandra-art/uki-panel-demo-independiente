# Corrección de acceso al Preview de Romo (16-11-2026)

Captura reportada: al abrir `/romo-panel-qa/index.html`, se veía la configuración de nube de las dos sucursales Uki y Firebase devolvía `auth/unauthorized-domain`. Esto confunde el acceso, pero el error ocurre antes de autorizar Google y no modifica los datos de caja.

## Cambios
- La ruta exclusiva de Romo inicia directamente en la pantalla de acceso de Romo, conservando selector de otros locales cuando se elige de forma explícita. `?sucursal=regimiento` y `?sucursal=la-serena` siguen identificando Uki, sin tocar producción.
- Encabezado y estilos se ajustan a Romo negro/rojo/blanco antes del login. La sección visible "Cargar nube" (Firebase Uki) se oculta SOLO cuando se está entrando a Romo.
- El formulario muestra botón Google que usa EXACTAMENTE el controlador Firebase ya existente y la contraseña habitual de acceso, sin inventar autenticación alternativa. Aparece estado de Google propio de Romo y un aviso comprensible de dominio no autorizado.
- El error `auth/unauthorized-domain` no se puede reparar desde JS. La consola Firebase del proyecto `uki-panel-f4909` exige registrar como dominio autorizado el alias estable de Vercel `uki-sushi-inventario-git-preparacion-c0b0e9-diannaleandra-7046.vercel.app`. Es una acción administrativa externa que requiere autenticación de la propietaria en Firebase, no se fingirá realizada.
- No se cambiaron claves, Google Auth, políticas de Neon, pedidos, cierres, inventario o datos Uki. No se activan ventas reales.
