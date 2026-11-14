# Romo La Serena — conexión segura solo lectura (14-11-2026)

## Alcance aprobado
Continuación del panel único Uki + Romo, **solo en la rama** `preparacion/uki-romo-sobre-main-20261114`. La contraseña habitual de Uki La Serena ya está vinculada cifrada en `romo_clave_compartida_v1` (1 comprobante). No se solicita nuevo respaldo.

## Este bloque
- El mismo selector de sucursal Romo ofrece **«Comprobar conexión de Romo (solo lectura)»**, usando el campo de contraseña ya existente; sin otra clave ni segundo panel.
- El navegador verifica primero la misma clave registrada mediante el GET de verificador cifrado, sin enviarla al servidor.
- Un endpoint nuevo `GET /api/romo-conexion-lectura-qa` exige Firebase Google firmado, rol real de **dueños** en Neon Romo, origen exacto y `ROMO_CONEXION_LECTURA_QA_ENABLED=true` exclusivo de preview y rama.
- La API consulta solo `revision` de `public.romo_estado_operativo_v1` con la cuenta Romo limitada. No devuelve estado cifrado, contraseñas, clientes, pedidos ni tablas de Uki.
- Método POST/PUT/DELETE rechazado. El flujo no ejecuta `entrarSuc`, `guardarEnLocalStorage`, ningún `save` ni inicialización de caja.
- `ROMO_OPERATIVO_ENDPOINT_QA` y `ROMO_ESTADO_CIFRADO_ESCRITURA_QA_ENABLED` siguen desactivados. No hay ventas, caja, turnos, cierres ni inventario Romo operativos.
- `main` Uki y carta pública Romo se dejan intactos.

## Verificación pendiente MANUAL desde iPhone
1. Abrir el enlace de preview, confirmar **Google conectado**.
2. Seleccionar Romo La Serena, introducir la misma contraseña habitual de Uki y tocar **«Comprobar conexión de Romo (solo lectura)»**.
3. Confirmar mensaje de acceso o capturar el error. No tocar «Abrir sucursal», «Cargar nube» ni registrar pedidos.
4. Solo después de aprobación independiente continuar la integración real de guardado, caja y módulos de Romo. Prohibidas pruebas automáticas en este flujo.

## Controles
Antes de habilitar la flag de preview, confirmar que `romos_app_service` solo accede a la base `romos_sushi` y tiene SELECT de roles y estado, y que `romo_estado_operativo_v1` no contiene operaciones. La flag nunca debe aplicarse a producción ni a otras ramas.
