# Acceso seguro de Romo · prueba manual desde iPhone

**Rama**: `preparacion/uki-romo-sobre-main-20261114` — sin publicar en el dominio de producción. Última revisión 14-11-2026.

## Preparación final
- Se enlazaron tres rutas **de lectura y vinculación**, sin habilitar pedidos ni caja:
  - `GET /api/romo-claves-lectura-qa`: verifica prueba cifrada de la contraseña.
  - `POST /api/romo-clave-alta-duenos-qa`: primer registro de prueba cifrada (solo dueño autorizado).
  - `GET /api/romo-catalogo-lectura-qa`: consulta del catálogo completo en modo solo lectura.
- La ruta operativa `ROMO_OPERATIVO_ENDPOINT_QA` **continúa vacía**.
- `romos_app_service` conserva privilegios de lectura de claves/catálogo y escritura restringida al estado operativo, aunque el endpoint sigue desactivado.
- Cuenta separada `romos_clave_alta_qa_20261114`: exclusivamente INSERT en `romo_clave_compartida_v1` y SELECT de columna `uki_source` necesaria para `RETURNING`. No puede leer el ciphertext del verificador, ni el catálogo, ni la caja, ni cambiar datos; sin acceso a tablas Uki. Su contraseña se guarda cifrada en el entorno de vista previa, rama exacta.
- La aplicación solo envía la **prueba AES-GCM**, nunca una contraseña ni un archivo.

## Verificación desde origen real de Uki
La vista previa de Vercel tiene almacenamiento local independiente del dominio del panel habitual. **No se puede verificar la clave mediante un localStorage nuevo creado en esa vista**: permitiría registrar una contraseña arbitraria.

El formulario exige un archivo de **respaldo cifrado `uki-v812-cifrado` de una sucursal Uki real**. En el Uki habitual la dueña lo genera desde Caja usando la **misma contraseña habitual** como clave del respaldo y selecciona ese archivo JSON desde el iPhone; se valida únicamente en el navegador con `ukiDescifrarRespaldo`. El servidor no recibe los registros descifrados, ni siquiera el archivo.

### Prueba manual pendiente
1. Entrar al Uki habitual, sucursal correspondiente, y descargar un respaldo cifrado desde Caja con la misma contraseña habitual.
2. Abrir la vista previa del panel único, iniciar sesión Google autorizada, elegir Romo La Serena y abrir «Vincular la contraseña habitual».
3. Seleccionar la sucursal original de Uki, el archivo JSON y la clave de ese respaldo. Pulsar Vincular.
4. Confirmar en Neon que el primer verificador cifrado quedó inscrito (sin revisar contenido). Comprobar lectura usando misma cuenta.
5. Todavía NO registrar ventas; las funciones de pedidos, caja, timbres, cierres e inventario seguirán inactivas hasta pruebas manuales específicas y aprobación.

**Sin pruebas automáticas, sin traslado de secretos de producción, sin cambios a main ni al catálogo real Romo.**