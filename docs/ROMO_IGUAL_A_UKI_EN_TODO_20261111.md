# Decisión definitiva: Romo entra y trabaja exactamente igual que Uki
**Fecha:** 11 de noviembre de 2026
**Estado real:** ingreso visual unificado en QA; funcionamiento operativo de Romo **pendiente**.
**No publicado en producción.**

## Lo solicitado
Romo’s Sushi La Serena (Balmaceda 1612) será la **tercera sucursal**
dentro del mismo panel actual:

1. Uki Regimiento Arica.
2. Uki La Serena.
3. Romo’s Sushi La Serena.

**No se creará otro panel, otro menú, otra aplicación, otro inicio de sesión,
otro PIN ni otro proceso de trabajo.** La dueña usa la misma cuenta Google de
administración y una de las contraseñas que ya utiliza en Uki.
Los trabajadores usarán los mismos procedimientos operativos y permisos
correspondientes a su rol, sin privilegios adicionales.

## Misma experiencia para todos
- Una sola pantalla para seleccionar una de las tres sucursales.
- Una sola función `pedirPin(s)` para seleccionar.
- Un solo formulario `vInicio()` para introducir contraseña.
- Un solo botón `entrarSuc()` para abrir.
- Al ingresar no se vuelve a elegir local en pedidos, inventario ni caja.
- Misma navegación, colores de acciones, búsqueda, edición y confirmaciones.
- Mismas reglas de pedido, WhatsApp, mesas, caja, inventario, timbres,
  cierre e historial. Los ajustes futuros del panel deberán contemplar
  las tres sucursales sin duplicar implementaciones.

## Mismas funciones operativas que se deben verificar ANTES de habilitar Romo
| Área | Paridad requerida | Situación Romo |
| --- | --- | --- |
| Acceso y selector | Cuenta Google actual, contraseña actual, mismo formulario | Formulario unificado en QA; acceso multidispositivo remoto pendiente |
| Pedidos | Recibir, aceptar, rechazar con motivo, manual, QR y WhatsApp, no duplicar | Pendiente de persistencia y pruebas |
| Ediciones | Caja abierta, nombre obligatorio solo al editar, historial antes/después | Pendiente |
| Timbres WhatsApp | Envío obligatorio para cerrar cuando corresponda; nunca exigir duplicado | Pendiente |
| Caja y pagos | Efectivo, tarjeta, transferencia, beneficios, mixtos, propinas | Pendiente |
| Delivery | Medios mixtos, repartidores, pagos pendientes y entre locales | Pendiente |
| Inventario | Acceso trabajador/admin y artículos por local, disponible/agotado | Pendiente |
| Carta y precios | Editar, agregar, quitar, restaurar; carta pública sincronizada | Pendiente |
| Promociones | Personalización de piezas y salsas, crear y eliminar en cualquier momento | Pendiente |
| Mesas y clientes | Mesas, timbres, búsqueda, historial de clientes | Pendiente |
| Cierres e historial | Precierre, cierre, modificaciones auditables, consultas por fecha | Pendiente |
| Dueños | Ventas automáticas de cierres finales, ventas manuales, gastos y facturas | Pendiente |
| Exportaciones | Excel, PDF y compartir por WhatsApp (dejar para etapa final) | Pendiente |

La **lógica y las pantallas son las mismas**. Cambia únicamente la tienda
seleccionada y los datos que se muestran y guardan.

## Diferencias necesarias por local (NO son pasos adicionales)
- Romo usa nombre, logo, estilo de su marca y carta comercial propia.
- Para Romo: **sin pizzas** en su carta y precios/promos propios; conservar
  el aumento acordado de $500 en las piezas respecto de la carta Uki.
- Pedidos, timbres, inventario, caja, cierres y clientes **se guardan por local**.
- Las dos sucursales Uki mantienen sus claves locales originales:
  `uki_operativo_v1_cifrado_regimiento` y
  `uki_operativo_v1_cifrado_la-serena`.
- Romo debe usar `romo:serena` y su propia base Neon, nunca
  `uki_operacion_v1` ni el namespace cifrado de Uki.

## Corregido ahora en QA
En `firebase/uki-sushi-local.html` se quitó el acceso especial de Romo.
La selección de Romo se hace igual que Uki: `pedirPin` → formulario único
→ `entrarSuc`. Se comprueba la misma clave Uki si ya existe una
bóveda cifrada de Uki en ese equipo; **no se crea clave Romo**.
El acceso de prueba llega a una vista BLOQUEADA, sin pedidos/caja reales,
porque aún no hay sincronización operativa independiente.

La ruta separada `api/romo-duenos-google-check.js` preparada previamente
NO forma parte del nuevo flujo de entrada; su flag
`ROMO_DUENOS_VINCULO_ENABLED` fue desactivado en Vercel para evitar
una experiencia de login adicional. La cuenta Google será la misma
del panel; cualquier control extra de permisos será interno.

## Antes de habilitar Romo de verdad
1. Implementar en el mismo panel un adaptador de persistencia Romo
   que respete **todas** las operaciones y la sincronización de los turnos
   desde distintos teléfonos. No leer/escribir los almacenes Uki.
2. Conectar el catálogo y carta Romo independientes de Uki.
3. Verificar exhaustivamente la paridad de cada área anterior con
   pruebas de caja, edición y cierre en una copia aislada.
4. Autorizar explícitamente la publicación y comprobar inicio completo
   en iPhone antes de usarlo con pedidos reales.

**No confundir una prueba visual de ingreso con un panel Romo operativo.**
Prohibido activar ventas Romo mientras no exista persistencia confiable.
El panel actual de Uki no fue modificado.
