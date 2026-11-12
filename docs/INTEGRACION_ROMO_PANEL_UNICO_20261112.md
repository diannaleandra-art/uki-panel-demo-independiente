# Romo La Serena en el panel único Uki · Preparación 12-11-2026
**SOLO QA, SIN PUBLICAR EN LOS ENLACES OPERATIVOS. No está habilitado para recibir pedidos.**

## Confirmado
- Los dos locales Uki mantienen sus identificadores, Firestore, caja, pedidos, timbres y QR.
- Tercera alternativa: Romo's Sushi La Serena, Balmaceda 1612.
- Se reutiliza el selector y el formulario de ingreso de la versión reciente del mismo panel, SIN segunda aplicación ni cambiar los archivos productivos de Uki.
- En QA, tras comprobar la contraseña existente de Uki localmente, la pantalla de Romo es SOLO INFORMATIVA; no abre la caja de Uki ni guarda pedidos bajo una sucursal desconocida.
- La copia cifrada por Romo se conecta en el futuro a la base exclusiva Neon `romos-sushi-la-serena` / `romos_sushi`, tabla `romo_estado_operativo_v1`.
- Backend `api/romo-estado-operativo-qa.js` y roles están preparados, con firma Google + UID autorizado en `romo_personal_acceso_v1`, origen exacto y bloqueo por bandera. **Sin configuración de Vercel y permiso activo devuelve 503.**
- El endpoint del cliente `firebase/uki-romo-operativo-qa.mjs` está vacío por defecto, sin transmisiones ni escrituras.
- No se ha ejecutado migración, conectado credenciales, inscrito UID/roles, cobrado ventas ni habilitado envío de pedidos.

## Faltan para operar realmente
1. Comprobar y registrar personas autorizadas con la cuenta Google existente sin exponer credenciales ni crear acceso por defecto.
2. Integrar las funciones del panel (pedidos, pagos mixtos, caja, timbres, cierres, historial, inventario) con el backend exclusivo Romo y validación de conflictos entre equipos.
3. Conectar la carta Romo del proyecto independiente a la recepción autenticada de pedidos y al catálogo/inventario de Romo. La carta sigue con pedidos reales bloqueados.
4. Añadir Romo al consolidado del panel de dueños sin sumar dos veces ni mezclar los ingresos.
5. QA con dos dispositivos, edición, entrega, cierre, prueba de timbres, inventario y acceso denegado cruzado.
6. Autorización expresa antes de activar endpoints, modificar producción, registrar datos reales o publicar.

**Riesgo controlado:** una rama QA puede generar una Preview automática en Vercel. NO significa que el panel de uso diario haya sido reemplazado.
