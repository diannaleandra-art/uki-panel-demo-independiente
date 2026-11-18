# Romo La Serena · Carta aprobada → Panel · preparación de publicación
**Fecha:** 18 de noviembre de 2026. **Estado:** QA privado, sin pedidos ni cobros comerciales.

## Ya verificado
- La carta Romo se visualizó en Safari desde el Preview `release/romos-carta-v816`: portada aprobada, carrito, 4 korokes por $2.500 (valor de referencia) y formulario de retiro. No se transmitió ningún pedido.
- Los **40 productos** aprobados se derivan de `romos-sushi-qa./replica-uki/carta/lib/romo-catalogo-aprobado-qa.mjs`. No sustituirlos por `romo_catalogo_v1`, que actualmente contiene siete productos auxiliares.
- Neon Romo es el proyecto `round-cell-98681740`, base `romos_sushi`; la rama principal tiene `romo_carta_ediciones_v1` y auditoría sin revisión inicial.
- En la rama QA `br-gentle-wave-be71bcpa` se instalaron el 18-11 las dos tablas de ediciones y auditoría, vacías y con permisos para `romos_app_service`; sin copia de datos, sin cambios en Caja ni ventas. **No confundir ambas ramas de Neon.**
- El editor seguro ya está integrado en **Inventario → Carta y precios** del panel aislado de Romo. Está oculto hasta que `GET /api/romo-carta-ediciones-seguras-qa` confirme Google/rol de dueños. No duplicarlo en Promos.
- La primera revisión usa el botón existente **Confirmar versión inicial de la carta** y el `POST action=initialize, expectedRevision=0` auditado. Debe ejecutarlo la dueña en una sesión autorizada tras verificar los productos, nunca por una consulta automática.
- El feed público de cambios exige ahora `revision >= 1`; la revisión cero no es prueba de precios confirmados.

## Conexión pendiente y orden seguro
1. **Revisar destino de base del panel:** confirmar si `ROMO_PRIVATE_DATABASE_URL` del Preview apunta a Neon principal o a la rama QA. No reemplazar esa URL a ciegas: el mismo servicio gestiona el estado operativo, Caja y solicitudes. La tabla QA recién instalada no significa que la API actual la utilice.
2. **Configurar lectura de carta entre proyectos:** acceso Vercel al proyecto `romos-sushi-carta-qa` sigue sin estar disponible para la conexión de herramientas, aunque está visible para la dueña en su dashboard. Revisar los orígenes estables de Preview, la protección entre proyectos y estas banderas separadas en el entorno de pruebas:
   - Carta: `ROMO_CATALOGO_APROBADO_QA_ENABLED` y `ROMO_CARTA_PUENTE_CAMBIOS_QA_ENABLED`.
   - Panel: `ROMO_CARTA_EDICIONES_QA_ENABLED` y `ROMO_CARTA_CAMBIOS_PUBLICOS_QA_ENABLED`.
   - Configuración cruzada: `ROMO_PANEL_ALLOWED_ORIGIN`, `ROMO_CARTA_CATALOGO_QA_ORIGIN`, `ROMO_CARTA_PUBLIC_ORIGIN_QA`, `ROMO_PANEL_CAMBIOS_PUBLICOS_ORIGIN_QA`, según el proyecto dueño de cada API.
   - No registrar secretos, URLs con credenciales o valores de tokens en GitHub ni en capturas.
3. **Permitir inicialización manual de dueños** únicamente con `ROMO_CARTA_EDICIONES_ESCRITURA_QA_ENABLED` limitado al Preview aprobado; comprobar primero acceso Google, los 40 productos, hash y esquema de la rama seleccionada. Dejar desactivado al terminar.
4. **Verificar el feed completo:** origen autorizado → 40 productos → revisión 1 → hash coincidente → precio/stock por producto. Si cualquier comprobación falla, mantener la vista privada y no usar precios como comerciales.
5. **Recepción y aceptación:** sólo después de la carta validada, revisar `ROMO_RECEPCION_CARTA_QA_ENABLED` en carta y `ROMO_SOLICITUDES_PUBLICO_QA_ENABLED`, `ROMO_SOLICITUDES_ACEPTACION_QA_ENABLED`, cotizador, identidad e idempotencia en panel. Realizar **un pedido de retiro controlado** con la dueña; el pedido pendiente no se suma a ventas sin pago.
6. **Publicación:** agrupar cambios, ejecutar CI y prueba manual, publicar en Preview, y promover a comercial sólo con autorización final. No modificar `main` de Uki ni reutilizar `Redeploy` de una versión anterior.

## Lo que NO está autorizado
- No inicializar la revisión de precios por SQL directo ni en nombre de la dueña.
- No habilitar `POST` comercial, pagos, caja o la carta pública de clientes ahora.
- No usar la rama QA de Neon como sustituto de la base operativa sin revisar su aislamiento y permisos.
- No recrear la carta ni duplicar el editor existente.
