# Uki Sushi — panel de inventario: preparado para integración, SIN PUBLICAR

Fecha: 2026-11-05. Preparación separada para Regimiento Arica y La Serena.

## Situación y alcance

- Panel real vigente: GitHub Pages, `diannaleandra-art.github.io`.
- Código base del panel real en `main`; esta rama de preparación deriva
  de la versión de inventario QA probada
  (`feature/uki-panel-inventario-carta-qa-20261105`, `52408dd`).
- **No se ha fusionado esta rama con main ni publicado a GitHub Pages.**
- El panel real debe seguir operando con su mismo código compartido,
  nube, pedidos, pagos, cierres, precierres y timbres.
- El nuevo inventario solo incorpora búsqueda de productos/ingredientes,
  disponibilidad manual, conteos, entradas, historial y permisos.
- Los trabajadores no pueden modificar precios ni crear productos;
  el nombre del trabajador identifica cada movimiento.
- Inventario y disponibilidad son independientes: stock 0 NO agota.
- QA usa credenciales propias; jamás utilizar dispositivos QA en producción.

## Requisitos de lanzamiento futuro (no autorizados todavía)

1. Comprobar primero en la **carta pública real** la existencia del
   endpoint `/api/catalogo-live` con las tablas de Neon producción
   instaladas, acceso autorizado y feature flag listo.
2. No publicar el panel hasta que ese endpoint responda correctamente
   para Arica y Serena y pase pruebas de no-regresión.
3. Validar desde iPhone de administración y equipo trabajador autorizado
   el catálogo, sin alterar el PIN compartido.
4. Verificar que no se modificaron las ventas, caja, cierres, QR, WhatsApp
   ni datos previos. Disponibilidad manual por sucursal.
5. Conservar la versión anterior para revertir si es necesario.

**Prohibido fusionar a main o publicar sin nueva autorización.**

## Condición de seguridad añadida: inventario de empleados SIN cierres ni caja

La propietaria confirmó el 2026-11-05 que quienes entren al inventario
NO deben poder consultar los cierres, históricos, ventas totales ni reportes de caja.

**Situación detectada:** el PIN/clave compartidos de la sucursal
abren el panel operativo y su sección Caja. Que la pantalla del inventario
no muestre los cierres NO significa que la persona pierda acceso a Caja.
El snapshot local cifrado se comparte con quienes tienen la clave operativa;
por tanto, ocultar botones por JavaScript NO es una separación segura.

**Condición previa al lanzamiento:**
- Operador de inventario debe tener un punto de acceso limitado a inventario:
  ver existencias, contar, recibir y marcar agotado/disponible;
  no podrá modificar nombres, precios ni agregar productos.
- Administración Google autorizada debe conservar edición de productos,
  precios e historial de inventario, y ser la única capaz de consultar cierres
  y reportes financieros confidenciales.
- El nuevo acceso de inventario no cargará, descifrará ni expondrá registros
  de caja/cierres, y no podrá usar el PIN compartido para saltarse permisos.
- El acceso habitual de empleados al registro de pedidos no se puede
  romper ni hacer perder sincronización; separar caja/cierre requiere
  diseñar autorizaciones y datos por rol, no solo ocultar pestañas.
- No habilitar producción hasta comprobar que un trabajador con sus
  credenciales vigentes no puede obtener los cierres desde ningún acceso.
- Documentar pruebas negativas de autorización, permisos de ambos locales,
  y no-regresión de pedidos, pagos y guardado antes de pedir nueva
  autorización de lanzamiento.

**ESTADO: BLOQUEANTE, NO IMPLEMENTADO.**
La preparación del inventario en GitHub y las tablas vacías en Neon
no equivalen a una separación de cierres ya efectiva.

## Revisión de fin de turno preparada en QA (2026-11-05)

**Acceso de trabajador:** `firebase/uki-inventario-revision.html`.
Es una pantalla independiente, sin interfaz de Caja ni lectura de datos de cierres.
Utiliza la autorización firmada del dispositivo de esa sucursal, no el PIN compartido.

Flujo: seleccionar sucursal, escribir nombre, registrar lo que queda y generar
una lista para llevar calculada con `MAX(mínimo configurado - stock contado,0)`.
El mínimo se introduce solamente desde Administración en el panel de inventario.
La lista se comparte manualmente por WhatsApp; nunca abre un cierre de caja ni
cambia automáticamente `available`. Se necesitan mínimos previamente configurados.

El motor está en `firebase/uki-inventario-reposicion.mjs`.
Las pruebas automáticas de la rama de preparación pasan, incluyendo la exclusión
de importaciones a la nube operativa y de la caja. Neon QA ya tiene la columna
`min_stock_qty`; Neon producción aún NO la tiene. La migración pendiente
para mínimos está en
`migraciones/uki_reposicion_minimos_pendiente_aprobacion.sql`.

**IMPORTANTE — Seguridad del PIN existente:** compartir el enlace exclusivo de
inventario no revoca el PIN/clave de acceso a la aplicación operativa. Si un
trabajador todavía conoce la clave compartida del panel completo, puede
acceder a las pantallas de caja actuales. Esto sigue como condición
bloqueante de privacidad de cierres; NO afirmar que el rol queda aislado
completamente antes de resolver la gestión y almacenamiento por perfiles.

**Despliegue:** no publicado, producción inalterada. La plataforma negó permiso
para crear automáticamente el Preview de carta actualizado, HTTP 403.
No apuntar el panel a esa versión hasta completar su Preview QA.
