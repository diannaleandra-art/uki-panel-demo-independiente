# Continuidad simplificada · seguimiento de pedidos Uki y Romo · 24/11/2026

**Objetivo del usuario: terminar UNA función sencilla para tres sucursales, sin rehacer paneles, crear demos adicionales ni imponer pasos al personal.** Sucursales: Uki Regimiento Arica, Uki La Serena, Romo Sushi La Serena.

## Flujo aprobado
1. Cliente registra pedido desde carta; elige método de pago. Ve un mensaje corto: "Sigue tu pedido aquí. Deja esta ventana abierta o guarda el enlace en tu celular".
2. Si eligió transferencia, ve monto exacto y cuenta de su sucursal SOLO cuando estén validados por el servidor. "Ya transferí" es sólo aviso, no prueba de abono.
3. La agendadora verifica en el banco y pulsa UN botón con el monto: "Confirmar: vi $X abonados".
4. SIN ese registro de verificación bancaria, el sistema no puede marcar pagado ni finalizar el pedido. Pagos mixtos: resto conciliado. No modificar caja/timbres/cierres por esta alerta.
5. Chat breve desde enlace, entre cliente y su pedido en panel, sin Meta/WhatsApp automático.
6. Los tres locales reciben mismas funciones y mantienen datos separados.

## Estado real de trabajo
- **PRODUCCIÓN NO CAMBIÓ.** No se han activado estas reglas en los pedidos comerciales. No se han validado cuentas bancarias por sucursal.
- Proyecto de QA: repositorio \`diannaleandra-art/uki-panel-demo-independiente\`, rama \`preparacion/enlaces-seguros-3-sucursales-20261124\`, Vercel \`romos-sushi-panel\` únicamente Preview y protegido.
- Neon QA existente para Uki y Romo: tablas de enlaces, transferencias, chat cifrado, y cierre QA. No hay pagos insertados; no tocar bases reales.
- Se crearon verificadores de pago en servidor (SQL atómico para registro QA) y un bloqueo de siete rutas cifradas legadas de Romo en Preview; éste impide writes de esos endpoints y **no sirve tal cual como solución comercial**, ya que el panel real necesita seguir guardando caja y pedidos.
- Cambio reciente significativo:
  - \`lib/seguimiento-qa-servidor-v1.cjs\`: \`issueForRegistered\` deriva el MISMO token del ID, \`request_key\` fuerte y fecha del registro guardado; reintentar no cambia enlace. \`issueAccepted\` reutiliza ese mismo token después de aceptar, en vez de invalidarlo.
  - \`api/romo-solicitudes-carta-qa.js\`: tras registrar una solicitud Romo en la rama segura, intenta devolver \`seguimientoEnlace\` en respuesta, bajo flags y comprobación de que su conexión coincide con Neon QA. No entra en uso hasta integrar el frontend real.
  - \`public/romo-panel-qa/seguimiento-tres-sucursales-qa.mjs\`: botón de copiar el mismo enlace, sin otro paso.
  - \`tests/seguimiento-registro-pendiente-v1.test.cjs\`: verifica que el enlace sobrevive reintento y aceptación para cada local.
- CI última confirmación exitosa: ejecución GitHub Actions \`45346306676\`; 90 tests seguimiento y 23 regresiones Romo, 113/113 exitosos.

## Pendiente mínimo ANTES de publicar
1. Integrar visibilidad y conservación del enlace dentro de las cartas **reales** de Romo y de ambas sucursales Uki, sin registrar ventas al pulsar WhatsApp. La función de enlace compartido existe en QA, pero la carta pública de Uki en otro repositorio \`uki-sushi-respaldo\` aún NO está conectada al emisor de tokens.
2. Integrar la verificación bancaria en la **operación única real de guardado** por pedido, sin que las rutas antiguas de snapshots cifrados (Romo) o Firestore (Uki) puedan marcar pagado/entregado a espaldas del servidor. Conservar controles de propinas, timbres, caja y cierres. No activar el bloqueo bruto de QA en producción.
3. Confirmar cuentas bancarias auténticas y correctas por sucursal, con documentación empresarial apropiada. No inventar datos.
4. Pruebas manuales con personal autorizado en navegador normal (Firebase Google no acepta actualmente el hostname temporal de Preview), comprobar iPhone, PC, avisos, pago mixto, reintentos y doble guardado. No solicitar pasos de más a la usuaria durante preparación.
5. Únicamente entonces publicar juntas las tres sucursales. No decir que está listo en producción hasta verificarlo.

## Seguridad
- No inferir pago recibido a partir del texto WhatsApp, botón del cliente o de la preferencia declarada. La base Romo guarda snapshot AES-GCM que el servidor no puede inspeccionar sin rediseño de fuente autoritativa.
- Los enlaces caducan; al reintentar en un plazo válido NO deben cambiar. Si ya hay un enlace activo distinto, \`issueForRegistered\` falla sin invalidarlo.
- La bandera Vercel \`SEGUIMIENTO_BLOQUEAR_SNAPSHOT_LEGACY_QA_ENABLED=true\` está limitada a la rama preview exacta. No copiarla a producción.
- No crear otra rama/proyecto/app ni más pantallas demo si no hace falta. Priorizar terminar la función concreta con UX simple.
