# Uki Sushi · Conexión Firebase (etapa privada de preparación)

**Estado:** NO PUBLICADO. No está habilitado para pedidos reales. El panel v8.15 en `main` no se modifica.
**Proyecto Firebase:** `uki-panel-f4909` (Spark, según comprobación de la propietaria en consola).
**Aplicación web:** registrada y con Google Sign-In habilitado.
**Firestore:** creado con reglas iniciales `allow read, write: if false`, que deben mantenerse hasta validar las reglas específicas.

## Archivos nuevos (solo rama preparatoria)

- `firebase/firestore.rules`: plantilla de acceso con Google verificado, administrador y autorización por sucursal. No aplicada a Firebase. La plantilla restringe los documentos de prueba, no permite listar sucursales y prohíbe eliminar los estados compartidos.
- `firebase/conexion-qa.html`: página independiente para una prueba ficticia de Google + Firestore; no es el panel operativo y no guarda pedidos. Solo escribe `PRUEBA_FICTICIA` bajo `uki_qa_conexion/{uid}`.

## Comprobaciones previas a una prueba accesible desde iPhone

1. Confirmar permiso de la propietaria para publicar **solo** la página `firebase/conexion-qa.html` (la publicación en el mismo sitio GitHub Pages no hace privada la página). Nunca fusionar los cambios del panel sin nueva aprobación.
2. En Firebase Authentication > Configuración > Dominios autorizados, autorizar `diannaleandra-art.github.io`. Sin ese paso, la ventana Google puede fallar con `auth/unauthorized-domain`.
3. Tras revisión de la propietaria, publicar las reglas revisadas desde `firebase/firestore.rules` en Firestore > Reglas. **No** seleccionar modo de prueba ni `allow read, write: if true`. Confirmar cuenta administrativa de Google y ejecutar pruebas de denegación con otra cuenta.
4. Comprobar el inicio Google en Safari y lectura/escritura **exclusivamente ficticia** en `uki_qa_conexion`. Probar denegación con correo no autorizado. No registrar datos de clientes.
5. Conectar el guardado real solo en una rama sin publicar; preservar v8.15 y los respaldos cifrados. Diseñar concurrencia para que el celular y computador no sobrescriban pedidos; no basta con guardar el objeto completo sin control de versión. Probar dos dispositivos simultáneamente.
6. Revisar respaldos recuperables, límite de 1 MiB por documento de Firestore y límites del plan Spark antes de cualquier aprobación para operaciones reales.

## Protecciones

- No tocar la carta pública original de Uki, Romo’s ni otros proyectos.
- No cargar pedidos reales ni subir backups de demostración automáticamente.
- Nunca usar credenciales administrativas de Firebase en HTML/JS: solo configuración web pública.
- Nunca autorizar todo usuario Google a leer/escribir. `request.auth != null` no es un permiso suficiente.
- No habilitar pagos, Blaze, Cloud Functions ni hosting de pago.
- Si los conflictos entre dispositivos o la recuperación de datos no pasan pruebas, detener la salida a producción.

## Referencias oficiales

- Seguridad y autenticación: https://firebase.google.com/docs/rules/rules-and-auth
- Configuración de la app web: https://firebase.google.com/docs/web/setup
- Problemas Safari/redirect: https://firebase.google.com/docs/auth/web/redirect-best-practices
- Límites gratuitos Firestore: https://firebase.google.com/docs/firestore/pricing
