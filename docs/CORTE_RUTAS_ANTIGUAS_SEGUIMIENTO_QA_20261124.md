# Corte seguro de rutas antiguas de guardado · Uki / Romo · 24 nov 2026

## Resultado de esta etapa
En la rama \`preparacion/enlaces-seguros-3-sucursales-20261124\` del repo
\`uki-panel-demo-independiente\` se añadió el módulo
\`lib/seguimiento-aislar-escrituras-legadas-qa.cjs\`.

Se instaló un interruptor preventivo exclusivo de **Preview Romo**:
\`SEGUIMIENTO_BLOQUEAR_SNAPSHOT_LEGACY_QA_ENABLED=true\`, limitado
por Vercel a esa rama. La producción **no** tiene el interruptor.
El módulo comprueba además el entorno preview y el nombre exacto de
la rama en el servidor: no acepta un valor enviado por el cliente.

Bloquea las siguientes operaciones que aceptarían un sobre AES-GCM cuyo
contenido no puede verificarse desde Neon:
1. POST \`api/romo-estado-cifrado-panel-qa.js\`
2. PATCH de aceptación con snapshot \`api/romo-solicitudes-carta-qa.js\`
3. POST \`api/romo-cancelacion-cifrada-solo-qa.js\`
4. POST \`api/romo-cierre-definitivo-qa.js\`
5. POST con acción \`confirmar\` en \`api/romo-rectificacion-cierre-v2-qa.js\`
6. POST con acción \`confirmar\` en \`api/romo-pedidos-olvidados-qa.js\`
7. POST \`api/romo-inicializar-vacio-qa.js\`

Las consultas autorizadas siguen disponibles y el endpoint de estado
informa \`escrituraHabilitada=false\` cuando la compuerta está activa.
La compuerta responde 409 y no escribe en caja ni pedidos.

## Muy importante: no publicar así
El corte de QA evita modificaciones del snapshot por las rutas anteriores,
pero también impediría guardar operaciones ordinarias por esas rutas;
por tanto, todavía NO puede habilitarse tal cual en el panel comercial.

La operación nueva \`seguimiento-finalizar-en-servidor-qa\` valida
en UNA sentencia SQL el registro de transferencia confirmada, ID del
pedido, sucursal, monto y estado antes de registrar \`pagado\` o
\`entregado\` en las tablas QA. No modifica el snapshot cifrado ni el
cálculo de caja vigente; NO debe confundirse con migración completa.

**Obligación arquitectónica previa a liberar**:
- Identificar TODOS los caminos que pueden cambiar campos financieros,
  incluido Firestore de Uki, y retirarlos o redirigirlos a operaciones
  de servidor por pedido. No inferir qué cambió dentro de ciphertext.
- El pago y la entrega deben tener una fuente autoritativa única,
  consultable también por el panel; no se puede mantener una segunda
  contabilidad independiente que duplique ventas o timbres.
- Asociar folios/manual/WhatsApp a IDs robustos por sucursal, sin un
  formulario adicional para cliente ni agendadora.
- Preservar cancelaciones, ajustes post-cierre, pagos mixtos, propinas,
  caja acumulada, timbres y delivery a pagar en una sola conciliación.
- Validar datos Santander o cuenta autorizada por sucursal. Sin ellos,
  el cliente no debe ver cuentas no verificadas ni el empleado poder
  confirmar un supuesto abono.
- Hacer QA manual con cliente/agendadora en iPhone y PC, probar
  reconexiones, doble pulsación, otro local, banco no confirmado,
  cobro ya confirmado, diferencia de importe y rechazos.

## Pruebas
\`tests/seguimiento-aislar-snapshots-antiguos-qa.test.cjs\` revisa
bandera preview exclusivamente, siete rutas, permisos de consulta,
respuesta sin mutación y el estado de escritura que ve el panel.
La acción GitHub de la rama suma pruebas de regresión de Romo.

## Publicación
No activar en producción hasta que las operaciones comerciales hagan
las mismas verificaciones de servidor y se compruebe una transición
conservadora con respaldo. Los clientes actuales no se modificaron.
