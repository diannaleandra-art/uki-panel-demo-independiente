# Romo · correcciones de enlace y primera apertura segura (14-11-2026)

**Estado: solo rama interna `preparacion/uki-romo-sobre-main-20261114`, sin variables habilitadas y sin operaciones reales.**

## Fallos de preparación localizados
1. El formulario de apertura de Romo pasaba `desbloquearSobre` y `prepararEstadoInicial`, pero el adaptador de sesión esperaba `abrirCifrado` y `prepararNuevo` para esa apertura. Se corrigió esa diferencia **sin alterar el inicio de sesión de Uki**.
2. Cuando el puente remoto estaba apagado, la pantalla decía "Ingreso de prueba completado". Se corrigió para indicar claramente **conexión operativa pendiente**, sin afirmar que existe una sesión de Romo activa.
3. Un primer estado cifrado sin clave vinculada podía iniciarse con una contraseña equivocada. La ruta de primera escritura ahora exige **rol de dueños de Neon** y **al menos un verificador cifrado inscrito** en `romo_clave_compartida_v1`. La clave no se envía al servidor y la primera apertura permanece bloqueada mientras la tabla siga vacía.

## Datos verificados, solo lectura
- `romo_catalogo_v1`: 1 documento con 2 categorías, 7 productos, 40 ingredientes y 3 promociones. Los campos y `categoriaSlug` son compatibles con el lector de catálogo QA.
- `romo_estado_operativo_v1` y `romo_clave_compartida_v1`: vacías.
- No se hizo ninguna escritura SQL, registro de contraseña, migración, publicación comercial o cambio en las sucursales Uki.
- El estado de Romo NO equivale todavía a ventas operativas; siguen faltando permisos y enlaces para inventario, carta, pedidos, timbres, caja y cierres.
- Las pruebas de funcionamiento se harán manualmente en iPhone, no automáticamente.

**Regla de publicación:** mantener `main` de Uki y carta comercial Romo intactos hasta autorización de salida a producción.
