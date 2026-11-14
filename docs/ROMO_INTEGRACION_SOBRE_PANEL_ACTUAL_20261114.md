# Integración Romo sobre el panel Uki ACTUAL · 14 noviembre 2026

**Código preparado, SIN publicación ni operaciones reales.**

## Origen correcto

Esta rama parte del commit principal del panel Uki `a567f7a1c3a9dc37daf9c43f77da4964e87dee71`, **no** de la copia QA antigua. Comparar `qa/uki-panel-unico-romo-serena-20261111` contra `main` detectó bifurcación con cambios posteriores en Carta y precios, inventario, facturas y otras mejoras. Para conservar todas esas funciones, este trabajo se apoyó en `main` y **no sobreescribió sus módulos comerciales**.

- Se modificó **únicamente** `firebase/uki-sushi-local.html` del código original de las dos sucursales; los demás módulos originales se conservaron tal cual.
- Se añadieron módulos independientes `firebase/uki-romo-*.mjs` y `lib/romo-panel-unico-sesion-qa.mjs` para un tercer local `Romo’s Sushi La Serena` (Balmaceda 1612).
- Las rutas, botones y claves de las dos sucursales Uki se mantienen y Romo tiene un ID exclusivo `romo:serena`.
- El panel Romo usa las **mismas pantallas** actuales de pedidos, caja, inventario y cierres una vez que se autorice y habilite el backend; no existe otro panel ni otra sesión Google.
- El guardado de Romo nunca escribe la colección Firebase ni la clave local de Uki; la ruta de Neon para su estado cifrado está preparada aparte.

## Funciones agregadas en preparación

1. Acceso inicial con una de las claves **ya existentes** de Uki.
2. Vinculación desde el mismo panel, ocultada mientras `ROMO_CLAVE_ALTA_ENDPOINT_QA` esté vacío. Para enrolar en el futuro: validar la clave contra el respaldo local de la sucursal Uki exacta, generar **sólo** un verificador PBKDF2/AES-GCM en Safari y enviarlo con Firebase Google del dueño, nunca transmitir la contraseña.
3. Consulta futura de catálogo Romo en **sólo lectura**, con dos categorías, 7 productos, 40 ingredientes, 3 promociones y el campo `categoriaSlug`, sin poder sobrescribirlo.
4. Carga/guardado cifrado del estado operativo Romo con control de revisión para no sobrescribir operaciones de otro teléfono.

## Protecciones pendientes

- `ROMO_OPERATIVO_ENDPOINT_QA`, `ROMO_PROOFS_ENDPOINT`, `ROMO_CLAVE_ALTA_ENDPOINT_QA` y `ROMO_CATALOGO_ENDPOINT_QA` **vacíos**. Nadie puede activar pagos o ventas por esta rama.
- Las rutas de backend, también apagadas, están en la rama `preparacion/integracion-panel-unico-romo-20261114` del repositorio privado `romos-sushi-qa.`.
- Faltan: configurar origen y conexión Neon con usuario autorizado, generar el verificador desde Safari, enlazar las operaciones de carta e inventario, y bloquear o adaptar por local cada módulo de caja, delivery, timbres y cierres.
- Todavía no se ha publicado ni verificado manualmente el panel Romo. La propietaria pidió **todas las pruebas manuales**.
- Ningún cambio de esta rama altera el panel real `main`, Firestore, Neon o el QR. No se autorizó ninguna activación o publicación.
