# Enlace previo de Romo: clave de dueños y consultas desde Safari

Actualizado el 14-11-2026 en `preparacion/uki-romo-sobre-main-20261114`. **Solo vista previa de preparación; no habilita ventas.**

Se resolvieron dos impedimentos antes de conectar las credenciales:

1. **Inscripción de la contraseña habitual en el iPhone antes de la primera entrada.**
   El formulario de vínculo de dueño, que antes aparecía únicamente al pasar la pantalla de entrada (imposible cuando aún no hay verificador), se muestra también en la propia pantalla de ingreso de Romo, exclusivamente cuando se habilite la API de alta. Es el mismo formulario; no se crean otros PIN. La contraseña se comprueba localmente con la copia cifrada Uki y al servidor se envía solo el comprobante AES-GCM.
2. **Consultas GET seguras desde la misma página.**
   Safari no siempre envía el encabezado `Origin` en GET del mismo dominio. Las APIs Romo ahora permiten ese caso **solo si el Host coincide exactamente con `ROMO_PANEL_ALLOWED_ORIGIN`**. POST requiere `Origin` explícito y exacto. Todos los métodos siguen exigiendo JWT Google firmado y rol Romo en Neon.

No se reutilizó ni copió ninguna contraseña o URL de conexión de producción. Las variables de configuración/secretos de Vercel para la rama de preparación siguen sin habilitarse; las pruebas de acceso, inventario, caja y pedidos siguen pendientes y son **exclusivamente manuales en iPhone**. La rama `main` de Uki y la carta Romo no se modifican.

Siguiente punto: configurar credenciales de solo lectura y URL de origen para **esta** rama de preview, sin exponer conexiones privilegiadas de producción; después vincular la clave existente mediante la interfaz de dueños, y recién tras verificación manual habilitar otros permisos.
