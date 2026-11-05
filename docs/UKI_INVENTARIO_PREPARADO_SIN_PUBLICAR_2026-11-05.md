# Uki Sushi — panel de inventario: preparado para integración, SIN PUBLICAR

Fecha: 2026-11-05. Preparación separada para Regimiento Arica y La Serena.

## Situación y alcance

- Panel real vigente: GitHub Pages, `diannaleandra-art.github.io`.
- Código base del panel real en `main`; esta rama de preparación deriva
  de la versión de inventario QA probada
  (`feature/uki-panel-inventario-carta-qa-20261105`, `52408dd`).
- **No se ha fusionado esta rama con main ni publicado a GitHub Pages.**
- El panel real debe seguir operando con su mismo código compartido,
  nube, pedidos, pagos, cierres, precierres y timbres.
- El nuevo inventario solo incorpora búsqueda de productos/ingredientes,
  disponibilidad manual, conteos, entradas, historial y permisos.
- Los trabajadores no pueden modificar precios ni crear productos;
  el nombre del trabajador identifica cada movimiento.
- Inventario y disponibilidad son independientes: stock 0 NO agota.
- QA usa credenciales propias; jamás utilizar dispositivos QA en producción.

## Requisitos de lanzamiento futuro (no autorizados todavía)

1. Comprobar primero en la **carta pública real** la existencia del
   endpoint `/api/catalogo-live` con las tablas de Neon producción
   instaladas, acceso autorizado y feature flag listo.
2. No publicar el panel hasta que ese endpoint responda correctamente
   para Arica y Serena y pase pruebas de no-regresión.
3. Validar desde iPhone de administración y equipo trabajador autorizado
   el catálogo, sin alterar el PIN compartido.
4. Verificar que no se modificaron las ventas, caja, cierres, QR, WhatsApp
   ni datos previos. Disponibilidad manual por sucursal.
5. Conservar la versión anterior para revertir si es necesario.

**Prohibido fusionar a main o publicar sin nueva autorización.**
