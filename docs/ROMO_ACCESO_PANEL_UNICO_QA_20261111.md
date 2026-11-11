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
