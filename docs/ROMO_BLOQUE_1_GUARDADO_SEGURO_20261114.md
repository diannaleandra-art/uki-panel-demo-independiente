# Bloque 1 · Guardado seguro de Romo La Serena — preparación
Rama de trabajo: `preparacion/uki-romo-sobre-main-20261114`. Estado: código preparado, no publicado ni probado manualmente.

## Objetivo
Reutilizar el mismo panel de Uki con tercera sucursal Romo (`romo:serena`), manteniendo los datos y permisos de cada local independientes. Ningún guardado comercial debe señalar éxito sin revisión cifrada confirmada por Neon.

## Cambios agrupados
1. Se eliminó el retorno de éxito ficticio del autoguardado general Romo y el código inalcanzable que le seguía. Navegar y renderizar nunca son una operación comercial guardada.
2. El cierre de sesión de Romo deja de depender del autoguardado Uki, mantiene la confirmación para descartar borrador y respeta el bloqueo de guardado CAS en curso.
3. Ambos adaptadores de sesión Romo tratan los errores de escritura o respuesta CAS inesperada como resultado incierto: bloquean la misma sesión y exigen reabrir y conciliar.
4. Solo el adaptador que dispone de aceptación atómica (`public/romo-panel-qa/romo-panel-unico-sesion-qa.mjs`) reserva la revisión durante la preparación de una aceptación de carta o cierre, hasta su confirmación; impide que otra escritura compita sobre el mismo estado.

## Todavía pendiente
- Unificar los flujos oficiales de nuevo pedido, edición, estados, timbres, clientes y caja con operaciones autorizadas de Romo.
- Revisar todas las llamadas heredadas a autoguardado: no habilitar controles que dependan de ellas hasta usar el CAS Neon Romo y mostrar resultado confirmado.
- Verificar en iPhone y manualmente cada modalidad; conciliar una misma revisión en dos dispositivos, sin crear pedidos automáticos de prueba.
- Publicar en un único lote autorizado después de completar la paridad funcional. El diseño aprobado, catálogo, delivery y operaciones de Uki no se modifican.

No se ejecutaron pruebas funcionales automáticas, no se desplegó a producción y no se crearon registros comerciales.
