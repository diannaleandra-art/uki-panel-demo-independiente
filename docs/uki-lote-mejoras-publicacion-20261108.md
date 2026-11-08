# Uki Sushi — publicación única del lote de siete mejoras

## Estado
- **Panel operativo + API admin/ingredientes/fotos**: rama `release/uki-mejoras-lote-20261108`; PR borrador #34 (este repositorio).
- **Carta pública (Frutilla y fotos)**: rama `release/uki-lote-unico-carta-20261108`; PR borrador #34 en `diannaleandra-art/uki-sushi-respaldo`.
- **Neon QA**: tabla `public.uki_carta_fotos_v1` creada; producción **no migrada**.
- **Ambas** pruebas automáticas aprobadas. Navegador móvil comprobó la selección anticipada de Arica y Frutilla.
- **Vercel**: error 402 `api-deployments-free-per-day` con reintento 24 horas después. No reintentar en bucle, no contratar planes sin autorización.

## Contenido
1. Timbres sin WhatsApp: copiar o enviar al WhatsApp del local y declarar envío manualmente; apertura de WhatsApp no equivale a enviado.
2. Pedidos en espera: borradores localizados en Nuevo y también consultables desde Pedidos; sin sumar caja.
3. Historial de rechazados de jornadas anteriores separado, día vigente sin contaminación de filtros.
4. Buscadores de timbres/historial conservan foco al teclear o borrar; botón Buscar explícito.
5. Productos e ingredientes nuevos se pueden retirar de la carta y restaurar con confirmación; no eliminar ventas históricas.
6. Foto de promociones/productos editable desde iPhone, redimensionada JPEG y guardada por sucursal en Neon; sin servicios externos.
7. «Por entregar» separado de «Por cobrar» y «Solicitudes por confirmar»; botón «Marcar entregado» sin cambiar pago ni caja.
Extra: Frutilla en Arica gracias a selección de sucursal antes del armado + corrección de importación duplicada.

## Orden seguro para la publicación definitiva
1. **No hacer nada si Vercel sigue con 402**. El panel actual y QR existentes continúan utilizándose.
2. Confirmar que QA integradas de ambas ramas están verdes; revisar cambios de producción activos recientes.
3. Ejecutar exactamente la migración aditiva de `sql/uki-carta-fotos-v1.sql` en Neon producción y verificar tabla; no borrar ni actualizar filas existentes.
4. Publicar API administrativas de este repo en `uki-sushi-inventario`, comprobar que responde `GET /api/uki-carta-fotos-live?branch=arica` con `ok:true` e `items:[]` (sin acceso a caja). No subir imagen de prueba a producción.
5. Publicar carta Git release verificada en `uki-sushi-pedidos` producción manteniendo dominio `uki-sushi-pedidos.vercel.app`; verificar `Arica` ofrece `Frutilla` y La Serena no; fotos ausentes usan las antiguas sin error. Mantener QR impresos.
6. Publicar panel administrativo de la rama verificada a GitHub Pages existente sin crear URL nueva; verificar que se vean las siete mejoras. Validar `Nube: sincronizado` y administración de fotos.
7. Comprobar que API de carta acepta solicitudes y panel tiene enlace correcto; no generar pedidos reales ficticios, no tocar cierres ni marcar timbres.
8. Si alguna pieza falla: detener publicación; revertir mediante versión anterior sin borrar la base, conservar logs.

## Limitaciones
- `Marcar entregado` requiere acción explícita del personal; no convertir automáticamente los pedidos anteriores sin confirmar sus entregas.
- Retirar un producto/ingrediente es reversible; los pedidos anteriores conservan su texto, importe y medio de pago.
- No afirmar que la integración real de pedidos entre dos agendadores fue probada con ventas reales.
