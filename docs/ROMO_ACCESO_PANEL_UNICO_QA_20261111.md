# Romo Balmaceda — mismo panel Uki y mismas contraseñas
**Fecha:** 2026-11-11 · **Estado:** QA exclusivamente, sin activación de operaciones.

## Objetivo aprobado por la propietaria
En el mismo panel existente se debe elegir:
1. Uki Regimiento Arica
2. Uki La Serena
3. Romo’s Sushi La Serena — Balmaceda 1612

Romo debe usar **la misma sesión Google y una de las contraseñas existentes de Uki**.
No agregar un segundo panel, un inicio de sesión diferente ni una contraseña nueva.
Los pedidos, caja, catálogo, inventario y cierres de Romo se aislarán en su propia
base y su propio scope `romo:serena`, nunca en `uki_operacion_v1`.

## Integración de backend preparada en el proyecto Vercel del panel Uki (RAMA QA)
- `api/romo-claves-lectura-qa.js` — GET protegido; nunca acepta escribir claves.
- `lib/romo-identidad-servidor-qa.mjs` — verifica Firebase ID token firmado
  de la instancia Google actual `uki-panel-f4909`; consulta `activo=true`
  en `public.romo_personal_acceso_v1` de la base Neon Romo.
- `lib/romo-claves-lectura-servidor-qa.mjs` — lee únicamente comprobantes
  cifrados del local `romo:serena` desde `public.romo_clave_compartida_v1`.
- `lib/romo-clave-compartida-qa.mjs` y `lib/romo-scope-operativo-qa.mjs` —
  formato cifrado y restricciones de local/rol.
- `firebase/uki-romo-clave-remota-qa.mjs` — validación de la contraseña
  **en el teléfono**; la contraseña nunca se transmite a Neon ni al backend.
- `firebase/uki-sushi-local.html` — formulario Romo reutiliza la pantalla,
  ofrece solo «Abrir sucursal» y deja sin alterar Uki Serena/Arica.

## Protecciones actuales
- `ROMO_ACCESO_CLAVES_LIVE_ENABLED` no está habilitado.
- `ROMO_PROOFS_ENDPOINT=''` en el cliente: no realiza solicitudes remotas.
- El servidor exige `VERCEL_ENV=production`, origen permitido
  `ROMO_PANEL_ALLOWED_ORIGIN`, hostname independiente de Uki y conexión
  `ROMO_PRIVATE_DATABASE_URL` hacia `romos_sushi`.
- La cuenta Neon `romos_app_service` puede solo hacer SELECT en
  `romo_clave_compartida_v1`, sin INSERT/UPDATE/DELETE.
- No hay todavía registros de contraseñas, usuarios autorizados ni pedidos.
- La lectura exige sesión Google firmada **Y** registro de permiso Romo.
- Se rechazan verificador cruzado, duplicado, falta de origen, método POST,
  sesión ausente e intento de activación en preview.

## Pruebas y alcance
Se incorporaron tests QA para ruta inactiva, CORS, lectura con roles y
comparación cifrada multi-dispositivo. Se hicieron simulaciones de toda la
ruta API con dependencias falsas que pasaron 12/12, **no equivalen a
pruebas reales en iPhone ni a habilitación del proyecto**.

## Pendiente — no efectuar sin autorización específica
1. Identificar y aprobar la(s) cuentas Google que accederán a Romo; poblar
   `romo_personal_acceso_v1` mediante proceso de administración seguro.
2. Realizar el enrolamiento de verificadores cifrados **en la sesión de dueños**,
   comprobando la contraseña existente de Uki, sin enviarla a ChatGPT.
   Actualmente la tabla está vacía; no se debe crear ni inventar contraseñas.
3. Configurar las credenciales de Neon y el origen exacto del panel en los
   secretos protegidos de Vercel. No reutilizar credenciales de Uki.
4. Vincular la URL aprobada de la API al cliente, primero con pruebas aisladas.
5. Conectar **luego** pedidos completos, medios de pago/caja y cierres Romo,
   verificando los permisos y tarifas. Mantener pedidos reales de Romo
   bloqueados hasta la aprobación de publicación y pruebas reales.

**No cambiar producción del panel Uki, no contratar planes ni activar Romo.**

## Cuenta de dueños identificada (preparación, sin asignar permisos)
- La propietaria identificó en conversación la cuenta Google actual de administración.
- Por privacidad, **el correo no se agrega al código fuente ni a pruebas públicas**.
- Se preparó `ROMO_DUENOS_GOOGLE_EMAIL` como variable de entorno privada
  del servidor, aún sin configurar ni habilitar.
- Para un rol `duenos` se exige además un token Firebase Google firmado,
  correo verificado e idéntico al configurado y **UID activo con ese rol**
  en `public.romo_personal_acceso_v1`.
- No se convierte el correo en acceso automático y no se crean permisos
  a partir del email. El UID fiable se obtiene de la sesión Google real
  verificada por el servidor en una fase autorizada.
- El panel y la contraseña no cambian; trabajadores conservan sus roles.
- Test QA `tests/romo-duenos-google-qa.test.mjs`: denegar cuenta sin
  registro Neon, email no coincidente, no verificado, proveedor distinto
  y ausencia de variable privada.
- Actualmente no hay permiso de dueños otorgado, claves cifradas inscritas
  ni operaciones Romo habilitadas.


## Preparación para reconocer el Google de dueños (sin permisos reales)
- Se preparó `api/romo-duenos-vinculo-qa.js` en el mismo proyecto del
  panel Uki y `lib/romo-duenos-vinculo-qa.mjs` para verificar la firma
  del token Firebase existente y comprobar el correo configurado
  PRIVADAMENTE como `ROMO_DUENOS_GOOGLE_EMAIL`.
- El resultado **solo confirma la cuenta Google y su UID en memoria del
  servidor**, pero **no crea filas ni autoriza a operar Romo**.
- `firebase/uki-romo-vinculo-duenos-qa.mjs` aprovecha
  `window.ukiInventarioToken` del inicio de sesión ACTUAL de Uki:
  no se muestra ni crea otro inicio de sesión ni otra contraseña.
- Protección por doble condición: `VERCEL_ENV=production` y
  `ROMO_DUENOS_VINCULO_ENABLED=true`. Ambas deben configurarse
  explícitamente en una etapa aprobada; sin ello retorna 503.
- Cliente con `ROMO_DUENOS_CHECK_ENDPOINT=''`: ningún token enviado ni
  consulta realizada mientras esté apagado.
- El endpoint deniega orígenes ajenos, métodos de escritura y tokens de
  pruebas o no firmados. No entrega el UID al navegador ni lo registra en
  ninguna tabla.
- Pruebas QA: `tests/romo-duenos-vinculo-qa.test.mjs` y
  `tests/uki-romo-vinculo-duenos-qa.test.mjs`. Se ejecutó una
  simulación de 20 comprobaciones, 20 correctas; todavía no se ha hecho
  inicio real entre iPhone, Firebase y Neon.
- **Importante:** el correo indicado por la propietaria no demuestra
  por sí solo cuál es el UID de su sesión Firebase. Ese UID se obtendrá
  únicamente de un token firmado al completar el flujo real autorizado.
- Para la siguiente etapa se requiere consentimiento específico antes
  de habilitar el endpoint en producción, guardar secretos de Romo o
  dar alta en `romo_personal_acceso_v1`. El acceso sigue sin habilitarse.


## Continuación 12 noviembre 2026 — NO rehacer el ingreso
- Ya existe selector único con Uki Regimiento Arica, Uki La Serena y Romo La Serena.
- Ya existen acceso del panel Uki, Firebase Google, módulo de verificación remota de claves y base independiente Romo.
- **No crear otra app, cuenta Google, contraseña, PIN, pantalla de ingreso o servicio duplicado.**
- Corrección ya implementada: la API de lectura de claves usa el adaptador Neon de consulta adaptarNeonParaClavesRomoQA y solo lee roles / verificadores de Romo.
- Nueva protección createRomoPassProofAfterUkiUnlockQA: únicamente prepara el verificador cifrado si la contraseña abre la sucursal Uki indicada, para no vincular accidentalmente una contraseña distinta. No guarda ni transmite la contraseña.
- La batería de prueba de integración se amplió a 64/64 aprobadas; simulación de móvil también aprobada. Revisión: https://github.com/diannaleandra-art/uki-panel-demo-independiente/actions/runs/43292247007
- El registro real de roles y verificadores de Romo sigue vacío según lectura Neon de hoy. ROMO_PROOFS_ENDPOINT sigue vacío y activación de acceso real sigue deshabilitada.
- **Próxima acción que sí cambia el estado real (REQUERIR APROBACIÓN EXPRESA):** inscripción segura de la cuenta Google ya existente como dueña y preparación del comprobante cifrado de la contraseña actual desde el propio navegador autorizado; luego configurar secretos/URL y verificar en Safari. No pedir ni copiar claves, tokens ni correo personal en este chat.
- Solo después, con aprobación expresa adicional, habilitar transacciones comerciales de Romo. Hasta entonces el panel real de Uki se deja intacto.

No volver a implementar contraseña/Google desde cero. El objetivo es dar acceso a la tercera sucursal del MISMO panel y completar la vinculación restante.


## 2026-11-12 — Alta dueña Romo, autorización expresamente recibida (solo esa cuenta)
- La propietaria autorizó vincular **su misma cuenta Google de Uki** como dueña de `romo:serena`, sin habilitar ventas ni cambiar las credenciales Uki.
- Verificado: Vercel `uki-sushi-inventario` ya contiene las variables protegidas ROMO_DUENOS_GOOGLE_EMAIL y ROMO_PANEL_ALLOWED_ORIGIN (no imprimir sus valores). Neon Romo sigue con 0 dueños activos y sin UID verificado.
- Se agregó lib/romo-duenos-alta-qa.mjs: usa exclusivamente la firma Firebase de la sesión Google actual, el correo de dueña configurado en servidor y un INSERT condicionado a la tabla de acceso Romo; nunca toma UID, correo, rol ni clave enviados por formulario. Repetir solicitud ya vinculada no duplica la cuenta.
- Se agregó api/romo-duenos-alta-qa.js: POST con cuerpo JSON vacío y bearer Google, origen exacto, todos los controles apagados por defecto y respuesta sin UID/correo/contraseña. No abre caja, productos, ni pedidos.
- Requiere un usuario técnico de DB con privilegios mínimos con nombre `romo_owner_linker`, configurado en variable privada ROMO_DUENOS_ALTA_DATABASE_URL, sobre host propio de Romo y base `romos_sushi`. **La cuenta técnica todavía NO fue creada ni se concedieron permisos adicionales.**
- ROMO_DUENOS_ALTA_EXPLICITA_ENABLED no está habilitado, ruta no está publicada a producción, aún no existe sesión Google firmada recibida en este flujo. Por lo tanto: **la dueña NO está vinculada todavía**.
- Pruebas QA en tests/romo-duenos-alta-qa.test.mjs; GitHub Action 43295852316 verificó 88/88 pruebas y revisión visual móvil, todas aprobadas.
- La única manera legítima de obtener el UID es mediante la misma sesión Google autenticada en la interfaz vigente. No inventar ni pedir tokens en el chat. No convertir correo a permiso sin token firmado.
- **Próximo requisito:** autorización de publicación explícita de una ruta limitada de vinculación en el panel existente, separada de activar ventas. Después podrá completarse el enlace mediante inicio de sesión Google normal de la propietaria y confirmarse con SELECT de tabla Romo. No desplegar modificaciones de Uki, ni habilitar cobros.
