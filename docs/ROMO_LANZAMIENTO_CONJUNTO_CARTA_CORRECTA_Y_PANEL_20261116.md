# Romo Sushi La Serena — fuente única de trabajo para lanzamiento conjunto
Fecha: 2026-11-16. No publicado.

## Versiones verificadas en código
- Panel oficial Uki y ambas sucursales: repo diannaleandra-art/uki-panel-demo-independiente, main 3274dbc1b66b676663b74d74ae40f84d251b3ee9. NO MODIFICAR.
- Panel Romo (preparación): mismo repo, rama preparacion/uki-romo-sobre-main-20261114, commit base de esta integración ee3f473697b97ebad4b7e57aa09b21408372dc24. El preview que abre la propietaria está en otra revisión ya publicada, f812b1b2998f4e3275b8ef72b596ecda889c82bc. NO promover QA a main.
- Carta Romo APROBADA (réplica Uki): repo diannaleandra-art/romos-sushi-qa., rama preparacion/romo-carta-neon-panel-20261115, commit 90b06b3f0ccaff4cf77d9741044c170e68e99e7f. Archivos correctos: replica-uki/carta/public/index.html y replica-uki/carta/public/candidata/{app.js,model.mjs,catalog.mjs,delivery.mjs}. Root Vercel REQUERIDO replica-uki/carta.
- Rama que se había usado por error publicacion/romo-carta-whatsapp-20261114: se restauró su portada antigua public/index.html y se retiraron sus adiciones accidentales con commit 971b995cde346e2cf4682b89c92c2075ae955d7f. Esa portada NO es la carta aprobada.
- El proyecto Vercel de la carta que está actualmente publicado apunta al directorio raíz del repo y muestra esa portada antigua. Un build READY allí no demuestra que se publicó la réplica Uki. Hay que desplegar el directorio correcto en un proyecto aislado y propio de Romo, sin reemplazar producción Uki.

## Flujo definido para pruebas manuales y lanzamiento
1. Carta aprobada conserva armado, catálogo, precios de Romo, horario, mapa/ruta y carrito. La comanda añade Importe línea por producto; la suma del pedido debe ser consistente con la revisión del panel.
2. Carta → POST solicitudes pendientes romo_solicitudes_carta_v1 de Neon Romo, con folio RS- de UUID e idempotencia; NO generar orden adicional en Supabase romos_orders desde esta misma compra.
3. El receptor responde estado pendiente sin WhatsApp enviado, sin cobro ni venta. El empleado acepta manualmente con bloqueo de duplicados y CAS en Neon. Solo después se procesa pago, timbres y entrega en el panel.
4. Delivery requiere distancia por calles y monto definitivo entre CLP 1 y 4000 y cobertura hasta 8 km; tarifa pendiente no se imputa como 0.
5. Caja exige apertura real, conteo, cierre único y constancia. Mi Administración solo contabiliza cierres definitivos reconciliados una vez por source_key; está aún pendiente.
6. Inventario, personal, clientes, timbres, siete tipos de movimiento y rectificaciones postcierre deben compararse con Uki oficial antes del lanzamiento de clientes.

## Fuente efectiva de productos: NO confundir
- La antigua portada public/index.html del repo carta lee 12 registros de Supabase public.romos_products. NO es el menú completo aprobado.
- La carta aprobada replica-uki/carta/public/candidata/catalog.mjs y model.mjs emplea menú propio de productos, rolls, extras y promociones con lógica más completa. El panel, aparte, tiene Neon romo_catalogo_v1; NO es fuente sincronizada de esa carta.
- No se ha modificado ningún precio ni sincronizado las dos bases. La edición del menú desde el panel requiere conectar el origen efectivo y confirmar igualdad antes de habilitar guardados.

## Criterios para una sola publicación importante
- Proyecto Vercel exclusivo de Romo panel y proyecto exclusivo de carta correcta con Root Directory replica-uki/carta (o arquitectura equivalente aislada), hosts estables y Firebase autorizado, sin cambiar rutas oficiales Uki.
- Configurar banderas, orígenes y secretos del servidor solo cuando se verifique el destino propio; por defecto se mantiene recepción pública cerrada.
- Confirmar manualmente desde iPhone: pedido con 2 productos y armado por roll, delivery real, aceptación, cobro en medio real, timbre WhatsApp, entrega, dos precierres, cierre, exportaciones, consulta en Mi Administración, historial e independencia Uki.
- Propietaria autoriza pruebas reales controladas en Romo (todavía sin público); no se generarán pedidos ficticios ni cobros automáticos, y las operaciones reales quedarán auditadas. No usar pagos de terceros.
- Trabajar por bloques y reunirlos en commits sin despliegues intermedios. Una sola publicación conjunta después de completar y validar los bloques.

Estado: IMPLEMENTACIÓN PARCIAL, NO LISTA PARA VENTAS A CLIENTES.

## Verificación directa de ambos catálogos — 16-11-2026
Consultas de solo lectura a Neon proyecto `romos-sushi-la-serena` (BD `romos_sushi`) y Supabase proyecto `romos-sushi` (tabla `public.romos_products`). Sin modificaciones de datos ni publicaciones.

| Promoción | Carta aprobada, `candidata/model.mjs` y Neon Romo | Supabase antiguo |
| --- | ---: | ---: |
| 24 piezas | $8.000 | $7.500 |
| 36 piezas | $12.000 | $11.500 |
| 48 piezas | $16.000 | $14.500 |
| 60 piezas | $19.000 | $17.500 |
| 72 piezas | $21.000 | $19.500 |
| 84 piezas | $24.000 | $22.500 |
| 96 piezas | $26.000 | $24.500 |

- Neon `romo_catalogo_v1`: revisión 1; 7 productos, 2 categorías, 40 ingredientes y 3 promociones. Es el registro actual del panel, no el catálogo completo.
- Supabase `public.romos_products`: 12 registros, 7 promociones y 5 extras; es el origen de la portada antigua y NO debe copiarse sobre la carta aprobada.
- La carta realmente aprobada usa `replica-uki/carta/public/candidata/model.mjs`, `catalog.mjs` y `monthly.mjs`, además de su estructura de armado. Por ello los siete precios iguales de Neon NO prueban que esté sincronizada la carta completa.
- NO modificar precios ni sobrescribir registros. La futura edición desde el panel debe leer y guardar la fuente efectiva de la carta aprobada, con permiso de la dueña, revisión concurrente, historial y verificación manual del resultado público.
- Mantener el bloqueo existente que impide que `uki-carta-precios-admin.js` guarde desde la sucursal Romo contra la API oficial de Uki. No señalar la edición de Romo como completa hasta que el circuito de escritura esté conectado y validado.
- El enlace de recepción en `candidata/app.js` aún apunta al endpoint de un preview de panel Uki/Romo; reemplazarlo por un destino exclusivo de Romo al preparar la publicación conjunta y mantener la recepción pública desactivada mientras tanto.
- Próximo trabajo de implementación: definir un único catálogo efectivo para carta y panel Romo; mapear todas las categorías, promociones, extras, ingredientes y productos SIN recortar ni recrear el menú; conectar guardado autorizado, comprobar que la carta refleja los cambios, y únicamente entonces completar el lote con caja, cierres y Mi Administración.

**Regla de publicación preservada:** esta actualización es exclusivamente documental en la rama de preparación; no se despliega, no toca `main` ni activa ventas.


## Bloque preparado de contrato completo de carta y comparador privado
Fecha 2026-11-16. **Código en ramas de preparación, no desplegado, no probado con operaciones comerciales**.

### Carta aprobada de Romo (repositorio `romos-sushi-qa.`)
- Nuevo contrato solo lectura `replica-uki/carta/lib/romo-catalogo-aprobado-qa.mjs`: obtiene los productos directamente de los módulos aprobados `model.mjs`, `monthly.mjs` y `catalog.mjs`. No se basa en los 12 registros antiguos de Supabase ni en el documento incompleto de 7 productos Neon.
- Conjunto previsto a partir de los módulos de la carta: 7 promos clásicas, 8 premium, 3 elementos del módulo mensual (incluyendo handroll), 12 platos/gohan/burger, 6 toppings y 4 adicionales de salsa: **40 entradas de venta**. Propuesta de clasificación para la futura interfaz: 9 categorías. Las fotos, conteos de rolls, salsas, beneficios y medios de pago ya definidos en la carta permanecen en su módulo original.
- El contrato también enumera vegetales, proteínas, envolturas y salsas con sus contextos. NO fija un único recargo universal: un ingrediente puede tener precios diferentes en clásico, premium, mensual o burger.
- Endpoint `replica-uki/carta/api/romo-catalogo-aprobado-qa.js` GET únicamente; desactivado por defecto. Requiere Preview de la rama correcta, `ROMO_CATALOGO_APROBADO_QA_ENABLED=true` y el origen específico del panel autorizado. No realiza escrituras ni habilita pedidos.

### Panel Romo (repositorio `uki-panel-demo-independiente`)
- Comparador puro `lib/romo-catalogo-paridad-aprobada-qa.mjs`: reconoce como equivalentes verificables solo las siete promociones clásicas `classic:NN` de la carta frente a `romo:piezas:NN` de Neon. NO empareja por similitud de texto el resto de productos y no decide altas, bajas ni precios.
- Endpoint privado `api/romo-catalogo-paridad-qa.js`: exclusivo de dueños autenticados por Google/roles Neon, consulta ambas fuentes, no guarda. Requiere `ROMO_CATALOGO_PARIDAD_QA_ENABLED=true` en Preview y `ROMO_CARTA_CATALOGO_QA_ORIGIN` del proyecto de carta correcto; por defecto no está habilitado.
- Faltan implementación y validación de las escrituras efectivas en la misma fuente que consume la carta, el historial/auditoría de ediciones, la integración del editor completo y la prueba manual de cambios visibles al cliente. **No anunciar el CRUD ni la sincronización como terminados**.
- Nunca activar los endpoints antes de aislar la carta y el panel en proyectos Romo, confirmar los orígenes, permisos y variables, y planificar la publicación conjunta.
- No se alteraron recetas, armado, ventas, pagos, timbres, registros comerciales, datos Uki, ni se aplicaron migraciones en Neon/Supabase.

### Próxima intervención
Una capa única de edición de Romo que, con autorización de dueños y control de revisión concurrente, permita administrar categorías, productos, promociones, extras y precios a partir de la carta aprobada. Confirmar que una edición queda reflejada tanto en carta como en panel; impedir confirmaciones falsas. Completar junto con los pendientes de caja, trabajadores y Mi Administración antes de la publicación conjunta.
