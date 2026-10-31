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

## Revisión de escala realizada el 31 de octubre de 2026

La conexión QA con Google ya fue probada por la propietaria en Safari: autenticación, escritura ficticia, lectura ficticia y denegación de lectura de datos operativos. No repetir las pruebas salvo que se modifiquen permisos.

**Hallazgo bloqueante para producción:** Firestore admite máximo **1 MiB por documento**. La primera versión de `uki-sync-core.js` utiliza un documento de estado completo por sucursal, útil para demostrar control de revisiones, pero **no debe conectarse como almacenamiento operativo definitivo**, porque crece con pedidos, clientes e historial. Además, no resuelve automáticamente conflictos de dos trabajadores; solo impide sobrescritura silenciosa.

Nueva prueba local `uki-particion-local.js`:
- Separa pedidos y movimientos por períodos y clientes/caja por grupos.
- Se verificaron 5.000 pedidos y 1.000 clientes: 58 bloques de menos de 180 KB; reconstrucción exacta de pedidos y preservación de caja; rechazo de sucursales mezcladas.
- **No contiene cifrado ni realiza escrituras de red.** Jamás subir estos bloques en texto claro. Deben cifrarse antes del almacenamiento y versionarse con transacciones y reglas por sucursal.
- Pendiente: integrar partición y cifrado de bloques, sincronización segura, manejo de conflictos offline, respaldos exportables, revocación de trabajadores, pruebas reales de dos dispositivos, validación de consumo Spark.

La v8.15 de GitHub Pages se mantiene sin cambios; no publicar ninguna migración sin autorización de la propietaria. Ningún archivo de esta rama se debe representar como listo para pedidos reales.

## Cifrado de bloques preparado (rama aislada)

Se creó `firebase/uki-cifrado-bloques.js` con cifrado AES-256-GCM por bloque, IV aleatorio, contexto autenticado que vincula sucursal+generación+tipo+grupo+número y clave derivada mediante PBKDF2 (300.000 rondas). No contiene contraseñas ni hace llamadas de red.

**Prueba de estructura (7 casos):** recuperación de paquete, ausencia de texto claro en salida, rechazo de otra sucursal, otra generación, tipo alterado, contraseña incorrecta y contraseña demasiado corta. Las pruebas utilizaron **una simulación de WebCrypto**, no una verificación criptográfica real; se debe probar el WebCrypto nativo de Safari y la interoperabilidad entre dispositivos antes de operar.

**Pendientes obligatorios:** protocolo de commit atómico/versionado que no exceda la cuota de 10 MiB por transacción, recolección segura de versiones antiguas sin pérdida de respaldos, reglas Firestore específicas por bloque, integración con acciones del panel existente, visualización de conflictos (no sobrescritura), recuperación de error de red y prueba concurrente con dos navegadores. El `uki-sync-core.js` que escribe un documento entero sigue siendo un prototipo de bloqueo, NO debe utilizarse como almacenamiento operativo. Las reglas actualmente publicadas solo permiten la colección `uki_qa_conexion` a la cuenta de administración y deniegan el resto.
