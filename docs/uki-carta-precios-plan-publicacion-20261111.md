# Uki Sushi · Una sola actualización coordinada (PENDIENTE DE AUTORIZACIÓN)
Fecha de preparación: 11 de noviembre de 2026. No ejecutar automáticamente.

## Contenido único
- Carta y precios: categorías creadas por sucursal, asignación por producto.
- Promociones: tarjetas organizadas con búsqueda, edición y retiro existente.
- Descuentos porcentuales: precio de referencia original; precio final en la carta actual, carrito y WhatsApp.

## Publicación segura
1. NO modificar pedidos, mesas, caja, cierres, inventario ni QR. Mantener las mismas URLs.
2. Antes del cambio: confirmar copias de seguridad de Neon y estado operativo de ambas sucursales. Comparar SKUs, precios y promociones actuales.
3. Obtener autorización expresa de la dueña para la actualización definitiva.
4. Ejecutar la migración ADITIVA `sql/uki-categorias-descuentos-produccion-20261111.sql` en el branch productivo correcto SOLO después de respaldo y autorización. No borra ni altera tablas existentes.
5. Publicar en orden controlado la actualización del backend/panel y la carta pública existente. No cambiar dominios ni enlaces QR.
6. No activar `UKI_CATEGORIAS_DESCUENTOS_ENABLED` hasta que estén publicadas AMBAS piezas y se hayan comprobado las tablas nuevas.
7. Confirmar que promociones del mes mantengan controles existentes de editar/retirar; los flags de promociones requieren pruebas de fotos, publicación y armado antes de encenderse en producción.
8. Verificar sin ventas reales: GET de ambas sucursales, precios originales sin descuentos (descuentos nuevos deben iniciar vacíos), selecciones de sucursal, cálculo del carrito y WhatsApp, disponibilidad y apertura del panel.
9. Si falla: desactivar bandera de categorías/descuentos primero y restituir despliegues anteriores. Nunca revertir ni borrar los datos de pedidos o caja.

## Criterios de aprobación
- Misma carta y mismo panel de siempre; sin acceso extra a Firebase para la dueña.
- Precios actuales idénticos hasta que administradora aplique un descuento explícito.
- Tablas nuevas vacías al habilitar, separadas por `arica` y `serena`.
- Código de QA aislado omitido de este paquete: no se incorporan rutas `/qa-panel`, scripts temporales de prueba ni `postinstall` QA.
