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
