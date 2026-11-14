# Romo La Serena · API privada preparada dentro del panel único Uki

**14 de noviembre de 2026 · SOLO rama de preparación · NINGÚN acceso operativo habilitado.**

## Motivo y arquitectura

El panel real que usa Uki está en el repositorio \`uki-panel-demo-independiente\`, proyecto Vercel \`uki-sushi-inventario\`. Antes se habían preparado las APIs de Romo únicamente en un repositorio separado, lo que impedía usarlas desde el mismo panel. Ahora el código de preparación reside en el mismo repositorio, **sin mover ni tocar datos de Uki**.

- Interfaz única: \`firebase/uki-sushi-local.html\` con tres sucursales: Uki Regimiento Arica, Uki La Serena y Romo’s Sushi La Serena, Balmaceda 1612.
- Identificador aislado: \`romo:serena\`. Base Romo: proyecto existente \`romos-sushi-la-serena\`, BD \`romos_sushi\`. No crear otra base.
- Cifrado: reutilizar el esquema de Uki \`uki-v813-browser\` (AES-GCM/PBKDF2 en el navegador), nunca guardar la contraseña o registros en texto claro en el servidor.
- Cuenta Google: misma sesión Firebase Auth de Uki, JWT RS256 y rol real en \`public.romo_personal_acceso_v1\` de Neon Romo. No tomar rol, sucursal o UID de parámetros del cliente.
- Seguridad: un JSON cifrado completo exclusivo de Romo en \`public.romo_estado_operativo_v1\`, revisión CAS para dos teléfonos. Sin Firestore ni almacenamiento de Uki.

## Rutas preparadas (todas apagadas)

Las APIs están en \`api/\` del mismo proyecto Vercel que el panel, y los controladores SQL/auth en \`lib/\`. Todas requieren \`VERCEL_ENV=preview\`, \`VERCEL_GIT_COMMIT_REF=preparacion/uki-romo-sobre-main-20261114\`, origen exacto autorizado, base **Romo** con host controlado y las banderas que corresponden. Las credenciales no están en este repositorio.

| Ruta | Función | Bandera(s) obligatorias |
|---|---|---|
| \`GET /api/romo-claves-lectura-qa\` | Devuelve 1 o 2 verificadores AES-GCM de claves Uki, nunca contraseña | \`ROMO_ACCESO_CLAVES_QA_ENABLED\` |
| \`POST /api/romo-clave-alta-duenos-qa\` | Inscribe una prueba cifrada tras validar Google/rol dueños en servidor; no reemplaza una existente | \`ROMO_CLAVE_ALTA_QA_ENABLED\`, \`ROMO_CLAVE_ALTA_ESCRITURA_QA_ENABLED\` y BD privilegiada distinta |
| \`GET /api/romo-catalogo-lectura-qa\` | Lee el catálogo existente sin cambiarlo (incluye \`categories\` y \`categoriaSlug\`) | \`ROMO_CATALOGO_LECTURA_QA_ENABLED\` |
| \`GET /api/romo-estado-cifrado-panel-qa\` | Lee sobre cifrado exclusivo Romo (o estado inicial 0) | \`ROMO_ESTADO_CIFRADO_QA_ENABLED\` |
| \`POST /api/romo-estado-cifrado-panel-qa\` | Guarda sobre cifrado con revisión y sin sobrescrituras entre teléfonos | Además \`ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED\` |

Todos los endpoints están apagados mientras sus banderas están ausentes. **NO habilitar todos de una vez sin revisión manual y permisos comprobados**.

## Configuración requerida antes de una futura prueba manual

- \`ROMO_PANEL_ALLOWED_ORIGIN\`: origen exacto de la página preview que ejecutará el mismo panel. No usar \`*\` ni aceptar orígenes dinámicos.
- \`ROMO_PRIVATE_DATABASE_HOST\` y \`ROMO_PRIVATE_DATABASE_URL\`: sólo credenciales de la BD Romo existente \`romos_sushi\`, con rol mínimo \`romos_app_service\`, separadas de las credenciales Uki.
- La cuenta de servicio existente tiene SELECT para pruebas de clave y catálogo; SELECT/INSERT/UPDATE para estado cifrado. No posee permiso de escritura sobre las pruebas de clave.
- \`ROMO_CLAVE_ALTA_PRIVILEGED_DATABASE_URL\`: credencial separada, con INSERT restringido para un alta inicial aprobada por dueños. **Aún no crear ni introducir la credencial aquí**.
- Módulos cliente: \`ROMO_OPERATIVO_ENDPOINT_QA\`, \`ROMO_PROOFS_ENDPOINT\`, \`ROMO_CLAVE_ALTA_ENDPOINT_QA\`, \`ROMO_CATALOGO_ENDPOINT_QA\` están **vacíos**. Antes de abrir operaciones, la interfaz debe exigir prueba remota de clave habitual Uki registrada por dueños, además de JWT y rol.
- **NO activar operaciones** hasta separar y revisar manualmente los módulos de carta, inventario, pedidos, mesas, caja, cierres, timbres y delivery. Que exista el estado cifrado NO prueba paridad operativa completa.

## Estado de seguridad y pruebas

- Producción Uki \`main\`: sin cambios.
- La carta pública de Romo: sin cambios.
- Neon Romo y Uki: sin escrituras SQL ni permisos cambiados.
- La versión de trabajo puede generar una **preview automática** de Vercel, pero no cambia el dominio de producción.
- **Las pruebas de acceso, pedidos, caja, inventario, cambios de teléfono y cierres se harán manualmente**, tal como acordó la propietaria. No se ejecutan tests automatizados.
- Nunca solicitar por chat ni incluir en código contraseñas, PIN, tokens Google o URLs de conexión a bases de datos.
