# Puente de catálogo e inventario Romo — 11 nov 2026 (sólo QA)

Esta rama nace de main actualizado del panel compartido y NO reemplaza la rama anterior ni publica la carta.

## Comprobación read-only de Neon
- Proyecto: romos-sushi-la-serena; base: romos_sushi (independiente de Uki).
- Tablas existentes: romo_catalogo_v1, romo_clave_compartida_v1, romo_estado_operativo_v1, romo_personal_acceso_v1, romo_turnos_v1.
- Conteos verificados 11-11-2026: catálogo=0, personal=0, claves=0, estado operativo=0. NO insertar datos de muestra ni dar permisos automáticos.

## Implementado en esta rama
- Adaptador de catálogo QA: productos/promociones/ingredientes, precios explícitos, disponibilidad, borradores y composición.
- Validación estricta para excluir pizzas y códigos de Uki. El ajuste +$500 de piezas NO se inventa ni se aplica dos veces: se comprobará con la carta Romo aprobada.
- Lectura y operación CAS de catálogo en código. El endpoint API sólo permite GET, requiere token Google firmado, rol activo en base Romo, origen exacto, base independiente y bandera QA explícita; responde 503 por defecto y siempre en producción.
- Modelo de diferencias de inventario (llegó - hay) y reposición por mínimos, sin alterar caja, consumos ni inventario Uki.
- El guardado CAS queda preparado como función NO expuesta; no se escribió en Neon.

## Pendiente antes de activar a clientes
1. Contrastar carta Romo y fotos originales, acordar precios finales/promociones y migrar catálogo privado tras autorización.
2. Integrar el formulario de Carta y precios del MISMO panel para usar scope romo:serena. No duplicar panel ni contraseñas.
3. Preparar persistencia real de inventario y permisos del personal por sucursal, con pruebas desde dos iPhone.
4. Integrar pedidos/caja/cierres/timbres con almacenamiento Romo y autorización dueños, sin tocar las dos sucursales Uki.
5. Pruebas integrales y autorización específica antes de producción.

Esta rama no altera env vars, dominios, datos reales, código de sucursales Uki ni producción.

## Proyección de Romo en las mismas vistas del panel (11-11-2026)

- lib/romo-panel-proyeccion-qa.mjs convierte catálogo y inventario de Romo a elementos de lectura del panel.
- Productos, promociones, ingredientes, disponibilidad, cantidades recibidas y faltantes conservan identificador romo:serena.
- La proyección pública oculta promociones y productos sin publicar; listaParaRevision no habilita ventas.
- Fotos faltantes son detectadas como pendientes; no se inventan fotos ni precios.
- Carta antigua Romo usa Supabase para romos_products, mientras el panel nuevo utiliza la base Neon romos_sushi.
- El conector Supabase rechazó la consulta de lectura: autenticación fallida del rol de solo lectura.
- Neon tenía cero registros en romo_catalogo_v1 en la última revisión. No se importaron datos automáticamente.
- Sin modificaciones a la carta pública, sin SQL ejecutado, sin permisos nuevos y sin tocar producción.

## Vista de catálogo integrada en el mismo panel (QA)
- Se añadió firebase/uki-romo-carta-panel-qa.js al HTML del panel compartido; sólo se muestra cuando la sucursal seleccionada es Romo.
- Mostrar secciones Carta y precios, Promociones, Ingredientes, Inventario (este último pendiente) reutilizando clases visuales del panel.
- El botón de consulta tiene ENDPOINT vacío por seguridad. No intenta leer Neon/Uki hasta autorización y credenciales privadas válidas.
- La futura respuesta autorizada se muestra por DOM textContent, sin inyectar HTML de productos; rechaza datos de otra sucursal.
- No incluye POST, cambios en caja, guardados, ventas ni habilitación de checkout.
