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


## QA · Conexión segura de identificadores
Registro reutilizable: public/uki-locales-registro-qa.mjs.
Las 3 tiendas ya existentes se conservan: uki:arica, uki:serena y romo:serena.
Un local nuevo recibe local:UUID exclusivo en vez de identificarse por un nombre parecido.
Una ficha nueva nunca copia ventas, inventario, caja o clientes, ni habilita carta.
Romo debe asociarse explícitamente a su identificador existente antes de la activación.
No se ejecutó migración ni se cambió la producción.

## Alta de sucursal y ficha en un paso
La pestaña Negocios ofrece Crear nueva sucursal desde el mismo formulario operativo, sin repetir el registro financiero manual. El servidor prepara ambos registros en una única sentencia SQL y conserva todo como borrador, sin ventas ni QR. No se ejecutó migración ni se activó la bandera privada.


## Vínculo entre la ficha, carta y panel · QA
El módulo public/uki-locales-motor-qa.mjs convierte la ficha única del dueño en perfiles de carta y panel con el mismo storeId. Para Romo conserva romo:serena y la ruta /romo/; para locales nuevos no inventa catálogo ni caja. El listado privado utiliza esta conexión y las pruebas comprueban que un mensaje de carta Romo prepara el formulario habitual, sin aceptar pagos ni precios por defecto. No se habilita el acceso a los clientes ni se ejecuta ninguna migración.


## Puente seguro de identidad visual (QA)
La ficha privada de Romo se proyecta a ocho campos visuales exclusivamente:
nombre, dirección, WhatsApp, Instagram, horarios, color, URL del logo y URL de portada.
Se descartan negocio/sucursal internos, PIN, token Google, sesión financiera, caja,
inventario y ventas. El dueño puede visualizar estos campos en Mi Administración
sin publicar ni modificar la carta; el envío externo exacto vía postMessage
permanece con bandera false y origen fijo. Falta vista externa QA desplegada.


## Guardia adicional en el guardado de Uki
Hasta que el guardado atómico Neon de Romo esté conectado, la función ndGuardar() rechaza expresamente S.suc=Romo’s Sushi La Serena. Esto evita ventas locales y duplicados si alguien intenta acceder a la sucursal por otra ruta. Uki Regimiento Arica y Uki La Serena conservan su procedimiento anterior sin cambios.


## Diagnóstico único de Romo, sin publicación
Se agregó un diagnóstico de solo lectura para catálogo Romo, personal autorizado, solicitudes y estado operativo. No sustituye las pruebas reales de dos teléfonos, el enlace final de caja e historial, ni la autorización de dueños. Guardar pedidos y cerrar caja Romo siguen bloqueados en la rama de pruebas hasta completar la confirmación atómica. La base financiera fin_* no se encontró en las bases Neon disponibles; ninguna migración fue ejecutada en una base no verificada.


## No duplicar Romo La Serena
El formulario privado distingue explícitamente Vincular Romo existente de Crear local nuevo. El servidor requiere la selección exacta y verifica el negocio, sucursal y dirección Balmaceda 1612 antes de usar romo:serena; un local nuevo obtiene local:UUID. La tabla fin_locales_operativos_qa protege la unicidad de store_id y sucursal_id. Estos cambios no se activan hasta comprobar la base financiera privada y obtener autorización de publicación.


## Verificación real del esquema financiero, sin ejecutar migraciones
La rama financiera identificada contiene fin_negocios, fin_sucursales, fin_sesiones, fin_auditoria y cierres existentes. El administrador sólo consulta qué requisitos están disponibles a través de `locales_operativos_diagnostico_qa`, usando la sesión de dueños ya autorizada. La migración preparada añade una clave foránea compuesta `(sucursal_id,negocio_id)` para evitar relacionar un local con un negocio incorrecto. `Guardar borrador` sigue deshabilitado mientras no se compruebe la tabla y la bandera privada. NO se ejecutaron migraciones, NO se publicaron cartas, NO se abrieron ventas.


## 13 noviembre 2026 · Migración ejecutada con autorización explícita
- Se localizó la rama Neon **uki-duenos-finanzas-privadas-20261110** (proyecto Uki, base `neondb`) por su estructura financiera y coincidencia del host permitido en el servidor. No se tocó la rama Neon `production`.
- Se ejecutó en transacción el CREATE TABLE e índice del archivo `migrations/2026-11-13-registro-locales-duenos-qa.sql`. Verificación: llave compuesta `(sucursal_id,negocio_id)`, unicidad por sucursal y `store_id`, solo `estado=borrador` y `publicado=false`.
- Se creó únicamente una ficha QA para el **Romo’s Sushi La Serena** ya registrado, con `store_id=romo:serena`, dirección Balmaceda 1612, plantilla Uki, módulos desactivados y sin WhatsApp ni imágenes inventados. No se creó sucursal nueva.
- Comprobados tras migración: 3 negocios, 5 sucursales y 21 cierres existentes; 1 ficha operativa de borrador.
- El backend **todavía no está publicado** con estos cambios ni se habilitó `UKI_LOCALES_OPERATIVOS_QA_ENABLED`; guardar desde la interfaz seguirá bloqueado hasta publicación y autorización específicas.
- Reforzado el alta de sucursales: "Crear nueva" solo acepta una fila realmente nueva. Una sucursal existente nunca se recupera silenciosamente para crear otra ficha operativa.
- El botón Guardar permanece bloqueado tras fallas de autenticación o diagnóstico. Ninguna venta, carta o QR activados.


## Lectura privada de fichas sin habilitar edición (QA)
Separamos la consulta del guardado del Administrador de Locales. La sesión Google+PIN existente puede listar y abrir fichas usando la tabla preparada, sin habilitar pedidos, caja, timbres ni cambios de datos. La escritura permanece detrás de `UKI_LOCALES_OPERATIVOS_QA_ENABLED`. Al seleccionar «Ver ficha», el sistema carga la información y la revisión guardada, sin duplicar Romo. La consulta devuelve únicamente los campos necesarios y descarta datos internos del auditor. Pendiente despliegue autorizado.

## Protección visual de edición de fichas (QA)
Al editar nombre, horario, dirección o color, el formulario conserva los enlaces de logo y portada previamente guardados y validados. La elección de una nueva foto desde el iPhone solo ofrece vista previa hasta instalar almacenamiento autorizado. El listado de tiendas no duplica Romo cuando su ficha se encuentra en la base. Edición sigue bloqueada detrás de la bandera privada y continúa sin publicación comercial.


## Guardado seguro del lado del servidor · QA
El guardado de ficha ya no confía únicamente en el iPhone para preservar logo y portada: consulta configuración original en Neon, conserva URLs previamente guardadas y rechaza reemplazos por enlaces arbitrarios hasta que haya carga segura de imágenes.
La consulta y edición requieren siempre el Google + PIN existente; la modificación sigue con la bandera privada apagada.
La actualización de Neon utiliza CAS sobre negocio_id, sucursal_id, store_id inmutable y revision actual, con estado='borrador'. Dos teléfonos no pueden sobrescribir silenciosamente cambios entre sí.
Los tests simulan éxito, fallo de revisión, intento de cambiar fotos e intentos de habilitar caja. Sin publicación ni operaciones.


## Cambios de ficha y auditoría en una operación (QA)
La actualización de la ficha y su registro de auditoría se ejecutan en una única sentencia SQL, sin escrituras separadas que puedan quedar inconsistentes. Se registran exclusivamente campos de identidad modificados y sus revisiones, con el actor interno de finanzas. Si la auditoría falla, no se confirma la ficha. El guardado sigue desactivado mientras no se autorice su activación privada; no se publicaron cartas.


## Concurrencia visible de edición privada (QA)
Cuando dos teléfonos editan la misma ficha y el guardado del segundo recibe un conflicto, el formulario no borra lo escrito ni vuelve a enviar cambios con una revisión vencida. Se informa expresamente que no se guardó nada y se muestra «Cargar versión actual» para recargar el borrador solo por decisión del dueño. Este control permanece detrás de la misma sesión privada y bandera de edición, sin publicar carta ni pedidos.
