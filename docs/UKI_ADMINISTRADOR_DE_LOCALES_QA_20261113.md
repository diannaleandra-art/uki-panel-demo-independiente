# Administrador de locales operativo · QA · 13 noviembre 2026

## Decisión para evitar rehacer todo
Se reutiliza la pestaña existente «Mi Administración → Negocios», su Google + PIN y el registro contable actual de negocios y sucursales. No se crea otra aplicación ni otra contraseña.
«Agregar sucursal» del panel financiero sigue funcionando igual y NO crea una carta.
La nueva sección «Crear local con carta y panel» usa esa sucursal y guarda una ficha de CONFIGURACIÓN en borrador.

## Datos de ficha
Negocio y sucursal existentes; nombre público, dirección, WhatsApp, Instagram, horarios, color, logo y portada, plantilla de carta.
Plantillas: motor visual/funcional de Uki sin copiar datos; carta vacía con el mismo motor.
Fotos seleccionables desde teléfono son SOLO PREVISUALIZACIÓN hasta conectar almacenamiento de imágenes.
Cada local tiene store_id estable. Preservar los tres ID actuales uki:arica, uki:serena y romo:serena. Nuevos locales: local:<UUID> creado por servidor.
No se copian precios, fotos, pagos, inventario, timbres, clientes, cierres ni pedidos. Módulos apagados hasta conexión y autorización.

## Implementado en QA
- UI integrada en la sección privada de dueños.
- Normalizador estricto y protegido por el backend, sin aceptar permisos o store_id desde el navegador.
- Acciones listar/guardar solo tras Google + PIN de Mi Administración y banderas QA.
- Guardado con revisión optimista y restricciones de idempotencia por sucursal, ambos en borrador.
- Archivo de migración SQL de configuración (NO EJECUTADO).
- Bandera UKI_LOCALES_OPERATIVOS_QA_ENABLED no configurada: la API responde 503; ningún dato se escribe.
- Rama de pruebas, no producción: fotos no se suben y no se habilita venta/QR.

## Siguiente bloque tras esta preparación
Unificar las adaptaciones Romo sobre el registro; conectar la carta al store_id y el formulario al mismo motor de caja sin rutas hardcodeadas. Probar dos teléfonos y permisos por tienda antes de habilitar una sucursal real. Una única publicación autorizada al final.
