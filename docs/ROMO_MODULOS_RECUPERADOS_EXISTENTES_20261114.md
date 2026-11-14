# Romo QA · recuperación del trabajo anterior sin duplicarlo

**14 de noviembre de 2026. Rama de trabajo \`preparacion/uki-romo-sobre-main-20261114\`.**

Se localizaron **25 módulos existentes de la rama \`qa/integracion-panel-unico-romo-serena-20261112\`** que no figuraban en el nuevo panel basado en \`main\`. Se recuperaron **los mismos archivos y SHA originales** para la rama actual, sin rediseñar su contenido, sin migraciones y sin activar operaciones.

- Operación: folios, borrador y recepción, guardado atómico, ediciones, cobros pendientes, caja, entregas, timbres, cancelación y cierre definitivo.
- Administración: resumen de dueños, inventario aislado, conciliación inventario–carta, disponibilidad, solicitud de carta y módulos de finanzas.
- Se conservaron expresamente los **cuatro archivos más nuevos ya existentes** con nombres coincidentes (\`uki-romo-operativo-qa.mjs\`, \`uki-romo-clave-remota-qa.mjs\`, \`romo-identidad-servidor-qa.mjs\`, \`romo-scope-operativo-qa.mjs\`) para no sustituir correcciones y protecciones recientes.
- Estos 25 módulos siguen **sin enlazar a la interfaz operativa** hasta revisar su compatibilidad con el código \`main\` actual y las cuatro nuevas APIs protegidas. Muchos mantienen una bandera interna \`false\`.
- No se incorporaron los antiguos endpoints HTTP a esta rama: sus condiciones de producción y sus enlaces requieren revisión de seguridad antes de permitir peticiones.
- No se realizaron tests automatizados ni pruebas de pedidos. Todas las verificaciones funcionales deberán ser **manuales** desde el iPhone cuando la dueña autorice la apertura de una vista de pruebas.
- No cambiar \`main\` de Uki ni las ventas de cualquiera de sus sucursales. No activar la carta pública de Romo hacia esta bandeja hasta que el flujo completo esté comprobado.

**Meta final sin cambios:** un solo panel, tres tiendas, mismas funciones, y bases/ventas independientes. Este commit recupera el trabajo existente; **no equivale a activación operativa**.
