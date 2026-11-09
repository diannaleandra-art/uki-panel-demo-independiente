# Uki Sushi · Lote pendiente de carta: ingredientes + promociones por sucursal

Estado: **preparación de pruebas**. Ninguna integración a `main`, despliegue de Vercel, migración Neon o publicación de la carta pública está autorizada por este documento.

## Alcance preciso

- Reaprovechar `firebase/uki-armado-ingredientes-admin.js` para Agregar ingrediente al armado: vegetal, proteína, envoltura, incluido / recargo y sucursal independiente.
- Reaprovechar `firebase/uki-carta-precios-admin.js` para promociones con rolls, piezas por roll, salsas, korokes, precio, medios de pago y foto de iPhone.
- Crear/editar/retirar/restaurar promoción sin borrar pedidos históricos; las promociones nuevas nacen como **borrador no visible**, y solamente pueden publicarse con foto.
- En la carta: integraciones YA PREPARADAS en `diannaleandra-art/uki-sushi-respaldo`, PR #33 (ingredientes), #34 (lote carta) y #35 (promociones dinámicas), todos **borrador de QA**; no mezclar con el `main` desactualizado de carta.

## Reutilización segura del panel actual

Esta rama nace del `main` que ya contiene las correcciones de pedidos, timbres, cancelaciones, cierres, sincronización y cartas aceptadas/canceladas (PR #45). **No reemplazar** `firebase/uki-sushi-local.html` ni incorporar la rama antigua del PR #35 completa.

Se recuperan únicamente archivos de catálogo, fotos, precios e ingredientes, más la migración SQL aditiva, desde `feature/uki-carta-ordenada-y-reconciliacion-20261108`.

**Cortacircuito:** la API y la pantalla de promociones usan `UKI_PROMOS_VISIBILIDAD_ENABLED`, que NO se configura ni se activa en esta preparación. Con bandera desactivada, el servidor no consulta las tablas de promociones todavía ausentes de producción, no admite su creación, mantiene el listado de carta anterior y conserva el retiro/restauración existente. La parte nueva del formulario permanece oculta mientras la API no declare habilitación.

## Situación observada antes de cualquier escritura

- Neon producción, proyecto `tiny-grass-92161762`, rama `br-quiet-tree-b5m84jln`: la tabla `uki_armado_ingredientes_v1` existe y contiene un ingrediente creado en Arica, **Frutilla**, vegetal, disponible, `$0` de recargo. **No se modificó.**
- Neon producción: `uki_carta_promos_custom_v1` y `uki_carta_visibilidad_v1` **no existen**. El SQL para crearlas está incluido como archivo, **no ejecutado**.
- Vercel: la conexión disponible devolvió 403/404 al inspeccionar proyectos/despliegues; **no es válido afirmar READY ni crear un despliegue de producción sin acceso verificable**.
- La carta pública y QR de clientes siguen con su versión existente.

## Secuencia restante, coordinada y reversible

1. Ejecutar pruebas automáticas de esta rama y de las ramas específicas de carta; en un entorno QA aislado verificar fotos, precios de ambos locales, un vegetal incluido y otro con recargo y que los QR/WhatsApp conservan los totales.
2. Conseguir autorización efectiva de Vercel para el proyecto de carta y backend. No crear servicios pagados.
3. Con autorización **expresa de cambios de producción**, revisar/aplicar **únicamente** migración SQL aditiva (sin tocar pedidos, cierres, timbres ni stock), y verificar desde base que no hay filas de promociones iniciales.
4. Desplegar backend compatible primero con bandera **apagada**; comprobar que el catálogo anterior y fotos sigan funcionando.
5. Coordinar la versión probada de carta desde el commit operativo, sin mover los códigos QR; habilitar nuevos datos y comprobar carrito, recargos, medios de pago y WhatsApp.
6. Habilitar la API de promociones y terminar activación del panel desde el mismo portal; probar Arica y Serena desde iPhone (y deshabilitar bandera ante incidente).
7. Registrar versiones de retorno y confirmar que nunca se crea un pedido duplicado ni se mueve caja.

No tocar los otros PR de QA (dos agendadores, centro de dueños, inventario separado), ni inventar nuevas promociones. Los ingredientes y promociones deben gestionarse desde la sección existente **Carta y precios**, no desde una pantalla nueva.
