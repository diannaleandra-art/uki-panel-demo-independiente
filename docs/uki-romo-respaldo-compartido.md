# Respaldo y retención compartidos: Uki y Romo

El motor mensual puro es el mismo archivo en ambos locales Uki, Mi Administración y Romo. Referencia comprobada de Romo: df64450f55e57a40267433387fbaf40e5e234762, blob d9d24fd6e9f7c609ba8970b06530ed366770b99e. La comprobación de CI compara contenido y blob. Las modificaciones del motor deben coordinarse con Romo; no sustituir panel completo, contraseñas, identidad ni datos.

El 5 de diciembre de 2026 se habilita el primer respaldo de noviembre. Se realiza con la sesión autorizada de dueños, desde el panel descifrado y sincronizado de cada sucursal. El servidor de archivo verifica y permite recuperar la copia de manera idempotente.

La retención de 35/95 se simula, no elimina. No es una tarea programada de borrado. Los datos cifrados de operación no se pueden descifrar desde una tarea nocturna del servidor con la arquitectura actual. No guardar contraseñas de los locales en trabajos cron, ni saltar PIN/Google. Una automatización fuera de sesión requeriría una decisión específica de arquitectura y custodia de claves.

Esta rama solo incorpora cambios específicos del motor/puente mensual al último main verificado. No usa el conjunto divergente de integración ni cambia las funciones aprobadas de caja ni ventas. Antes de publicar verificar las rutas oficiales y hacer comprobación manual en ambas sucursales.