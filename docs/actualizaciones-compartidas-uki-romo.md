# Actualizaciones compartidas Uki–Romo

Uki La Serena y Uki Regimiento Arica usan la misma aplicación Uki. Romo conserva un despliegue y almacenamiento independientes. La publicación de una función nueva se prepara a partir de la versión oficial y se verifica en ambos motores; no se copian pedidos ni configuraciones comerciales.

## Núcleo compartido comprobado
- Control de turnos y detalle histórico de cierres: se verificaron archivos idénticos en los commits iniciales. El sincronizador detecta cambios y conflictos y solo permite aplicar en una rama de integración.
- Módulos con datos, identidad, servicios, carta, caja e inventario: revisión/adaptación explícita. No se sobrescribe su implementación.
- La tarjeta de clientes y exportadores con marca propia no se sincronizan a ciegas.

## Flujo de entrega
1. Identificar el commit oficial Uki aprobado. Ejecutar `node scripts/sincronizar-nucleo-uki-romo.mjs SHA_UKI` para comparar.
2. Si no hay conflictos, ejecutar el mismo comando con `--aplicar` en la rama de integración Romo. No en main ni release.
3. Revisar diferencias y adaptar las funciones nuevas que requieren API de Romo. Actualizar los parámetros de caché si cambian scripts cargados por index.html.
4. Compilar panel y carta de Romo y la Administración cuando corresponda. Validar manualmente los flujos previstos.
5. Publicar las versiones aprobadas en sus proyectos oficiales, manteniendo los destinos de datos separados.

Esta es la primera fase del mecanismo común; no habilita aún propagación automática en producción ni autoriza importaciones financieras. Nunca se usa una actualización de Uki para reemplazar precios, claves, inventarios, pedidos, cierres, saldos, logo ni sucursal de Romo.

## Control de cobertura
El sincronizador también lista cambios en firebase, public, api, lib, migrations y configuración de despliegue fuera del núcleo compartido. Si los detecta, impide avanzar la base automáticamente: primero debe revisarse si una corrección funcional requiere su equivalente en Romo. Así no se pierde un cambio por avanzar el SHA de referencia. Los módulos vinculados a credenciales y almacenamiento no se copian automáticamente, aunque sus archivos sean idénticos. Los exportadores y tarjetas de timbres que contienen la marca Uki requieren adaptación visual.

## Revisión 21 de noviembre de 2026
La versión Uki de producción cc63df47668cdffc57c601a5979a710875d97262 y la versión Romo 61eb03fb7e8ccd30f2ac4b131ee1d318e0e35826 coinciden exactamente en control de turnos, detalle de cierres, agenda mensual y núcleo de archivo. Los dos últimos se agregan al manifiesto con su propia base comprobada. No se adelanta la base global: el resto de los cambios debe seguir apareciendo en el informe de revisión.
El panel de archivo tiene adaptaciones distintas para la sesión, sincronización Neon/Firebase y exportación XLSX: conservar ambas versiones. Mi Administración es compartida, no duplicar su API ni los registros.
La revisión de los cambios comunes queda preparada como workflow de solo lectura: cuando se incorpore a main y a la rama de Romo, cada cambio de código en esas ramas generará un informe de diferencias y conflictos. El informe no copia archivos, no despliega, no cambia datos. Se debe adaptar cada cambio funcional fuera del núcleo y validar manualmente antes de publicar. Un resultado sin conflictos en los cuatro módulos no significa paridad de toda la aplicación.
