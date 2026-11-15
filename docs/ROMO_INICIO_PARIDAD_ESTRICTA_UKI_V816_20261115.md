# Romo La Serena — inicio de réplica estricta del panel Uki v8.16
Fecha: 15-11-2026. Rama exclusiva de preparación: `preparacion/uki-romo-sobre-main-20261114`.

## Fuente oficial innegociable
- Panel de referencia aprobado y publicado: `firebase/uki-sushi-local.html` de `main`, blob `578a595f5fe1bc72a753ddc2520f0246ec297315`, despliegue producción commit `6939115f251a4b71ced2a69de9aba884508bc9a5`.
- 13 módulos oficiales `firebase/uki-*.js`, incluido catálogo/ingredientes/disponibilidad, inventario, caja, timbres, reportes y cierres.
- Panel Romo: `public/romo-panel-qa/index.html` de esta rama, desplegado inicialmente en Preview con commit `bc9007296f1329eb2d21094691a9192ee41e9547`.
- Reglas: un solo panel y tres sucursales; Uki Regimiento y Uki Serena intactos. Romo tiene datos, precios, carta, caja, inventario y permisos propios `romo:serena`; no copiar datos ni credenciales de Uki.
- Diseño de Romo aprobado: negro, rojo, blanco; sin naranjas ni textos de marca Uki. No modificar la carta pública ni precios durante esta etapa.
- No realizar pruebas comerciales automáticas ni pedidos, cobros, movimientos o cierres ficticios. Validación manual por la dueña con operaciones reales, después de que la integración esté lista.

## Diferencias confirmadas en código (no basta que aparezca el botón)
| Área | Oficial Uki | Romo actual | Criterio de cierre |
| --- | --- | --- | --- |
| Pedidos | `vPedidos` completo: estados, filtros, incidencias, historial, mesas | `vPedidos` deriva a `ukiRomoPedidosPendientesHTMLQA` | Misma pantalla/procedimiento y transiciones con guardado Romo seguro |
| Nuevo | `cambiarModoNuevo`, `ndGuardar` con flujos aprobados | Solo ingreso manual en `cambiarModoNuevo`; `ndGuardar` sustituye el guardado | Reponer opciones originales sin ventas engañosas ni escrituras a Uki |
| Clientes y timbres | `vClientes` completo, ficha, búsqueda, canje, WhatsApp | `vClientes` deriva a `ukiRomoTimbresPanelQA` | Misma ficha y registro único de timbres/canjes en Neon Romo |
| Caja | `vCaja` enlaza `vCajaResumen`, `vMovimientos`, `vPrecierreTrabajadores`, `vCierre`, `vHistorialCompacto`, `vReportes`, Acumulada | `vCaja` deriva a `ukiRomoCajaPestanasQA` con pantallas propias | Misma estructura y operaciones; cada guardado confirmado en Romo |
| Movimientos | `MOV_TABS`: Gastos, Apps, Delivery manual, Pago repartidor, Propinas, Retiros, Caja chica | La pantalla especial de Romo solo expone parte de formularios | Los siete tipos oficiales, mismos cálculos y auditoría |
| Precierre y cierre | Inicio/turno del trabajador, arqueo, constancia, rectificación | Precierre Romo depende del acceso dueños; historial con rectificaciones limitadas | Permisos propios del trabajador; cierre único, rectificación auditable, archivos y WhatsApp |
| Caja acumulada | Pantalla oficial con saldos y movimientos | Solo conciliación/consulta parcial Romo, esquema Neon independiente | Saldo físico inicial real, acreditación única de cierres, ingresos y salidas auditadas |
| Inventario | CRUD, conteos y reportes por local, PIN trabajador | Adaptador independiente pendiente de paridad manual integral | Mismas pantallas y operaciones con datos Romo independientes |
| Carta desde panel | CRUD categorías/productos, descuentos, fotos, ingredientes, agotados | Editor Uki bloquea Romo para evitar cruces; banner Romo no reemplaza CRUD | Edición en fuente usada realmente por carta Romo; no sobrescribir Supabase/Neon |
| Administración | Cierres oficiales, venta/general, gastos/facturas y utilidades | Romo consultable, sin integración contable automática | Una sola atribución por cierre confirmado, jamás duplicación |

## Bloque prioritario 1: lógica común + persistencia segura
1. Identificar las mutaciones oficiales de Pedidos y Caja, distinguiendo renders/consultas de cambios reales. Nunca activar la rutina Uki sobre `romo:serena` ni su almacenamiento.
2. Mantener las pantallas y formularios oficiales; conectar *sus mismas acciones* con operaciones Romo respaldadas por Google autorizado, Neon `romos_sushi`, cifrado AES-GCM y control de revisión CAS.
3. Cada acción debe esperar confirmación del servidor antes de actualizar la pantalla o mostrar éxito. Ante respuesta incierta: bloquear reintento y pedir recarga/conciliación. Registrar responsable, fecha, turno y motivo en ediciones/cancelaciones.
4. Mantener separados pagos, propinas, repartidores y timbres; una operación debe contabilizarse una vez. No cobrar pedidos de prueba, no establecer base predeterminada como efectivo real.
5. Solo tras equiparar el recorrido de pedido, cobranza y caja, habilitar las pantallas completas sin atajos especiales de Romo. No desbloquear botones cuyo servidor no guarde efectivamente.

## Bloque 2: paridad de las siete pestañas y de los siete tipos de movimiento
- Resumen: importes y medios, entrega, propinas, auditoría, caja física.
- Movimientos: cada uno de los siete formularios oficiales y su efecto en caja.
- Precierre: mismo flujo de trabajador, fotografía/arqueo y registro, sin cerrar el día.
- Cierre: mismo cuadre y bloqueo por pendientes, hora, recibo y cierre único.
- Historial: búsqueda, edición/rectificación permitida con auditoría, Excel/PDF/WhatsApp.
- Reportes: día, semana, mes, filtros y desglose por medios/propinas.
- Caja acumulada: saldo real inicial y movimientos propios de Romo, sin usar Uki.

## Bloque 3: ficha, inventario y carta
- Misma ficha oficial de clientes, búsqueda por nombre/WhatsApp/código, timbres, canjes y confirmación de envío.
- Inventario y trabajador PIN de 6 dígitos, sin confundir autorización de caja con PIN de inventario.
- CRUD completo del catálogo: categorías, productos, promociones de producto, descuentos, fotos, ingredientes y disponibilidad. Confirmar fuente pública usada por la carta: Supabase `romos_products`; el documento Neon es distinto y NO se debe sobrescribir ni fingir sincronización.
- Mantener cálculo de delivery ya aprobado de Uki y la presentación negra/roja de Romo.

## Bloque 4: Mi Administración + comprobación final
- Incorporar exclusivamente cierres definitivos Romo confirmados, una vez por `source_key`, después de conciliación; ningún precierre ni solicitud cuenta como venta.
- Verificar historial, reportes y facturas/proveedores por sucursal sin confundir cajas.
- Una sola comprobación integral MANUAL en iPhone: abrir Romo → pedido real desde carta/WhatsApp o formulario aprobado → aceptar → timbre → cobro real (incluidos mixtos si corresponde) → entrega → precierre → cierre con arqueo físico → historial/descargas → Mi Administración; revisar además que Uki no cambió.
- Conservar estado actual y evitar reinicializar datos. Publicación de producción solo tras revisar permisos, origen, variables y resultados manuales. No promover toda la rama sin esta aprobación.

## Estado al abrir esta etapa
- **Inspección realizada:** versiones y rutas comparadas en lectura; se confirma desigualdad funcional.
- **Trabajo de implementación:** pendiente; este documento no activa funciones.
- **Datos comerciales:** sin modificaciones en esta etapa.
- **Producción:** no modificada; Preview Romo sigue siendo piloto y no debe usarse con clientes.
