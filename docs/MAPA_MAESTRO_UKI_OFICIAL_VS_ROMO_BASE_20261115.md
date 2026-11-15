# Mapa maestro — Uki oficial v8.16 vs. Romo La Serena
**Fecha de corte:** 15 de noviembre de 2026.  
**Objetivo:** congelar una referencia reutilizable antes de más integraciones, sin rehacer ni perder lo aprobado.
**Aclaración:** «Uki» es la versión oficial terminada (a veces pronunciada «Wookie»).

## A. Puntos de referencia verificados
| Componente | Versión / fuente | Estado |
|---|---|---|
| Panel oficial Uki (Regimiento Arica + La Serena) | GitHub `main`, commit producción `6939115f251a4b71ced2a69de9aba884508bc9a5`, `firebase/uki-sushi-local.html` y 13 módulos | Producción Vercel READY; no modificar |
| Panel Romo La Serena | Commit `2822bc2ce9c88b619df4253d6d07a5a2626b8f69`, `public/romo-panel-qa/index.html` | Preview Vercel READY, **no habilitado comercialmente** |
| Rama donde se continúa desarrollando | `preparacion/uki-romo-sobre-main-20261114` | Copia de trabajo, mantener hasta una publicación segura |
| **Respaldo de corte** | `respaldo/romo-v816-base-20261115` | Conserva el código del commit Romo indicado; no es producción |
| URL válida de prueba | `https://uki-sushi-inventario-git-preparacion-c0b0e9-diannaleandra-7046.vercel.app/romo-panel-qa/index.html` | Solo personal autorizado; origen fijado para Preview |
| Carta pública Romo | Repositorio aparte `diannaleandra-art/romos-sushi-qa.`, `public/index.html` | Es un despliegue diferente; **no se actualiza automáticamente al publicar el panel** |

Se verificó con comparación GitHub: en el momento del corte, la rama Romo contiene 108 commits por delante de `main`, 157 archivos añadidos o modificados. Estos cambios no indican funciones terminadas. El código base de Uki se mantiene con su publicación anterior.

## B. Leyenda del mapa
- **✅ Visible/comprobado:** se observó en capturas reales o se comprobó el acceso; NO significa que todos sus botones se hayan operado.
- **🟠 Integrado en Preview, pendiente prueba manual:** código, pantallas o conexión preparada y compilada; sin operación comercial de extremo a extremo.
- **🔴 Pendiente de paridad o conexión:** falta implementar o verificar una dependencia indispensable.
- Ninguna operación comercial debe declararse homologada sin validación manual de guardado, recarga, caja, historial y permisos.

## C. Mapa de paridad por funciones

| Área de Uki oficial | Lo que ya existe en Romo (corte) | Estado | Qué falta para considerarlo igual a Uki |
|---|---|---|---|
| Acceso y tres sucursales | Selector con Romo, Google, clave habitual, lectura Neon `romo:serena`, revisión cifrada; acceso probado en iPhone | ✅ acceso / 🟠 integración | Unificar navegación y permisos del panel público, garantizar roles independientes en producción |
| Pedidos: entrada manual | Formulario original reutilizado, folio de turno, guardado pendiente cifrado CAS | 🟠 | Prueba real de registro, recarga, búsqueda y cierre |
| Pedidos: WhatsApp | «Pegar WhatsApp» disponible; lectura de mensaje Romo con barrera ante mensajes Uki | 🟠 | Comprobar distintos formatos y artículos/ingredientes antes de uso real |
| Pedidos en espera | Guardar, reabrir y eliminar borradores de Romo sin ventas; estado cifrado | 🟠 | Validación manual de borrador entre dispositivos y convertirlo en pedido una sola vez |
| Bandeja carta y solicitudes | Consulta, aceptar/rechazar mediante APIs Romo preparadas; separación Neon | 🟠/🔴 | Conectar **la carta pública efectiva** y confirmar desde el mismo formulario; validar origen, flags y no duplicar |
| Pedidos: filtros e historial | Operación, Historial, Todos, búsquedas cliente/WhatsApp/código/folio, fecha y turno, filtros por estado, fichas plegables | ✅ interfaz / 🟠 datos | Comprobar filtros y persistencia con pedidos reales de varios días/turnos |
| Pedidos: edición | Edición auditada de productos, cantidades, precios, ingredientes y delivery en pedido pendiente no pagado | 🟠 | Rectificaciones de pagados, cambios de medios de pago, post-cierre con dueños |
| Pedidos: cancelar/entregar | Motivo, quién cancela, responsable de entrega y fecha, historial; guardado CAS | 🟠 | Conciliación y devolución de pedidos pagados; reglas completas de excepción |
| Errores/incidencias de pedidos | Formulario para registrar problema, solución y responsable; consulta por pedido | 🟠 | Comprobar persistencia manual, filtros y visibilidad equivalente al historial Uki |
| Pedidos de mesa manuales | Modalidad Consumo en local, agrupación por mesa, edición de mesa pendiente con historial | 🟠 | Prueba manual; cuentas/rondas QR y cuenta única de mesa todavía no operan |
| QR de mesas | Código QR original Uki conservado pero **NO conectado a Romo**, deliberadamente | 🔴 | Servicio QR y dispositivo autorizados de Romo; rondas, cuenta compartida, cancelación, cobros y cierre |
| Cobro de pedido | Confirmación de dinero recibido, responsable, dos medios por productos y dos por delivery, validaciones de suma, timbre ganado en misma revisión | 🟠 | Comprobar efectivo/transferencia/débito/Edenred/mixtos; propinas y pagos entre locales |
| Timbres/Clientes | Fichas, búsqueda, calendario, historial, códigos, envío de timbre por WhatsApp desde pedido y Clientes, confirmación manual CAS | ✅ interfaz / 🟠 operativa | Homologar todos los casos de cambios de número/identidad, canjes y reportes |
| Canjes | Reglas de 6 y 10 timbres; pedido de premio a $0 y registro en una revisión | 🟠 | Validación manual con tarjeta real elegible y confirmación de reinicio |
| Caja · 7 secciones | Resumen, Movimientos, Precierre trabajador, Cierre definitivo, Historial, Reportes y Acumulada visibles | ✅ interfaz / 🟠 operativa | Completar todos los cálculos, permisos y cierres con datos reales |
| Caja · 7 movimientos | Gastos, Apps, Delivery manual, Pago repartidor, Propinas, Retiros, Caja chica visibles con formularios aislados | ✅ interfaz / 🟠 operativa | Confirmar efecto por medio de pago, saldo, deuda por repartidor y ausencia de duplicaciones |
| Base y apertura de turno | Advertencia de base sin confirmar, definición explícita real y bloqueo preventivo | 🟠 | Confirmar base real y validar caja antes del primer cobro |
| Precierre del trabajador | Foto de corte, conteo y diferencias; CAS Romo preparado | 🟠 | Acceso **independiente del trabajador**, sin sesión Google del dueño; validación de doble turno |
| Cierre definitivo | Procedimiento, validaciones de bandeja y constancia Neon, filtros de cierre | 🟠 | Cierre real con arqueo, hora, compartir, reapertura autorizada y conciliación |
| Historial de cierres y reportes | Consulta de cierres confirmados, mismo informe oficial día/semana/mes, CSV y vista imprimible PDF, compartir WhatsApp | 🟠 | Descarga y lectura reales en iPhone, rectificación post-cierre; Excel XLSX nativo no garantizado (actualmente CSV) |
| Caja acumulada | Esquema aislado Neon y API de consulta instalados; sin saldos inventados | 🟠/🔴 | Base física inicial, ledger real, acreditación única de cierre, permisos de escritura y conciliación |
| Inventario administración | API y tablas Romo propias, CRUD, cantidades, mínimos y disponibilidad, historial y exportación preparados | 🟠 | Validación manual completa en panel (agregar, editar, eliminar, reportar), semántica «lo hay/llegó/falta» |
| Inventario trabajador | Página propia, PIN de 6 dígitos, lectura/actualización y exportación preparadas | 🟠 | Prueba en iPhone con personal autorizado, permisos por sucursal y sincronización |
| Carta: catálogo público | Carta negra/roja y delivery aprobado en revisión visual; consulta productos de Supabase `romos_products` | ✅ aspecto parcial / 🟠 recorrido | Confirmar que solicitud real llega a Romo y conserva armado, dirección, tarifa |
| Carta desde panel | Banner/Promos independientes de Neon Romo, editor Uki copiado pero bloqueado sobre Romo | 🟠 banner / 🔴 CRUD | Vincular categorías, productos, descuentos, fotos, ingredientes, envolturas, extras y agotados a Supabase **sin reemplazar datos** |
| Delivery | En carta se preparó cálculo por calles y tarifas de Uki; panel guarda importe en pedido | 🟠 | Confirmar precio y recorrido hasta Caja y «deliverys a pagar» por repartidor, incluidos locales diferentes |
| Mi Administración | Consulta privada de cierres Romo, sin sumar al total Uki | 🟠 lectura | Incorporación contable **una sola vez** por cierre `source_key`, ventas generales, gastos/facturas, proveedores y utilidades |
| Marca y diseño | Nombre Romo y paleta rojo/negro/blanco preparados en panel; carta pública separada | ✅ cabecera / 🟠 total | Última revisión visual iPhone para eliminar restos naranjas y etiquetas Uki |
| Auditoría y desbloqueo | Historial de cambios por pedido; bloqueos seguros de turnos/cobros | 🟠 | Desbloqueo controlado por dueños y rectificaciones después de cierre, con respaldo y sin alterar original |

## D. Riesgos importantes encontrados
1. **La carta pública de Romo usa Supabase `romos_products`, pero el documento de catálogo del panel está en Neon `romo_catalogo_v1`.** La comparación anterior encontró 12 productos en Supabase y 7 en Neon (foto del 15/11, puede variar). Una edición en Neon por sí sola no cambia lo que ve el cliente. No copiar listas ni precios automáticamente.
2. El `public/index.html` de la carta Romo llama a `/api/orders` para registrar solicitudes y usa WhatsApp como salida. **La integración efectiva de ese endpoint con la bandeja Neon de Romo no está acreditada**; no basta publicar el panel.
3. El sistema QR de mesas del panel oficial usa endpoints de Uki: se debe crear conexión de Romo. Una mesa manual en pantalla NO es la cuenta QR de Uki.
4. La base de Caja de Romo mostró advertencia de importe predeterminado Uki: la base física no está confirmada. No considerar el dato un saldo real.
5. La versión pública de Uki se aloja desde `main` del mismo proyecto Vercel: promover **toda** la rama Romo afectaría archivos de Uki y requiere revisión/consolidación. No hacerlo.
6. Sin prueba manual integral no declarar completados cobros, cancelaciones, timbres, cierres, inventario o exportaciones.
7. Una URL **única temporal** de despliegue Vercel no es el origen permitido para la API privada Romo. Se usa la URL fija de la rama autorizada; una nueva publicación comercial necesita configurar su propio origen y roles.

## E. Publicación: plan seguro

### Publicación 1 — congelar base para continuar el desarrollo (hecho)
- Rama de respaldo: `respaldo/romo-v816-base-20261115`, nacida del commit `2822bc2ce9c88b619df4253d6d07a5a2626b8f69`.
- Se conserva la versión Vercel **Preview READY** bajo la dirección de rama autorizada.
- Esta «publicación de prueba interna» es accesible al personal autorizado y contiene las mejoras existentes; **no está habilitada para clientes ni ventas**.
- Trabajos nuevos deben seguir en rama de preparación o futura rama de desarrollo, dejando el respaldo intacto.

### Publicación 2 — uso comercial (NO realizada)
Requiere previamente:
1. Elegir un proyecto/despliegue **Romo propio** o una ruta productiva explícitamente aislada de `main` Uki; configurar dominio/origen Vercel y permisos Google.
2. Verificar variables comerciales de producción, flags por servicio y base Neon Romo con acceso mínimo. No trasladar credenciales de Preview sin revisión.
3. Conectar la carta pública Supabase con recepción segura en Romo y homologar sus productos.
4. Resolver bloqueos críticos de Caja, mesas QR que se usen, trabajadores y Mi Administración o, si no se usan inicialmente, mantenerlos visibles como no disponibles sin permitir estados falsos.
5. Ejecutar **comprobación manual real** en iPhone: pedido → aceptación → preparación → timbre → cobro real y delivery → entrega → cierre físico → historial/exports → Mi Administración; verificar que Uki Regimiento y Uki La Serena no cambiaron.
6. Publicar únicamente después del control de permisos, datos, saldos y autorización final; conservar capacidad de volver al corte de respaldo.

## F. Qué NO se modifica al crear este mapa
No se crean pedidos, cierres, saldos, clientes, registros de inventario ni créditos. No se reinicia la base `romos_sushi`. No se altera `main`, la producción de Uki ni la carta pública de Romo.

## G. Siguiente orden de trabajo desde la base
1. **Carta → bandeja → Pedido → cobro y Caja:** completar fuente única, consistencia de catálogo y entrega.
2. **Caja integral:** apertura, movimientos, precierre trabajador propio, cierres, historial y acumulada.
3. **Correcciones críticas:** edición pagada, cancelaciones con devolución y desbloqueo de dueños; QR de mesas con servicio separado.
4. **Inventario integral:** mismos formularios y trabajadores, exportaciones verificadas.
5. **Mi Administración:** importación de cierre confirmada una sola vez y reportes.
6. **Comprobación manual final y publicación comercial segura**, si cada dependencia está verificada.

**Criterio de éxito:** Mismas funciones aprobadas de Uki, tres sucursales con datos independientes, sin agregar funcionalidades nuevas ni perder aprobaciones previas.
